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
import { randomUUID } from "node:crypto";
import { MigrationStore } from "./state/store.js";

export interface PipelineResult {
  graph: MigrationGraph;
  writeResult: WriteResult;
  report: MigrationReport;
  diagnostics: Degradation[];
}

/**
 * Run the full migration pipeline: zip → normalize → link → transform → write → report.
 */
export async function runPipeline(
  config: MigrationConfig,
): Promise<PipelineResult> {
  const startedAt = Date.now();
  const allDiagnostics: Degradation[] = [];
  const store = new MigrationStore();
  const jobId = randomUUID();
  let jobCreated = false;
  let tempDir: string | undefined;
  const checkpoint = (stage: string, detail: unknown = {}) => store.checkpoint(jobId, stage, detail);

  try {
    store.create({ id: jobId, source: "notion-export-zip", destination: path.resolve(config.outputDir) });
    jobCreated = true;
    // Create temp directory for staged content only after the journal entry exists.
    tempDir = await mkdtemp(path.join(tmpdir(), "aime-"));
    // Stage 1: Read zip
    if (config.verbose) {
      console.error("[aime] Reading zip file...");
    }
    const { entries, diagnostics: zipDiags, zipSize } = await readZip(
      config.inputZip,
    );
    allDiagnostics.push(...zipDiags);
    checkpoint("zip-read", { entries: entries.length, zipSize });

    if (config.verbose) {
      console.error(
        `[aime] Extracted ${entries.length} entries from zip (${zipSize} bytes)`,
      );
    }

    // Stage 2: Normalize
    if (config.verbose) {
      console.error("[aime] Normalizing entries...");
    }
    const graph = await normalize(entries, config.inputZip, tempDir);
    checkpoint("normalized", { nodes: graph.meta.nodeCount });

    if (config.verbose) {
      console.error(`[aime] Built graph with ${graph.meta.nodeCount} nodes`);
    }

    // Stage 3: Link graph
    if (config.verbose) {
      console.error("[aime] Resolving links...");
    }
    await linkGraph(graph);
    checkpoint("links-resolved", { edges: graph.edges.length });

    if (config.verbose) {
      console.error(`[aime] Resolved ${graph.edges.length} edges`);
    }

    // Stage 4: Transform
    if (config.verbose) {
      console.error("[aime] Transforming content...");
    }
    await transform(graph);
    checkpoint("transformed", { nodes: graph.nodes.size });

    if (config.verbose) {
      console.error("[aime] Content transformed.");
    }

    // Stage 5: Write
    if (config.verbose) {
      console.error(
        config.dryRun
          ? "[aime] Dry run — skipping write."
          : "[aime] Writing vault...",
      );
    }
    const writeResult = await writeVault(graph, config);
    checkpoint("written", { mode: writeResult.mode, filesWritten: writeResult.filesWritten, bytesWritten: writeResult.bytesWritten });

    if (config.verbose) {
      console.error(
        `[aime] ${writeResult.mode}: ${writeResult.filesWritten} files, ${writeResult.bytesWritten} bytes`,
      );
    }

    // Collect all node-level diagnostics
    for (const [, node] of graph.nodes) {
      if ("degradations" in node) {
        allDiagnostics.push(
          ...(node.degradations as Degradation[]),
        );
      }
    }

    // Stage 6: Report
    if (config.verbose) {
      console.error("[aime] Generating report...");
    }
    const report = await generateReport(
      graph,
      writeResult,
      allDiagnostics,
      config.outputDir,
      startedAt,
    );

    checkpoint("reported", { degradations: report.degradations.length, unresolvedLinks: report.unresolvedLinks.length });
    store.finish(jobId, "completed");
    return { graph, writeResult, report, diagnostics: allDiagnostics };
  } catch (error) {
    if (jobCreated) {
      try {
        store.finish(jobId, "failed", error instanceof Error ? error.message : String(error));
      } catch { /* Preserve the original migration error if journaling also fails. */ }
    }
    throw error;
  } finally {
    if (tempDir) await rm(tempDir, { recursive: true, force: true }).catch(() => {});
    store.close();
  }
}
