import { EventEmitter } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { MigrationGraph } from "./types/graph.js";
import type { MigrationConfig } from "./types/config.js";
import type { Degradation } from "./types/degradation.js";
import { readZip } from "./stages/zip-reader.js";
import { normalize } from "./stages/normalizer.js";
import { linkGraph } from "./stages/graph-linker.js";
import { transform } from "./stages/transformer.js";
import { writeVault, type WriteResult } from "./stages/writer.js";
import { generateReport, type MigrationReport } from "./stages/reporter.js";

export interface ProgressEvent {
  stage: string;
  message: string;
  progress: number; // 0-100
}

export interface PipelineEmitter extends EventEmitter {
  on(event: "progress", listener: (data: ProgressEvent) => void): this;
  on(event: "complete", listener: (data: { report: MigrationReport; writeResult: WriteResult }) => void): this;
  on(event: "error", listener: (err: Error) => void): this;
}

/**
 * Run the migration pipeline with progress events for the UI.
 */
export function runPipelineWithEvents(config: MigrationConfig): PipelineEmitter {
  const emitter = new EventEmitter() as PipelineEmitter;

  const emit = (stage: string, message: string, progress: number) => {
    emitter.emit("progress", { stage, message, progress });
  };

  (async () => {
    const startedAt = Date.now();
    const allDiagnostics: Degradation[] = [];
    const tempDir = await mkdtemp(path.join(tmpdir(), "aime-"));

    try {
      // Stage 1
      emit("zip-reader", "Reading zip file...", 5);
      const { entries, diagnostics: zipDiags } = await readZip(config.inputZip);
      allDiagnostics.push(...zipDiags);
      emit("zip-reader", `Extracted ${entries.length} entries`, 15);

      // Stage 2
      emit("normalizer", "Analyzing files and building graph...", 20);
      const graph = await normalize(entries, config.inputZip, tempDir);
      emit("normalizer", `Built graph: ${graph.meta.nodeCount} nodes`, 35);

      // Stage 3
      emit("graph-linker", "Resolving links...", 40);
      await linkGraph(graph);
      emit("graph-linker", `Resolved ${graph.edges.length} links`, 50);

      // Stage 4
      emit("transformer", "Transforming content...", 55);
      await transform(graph);
      emit("transformer", "Content transformed", 70);

      // Stage 5
      emit("writer", config.dryRun ? "Dry run — planning output..." : "Writing vault...", 75);
      const writeResult = await writeVault(graph, config);
      emit("writer", `${writeResult.filesWritten} files written`, 90);

      // Collect diagnostics
      for (const [, node] of graph.nodes) {
        if ("degradations" in node) {
          allDiagnostics.push(...(node.degradations as Degradation[]));
        }
      }

      // Stage 6
      emit("reporter", "Generating report...", 95);
      const report = await generateReport(graph, writeResult, allDiagnostics, config.outputDir, startedAt);
      emit("reporter", "Done!", 100);

      emitter.emit("complete", { report, writeResult });
    } catch (err) {
      emitter.emit("error", err instanceof Error ? err : new Error(String(err)));
    } finally {
      await rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  })();

  return emitter;
}
