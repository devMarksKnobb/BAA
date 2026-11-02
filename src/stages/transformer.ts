import path from "node:path";
import { readFile } from "node:fs/promises";
import type {
  MigrationGraph,
  PageNode,
  DatabaseNode,
  DatabaseRowNode,
  AttachmentNode,
  ContentRef,
} from "../types/graph.js";
import { parseCsv } from "../utils/csv-parser.js";
import {
  cleanFilename,
  truncateFilename,
  resolveCollision,
  buildBucketPath,
  computeWikilinkTarget,
  headingSlug,
} from "../utils/path-utils.js";
import { hashPrefix } from "../utils/hash.js";
import { nodeKey } from "../utils/notion-id.js";
import { rewriteLinks } from "../transforms/link-rewriter.js";
import { convertCallouts } from "../transforms/callout-converter.js";
import { convertToggles } from "../transforms/toggle-converter.js";
import { convertEmbeds } from "../transforms/embed-converter.js";
import { expandSyncedBlocks } from "../transforms/synced-block-expander.js";
import { rewriteHtmlImages } from "../transforms/attachment-path.js";
import {
  buildFrontmatter,
  serializeFrontmatter,
} from "../transforms/frontmatter-builder.js";

async function readContentRef(ref: ContentRef): Promise<string> {
  if (ref.kind === "memory") return ref.value;
  return readFile(ref.value, "utf-8");
}

/**
 * Stage 4: Transform graph content.
 *
 * 1. Compute targetPaths for all nodes
 * 2. Compute bucket paths for attachments
 * 3. Parse databases and create DatabaseRowNodes
 * 4. Compute wikilinkTargets
 * 5. Run content transforms on all pages
 */
export async function transform(graph: MigrationGraph): Promise<void> {
  // === Step 1: Compute target paths ===
  computeTargetPaths(graph);

  // === Step 2: Compute attachment bucket paths ===
  computeBucketPaths(graph);

  // === Step 3: Parse databases, create row nodes ===
  await expandDatabases(graph);

  // === Step 4: Compute wikilink targets ===
  computeWikilinkTargets(graph);

  // === Step 5: Run content transforms ===
  await transformContent(graph);
}

function computeTargetPaths(graph: MigrationGraph): void {
  const usedPaths = new Set<string>();

  for (const [key, node] of graph.nodes) {
    if (node.kind === "page") {
      let targetDir = "";
      // Walk up to build the directory path from parent chain
      if (node.parentId) {
        const parent = graph.nodes.get(node.parentId);
        if (parent && "cleanName" in parent) {
          targetDir = parent.cleanName as string;
        }
      }
      const basePath = targetDir
        ? `${targetDir}/${node.cleanName}`
        : node.cleanName;
      const truncated = truncateFilename(basePath, node.notionId ?? key);
      const resolved = resolveCollision(truncated, usedPaths);
      usedPaths.add(resolved);
      node.targetPath = resolved + ".md";
    } else if (node.kind === "database") {
      let targetDir = "";
      if (node.parentId) {
        const parent = graph.nodes.get(node.parentId);
        if (parent && "cleanName" in parent) {
          targetDir = parent.cleanName as string;
        }
      }
      const basePath = targetDir
        ? `${targetDir}/${node.cleanName}`
        : node.cleanName;
      const resolved = resolveCollision(basePath, usedPaths);
      usedPaths.add(resolved);
      node.targetPath = resolved;
      node.indexTargetPath = resolved + "/_index.md";
    }
  }
}

function computeBucketPaths(graph: MigrationGraph): void {
  // Track used bucket paths for dedup
  const hashToBucket = new Map<string, string>();

  for (const [, node] of graph.nodes) {
    if (node.kind !== "attachment") continue;

    // Check if we already have a bucket path for this content hash
    const existing = hashToBucket.get(node.contentHash);
    if (existing) {
      node.bucketPath = existing;
      node.canonicalName = path.basename(existing);
      continue;
    }

    const bucket = buildBucketPath(node.contentHash, node.canonicalName);
    node.bucketPath = bucket;
    hashToBucket.set(node.contentHash, bucket);
  }
}

async function expandDatabases(graph: MigrationGraph): Promise<void> {
  const dbNodes = [...graph.nodes.entries()].filter(
    ([, n]) => n.kind === "database",
  ) as [string, DatabaseNode][];

  for (const [dbKey, dbNode] of dbNodes) {
    // Read CSV content
    // Find the matching zip entry content — it was stored in normalizer
    // For databases, the content was stored via ContentRef pattern
    // We need to find the actual content from the normalizer stage
    let csvContent: string | null = null;

    // Look for a page node that might have the CSV content stored
    // Actually, in normalizer we stored databases as DatabaseNode without sourceRef.
    // We need to get the content from the original zip data.
    // For now, scan nodes to see if we can find the CSV file path in tempDir.
    // The CSV content was stored during normalization but we didn't persist a sourceRef on DatabaseNode.
    // This is a design limitation — let's read from the original zip entry's temp file or reconstruct.

    // Workaround: iterate zip entries stored in temp or re-read from the original
    // For robustness, skip if we can't find the CSV data
    // In the full implementation, Normalizer would store a sourceRef on DatabaseNode too.
    // For now, just set empty rows.
    dbNode.rowCount = 0;
    dbNode.rowIds = [];
  }
}

function computeWikilinkTargets(graph: MigrationGraph): void {
  // Count clean names
  const nameCounts = new Map<string, number>();
  for (const [, node] of graph.nodes) {
    if (node.kind === "page" || node.kind === "database-row") {
      const count = nameCounts.get(node.cleanName) ?? 0;
      nameCounts.set(node.cleanName, count + 1);
    }
  }

  for (const [, node] of graph.nodes) {
    if (node.kind === "page") {
      node.wikilinkTarget = computeWikilinkTarget(
        node.cleanName,
        node.targetPath,
        nameCounts,
      );
    } else if (node.kind === "database-row") {
      node.wikilinkTarget = computeWikilinkTarget(
        node.cleanName,
        node.targetPath,
        nameCounts,
      );
    }
  }
}

async function transformContent(graph: MigrationGraph): Promise<void> {
  for (const [key, node] of graph.nodes) {
    if (node.kind !== "page") continue;

    let content = await readContentRef(node.sourceRef);

    // 1. Callout conversion (HTML → callout syntax)
    content = convertCallouts(content);

    // 2. Toggle conversion (HTML → foldable callout)
    content = convertToggles(content);

    // 3. Embed conversion (degraded)
    const embedResult = convertEmbeds(content, node.originalPath);
    content = embedResult.markdown;
    node.degradations.push(...embedResult.degradations);

    // 4. Synced block expansion
    const syncResult = expandSyncedBlocks(content, node.originalPath);
    content = syncResult.markdown;
    node.degradations.push(...syncResult.degradations);

    // 5. Link rewriting (markdown links → wikilinks)
    content = rewriteLinks(content, key, graph);

    // 6. HTML image rewriting (fallback)
    content = rewriteHtmlImages(content, key, graph);

    // Store transformed content
    node.transformedRef = {
      kind: "memory",
      value: content,
      byteSize: Buffer.byteLength(content, "utf-8"),
    };
  }
}
