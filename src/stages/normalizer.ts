import path from "node:path";
import { writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import type { ZipEntry } from "./zip-reader.js";
import type {
  MigrationGraph,
  PageNode,
  DatabaseNode,
  AttachmentNode,
  ContentRef,
  GraphNode,
} from "../types/graph.js";
import { createEmptyGraph } from "../types/graph.js";
import { extractNotionId, buildCompositeKey, nodeKey } from "../utils/notion-id.js";
import { normalizeUnicode, cleanFilename } from "../utils/path-utils.js";

/** Threshold above which content is written to a temp file instead of memory */
const MEMORY_THRESHOLD = 256 * 1024; // 256 KB

/**
 * Classify a file entry by its extension.
 */
function classifyEntry(
  entryPath: string,
): "page" | "database" | "attachment" {
  const ext = path.extname(entryPath).toLowerCase();
  if (ext === ".md") return "page";
  if (ext === ".csv") return "database";
  return "attachment";
}

/**
 * Create a ContentRef, choosing memory or temp-file based on size.
 */
async function createContentRef(
  data: Uint8Array,
  tempDir: string,
  filename: string,
): Promise<ContentRef> {
  if (data.byteLength <= MEMORY_THRESHOLD) {
    return {
      kind: "memory",
      value: new TextDecoder().decode(data),
      byteSize: data.byteLength,
    };
  }

  const tempPath = path.join(tempDir, `content-${Date.now()}-${filename}`);
  await writeFile(tempPath, data);
  return {
    kind: "temp-file",
    value: tempPath,
    byteSize: data.byteLength,
  };
}

/**
 * Stage attachments to tempDir, computing hash simultaneously.
 */
async function stageAttachment(
  data: Uint8Array,
  tempDir: string,
  filename: string,
): Promise<{ stagedPath: string; contentHash: string }> {
  const hash = createHash("sha256").update(data).digest("hex");
  const stagedPath = path.join(tempDir, `attachment-${hash.slice(0, 12)}-${filename}`);
  await writeFile(stagedPath, data);
  return { stagedPath, contentHash: hash };
}

/**
 * Derive parentId from the zip directory structure.
 * Looks for a parent node in the graph that corresponds to the parent directory.
 */
function findParentId(
  entryPath: string,
  graph: MigrationGraph,
): string | null {
  const parentDir = path.dirname(entryPath);
  if (!parentDir || parentDir === ".") return null;

  // Look for a page or database node that matches the parent directory
  for (const [key, node] of graph.nodes) {
    if (node.kind === "page" || node.kind === "database") {
      // The parent is a directory whose name (with Notion ID) matches
      const nodeDir = path.dirname(node.originalPath);
      const nodeBasename = path.basename(
        node.originalPath,
        path.extname(node.originalPath),
      );
      // Check if this node's file sits in the same directory as the parent dir name
      if (node.originalPath === parentDir + ".md" || node.originalPath === parentDir + ".csv") {
        return key;
      }
    }
  }

  return null;
}

/**
 * Stage 2: Normalize zip entries into a MigrationGraph.
 */
export async function normalize(
  entries: ZipEntry[],
  sourceZip: string,
  tempDir: string,
): Promise<MigrationGraph> {
  await mkdir(tempDir, { recursive: true });
  const graph = createEmptyGraph(sourceZip, tempDir);

  // First pass: create all nodes
  for (const entry of entries) {
    if (entry.type === "directory") continue;

    const normalizedPath = normalizeUnicode(entry.path);
    const filename = path.basename(normalizedPath);
    const parentDir = path.dirname(normalizedPath);
    const kind = classifyEntry(normalizedPath);

    const { notionId, cleanName, extension } = extractNotionId(filename);
    const cleanedName = cleanFilename(cleanName);
    const compositeKey = buildCompositeKey(parentDir, cleanedName);
    const key = nodeKey(notionId, compositeKey);

    if (kind === "page") {
      const sourceRef = await createContentRef(entry.data, tempDir, filename);
      const node: PageNode = {
        kind: "page",
        notionId,
        compositeKey,
        originalPath: normalizedPath,
        cleanName: cleanedName,
        targetPath: "", // set by Transformer
        wikilinkTarget: "", // set by Transformer
        parentId: null, // set in second pass
        sourceRef,
        transformedRef: null,
        frontmatter: {},
        degradations: [],
      };
      graph.nodes.set(key, node);
    } else if (kind === "database") {
      const sourceRef = await createContentRef(entry.data, tempDir, filename);
      // Read CSV content for column parsing
      const csvContent =
        sourceRef.kind === "memory"
          ? sourceRef.value
          : new TextDecoder().decode(entry.data);

      // Parse just the header to get columns (full parsing in Transformer)
      const firstLine = csvContent.split("\n")[0] ?? "";
      const headers = firstLine.split(",").map((h) => h.trim().replace(/^"|"$/g, ""));

      const node: DatabaseNode = {
        kind: "database",
        notionId,
        compositeKey,
        originalPath: normalizedPath,
        cleanName: cleanedName,
        targetPath: "", // set by Transformer
        parentId: null, // set in second pass
        columns: headers
          .filter((h) => h.length > 0)
          .map((h) => ({
            name: h,
            notionType: "text" as const,
            inferred: true,
          })),
        rowCount: 0,
        rowIds: [],
        indexTargetPath: "",
        degradations: [],
      };
      graph.nodes.set(key, node);
    } else {
      // Attachment
      const { stagedPath, contentHash } = await stageAttachment(
        entry.data,
        tempDir,
        cleanedName + extension,
      );
      const node: AttachmentNode = {
        kind: "attachment",
        originalPath: normalizedPath,
        stagedPath,
        contentHash,
        bucketPath: "", // set by Transformer
        canonicalName: cleanedName + extension,
        size: entry.data.byteLength,
        referencedBy: [],
      };
      graph.nodes.set(key, node);
    }
  }

  // Second pass: resolve parent-child relationships
  for (const [key, node] of graph.nodes) {
    if (node.kind === "page" || node.kind === "database") {
      node.parentId = findParentId(node.originalPath, graph);
    }
  }

  graph.meta.nodeCount = graph.nodes.size;
  return graph;
}
