import path from "node:path";
import { mkdir, writeFile, copyFile, rename, rm, readdir, stat } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { MigrationGraph, ContentRef } from "../types/graph.js";
import type { MigrationConfig } from "../types/config.js";
import { isWithinDir } from "../utils/path-utils.js";
import { serializeFrontmatter } from "../transforms/frontmatter-builder.js";

export interface WriteResult {
  mode: "write" | "dry-run";
  filesWritten: number;
  bytesWritten: number;
  outputPaths: string[];
}

async function readContentRef(ref: ContentRef): Promise<string> {
  if (ref.kind === "memory") return ref.value;
  return readFile(ref.value, "utf-8");
}

/**
 * Check if a directory is empty (or doesn't exist).
 */
async function isDirEmpty(dirPath: string): Promise<boolean> {
  try {
    const entries = await readdir(dirPath);
    return entries.length === 0;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return true;
    throw error;
  }
}

/**
 * Stage 5: Write the transformed vault to disk.
 */
export async function writeVault(
  graph: MigrationGraph,
  config: MigrationConfig,
): Promise<WriteResult> {
  const outputDir = path.resolve(config.outputDir);

  // Check output directory
  if (!config.force) {
    const empty = await isDirEmpty(outputDir);
    if (!empty) {
      throw new Error(
        `Output directory is not empty: ${outputDir}\nUse --force to overwrite existing files.`,
      );
    }
  }

  if (config.dryRun) {
    return buildDryRunResult(graph, outputDir);
  }

  await mkdir(outputDir, { recursive: true });

  let filesWritten = 0;
  let bytesWritten = 0;
  const outputPaths: string[] = [];

  // Collect all write operations, then sort for deterministic output
  const writeOps: Array<{
    targetPath: string;
    content?: string;
    sourcePath?: string;
  }> = [];

  // Pages
  for (const [, node] of graph.nodes) {
    if (node.kind === "page") {
      const content = node.transformedRef
        ? await readContentRef(node.transformedRef)
        : await readContentRef(node.sourceRef);

      const fm = serializeFrontmatter(node.frontmatter);
      const fullContent = fm + normalizeNewlines(content);

      writeOps.push({
        targetPath: node.targetPath,
        content: fullContent,
      });
    }
  }

  // Database row nodes
  for (const [, node] of graph.nodes) {
    if (node.kind === "database-row") {
      const body = node.bodyRef ? await readContentRef(node.bodyRef) : "";
      const fm = serializeFrontmatter(node.frontmatter);
      const fullContent = fm + normalizeNewlines(body);

      writeOps.push({
        targetPath: node.targetPath,
        content: fullContent,
      });
    }
  }

  // Database index pages
  for (const [, node] of graph.nodes) {
    if (node.kind === "database" && node.indexTargetPath) {
      const indexContent = generateDatabaseIndex(node, graph);
      writeOps.push({
        targetPath: node.indexTargetPath,
        content: indexContent,
      });
    }
  }

  // Attachments (copy from staged path)
  const writtenHashes = new Set<string>();
  for (const [, node] of graph.nodes) {
    if (node.kind === "attachment" && node.bucketPath) {
      // Dedup: same content hash only written once
      if (writtenHashes.has(node.contentHash)) continue;
      writtenHashes.add(node.contentHash);

      writeOps.push({
        targetPath: node.bucketPath,
        sourcePath: node.stagedPath,
      });
    }
  }

  // Sort for deterministic output
  writeOps.sort((a, b) => a.targetPath.localeCompare(b.targetPath));

  // Execute writes
  for (const op of writeOps) {
    const fullPath = path.join(outputDir, op.targetPath);

    // Security check: ensure path is within output dir
    if (!isWithinDir(fullPath, outputDir)) {
      throw new Error(`Output path escapes vault directory: ${op.targetPath}`);
    }

    await mkdir(path.dirname(fullPath), { recursive: true });

    if (op.content !== undefined) {
      await atomicWriteFile(fullPath, op.content);
      bytesWritten += Buffer.byteLength(op.content, "utf-8");
    } else if (op.sourcePath) {
      await atomicCopyFile(op.sourcePath, fullPath);
      const s = await stat(op.sourcePath);
      bytesWritten += s.size;
    }

    filesWritten++;
    outputPaths.push(op.targetPath);
  }

  return { mode: "write", filesWritten, bytesWritten, outputPaths };
}


/** Replace a single destination file atomically by staging beside it. */
async function atomicWriteFile(target: string, content: string): Promise<void> {
  const temporary = `${target}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, content, { encoding: "utf-8", flag: "wx" });
    await rename(temporary, target);
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => {});
    throw error;
  }
}

/** Copy binary assets via a same-directory temporary file to avoid partial targets. */
async function atomicCopyFile(source: string, target: string): Promise<void> {
  const temporary = `${target}.${randomUUID()}.tmp`;
  try {
    await copyFile(source, temporary);
    await rename(temporary, target);
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => {});
    throw error;
  }
}

function buildDryRunResult(
  graph: MigrationGraph,
  outputDir: string,
): WriteResult {
  const outputPaths: string[] = [];

  for (const [, node] of graph.nodes) {
    if (node.kind === "page" && node.targetPath) {
      outputPaths.push(node.targetPath);
    }
    if (node.kind === "database-row" && node.targetPath) {
      outputPaths.push(node.targetPath);
    }
    if (node.kind === "database" && node.indexTargetPath) {
      outputPaths.push(node.indexTargetPath);
    }
    if (node.kind === "attachment" && node.bucketPath) {
      outputPaths.push(node.bucketPath);
    }
  }

  outputPaths.sort();
  return { mode: "dry-run", filesWritten: 0, bytesWritten: 0, outputPaths };
}

function normalizeNewlines(content: string): string {
  return content.replace(/\r\n/g, "\n");
}

function generateDatabaseIndex(
  dbNode: {
    cleanName: string;
    columns: Array<{ name: string }>;
    rowIds: string[];
    targetPath: string;
  },
  graph: MigrationGraph,
): string {
  const lines: string[] = [];
  lines.push(`# ${dbNode.cleanName}`);
  lines.push("");

  // Table header
  if (dbNode.columns.length > 0) {
    const headerNames = dbNode.columns.map((c) => c.name);
    lines.push("| " + headerNames.join(" | ") + " |");
    lines.push("| " + headerNames.map(() => "---").join(" | ") + " |");

    // Table rows
    for (const rowId of dbNode.rowIds) {
      const rowNode = graph.nodes.get(rowId);
      if (rowNode?.kind === "database-row") {
        const cells = dbNode.columns.map((col) => {
          if (col.name === headerNames[0]) {
            return `[[${rowNode.wikilinkTarget}]]`;
          }
          const val = rowNode.properties[col.name];
          return val != null ? String(val) : "";
        });
        lines.push("| " + cells.join(" | ") + " |");
      }
    }
  }

  lines.push("");

  // Dataview snippet
  lines.push("<!--");
  lines.push("```dataview");
  lines.push(
    `TABLE ${dbNode.columns
      .slice(1)
      .map((c) => c.name)
      .join(", ")}`,
  );
  lines.push(`FROM "${dbNode.targetPath}"`);
  lines.push("SORT file.name ASC");
  lines.push("```");
  lines.push("-->");
  lines.push("");

  return normalizeNewlines(lines.join("\n"));
}
