import type { Degradation } from "./degradation.js";

// ===== Content reference (avoids holding large blobs in the graph) =====

export interface ContentRef {
  kind: "memory" | "temp-file";
  /** For "memory": the content string. For "temp-file": absolute path. */
  value: string;
  byteSize: number;
}

// ===== Column definition for databases =====

export type NotionColumnType =
  | "text"
  | "number"
  | "date"
  | "select"
  | "multi_select"
  | "checkbox"
  | "url"
  | "email"
  | "phone"
  | "relation"
  | "rollup"
  | "formula"
  | "file"
  | "person"
  | "unknown";

export interface ColumnDef {
  name: string;
  notionType: NotionColumnType;
  inferred: boolean;
}

// ===== Node types =====

export interface PageNode {
  kind: "page";
  notionId: string | null;
  compositeKey: string;
  originalPath: string;
  cleanName: string;
  targetPath: string;
  wikilinkTarget: string;
  parentId: string | null;
  sourceRef: ContentRef;
  transformedRef: ContentRef | null;
  frontmatter: Record<string, unknown>;
  degradations: Degradation[];
}

export interface DatabaseNode {
  kind: "database";
  notionId: string | null;
  compositeKey: string;
  originalPath: string;
  cleanName: string;
  targetPath: string;
  parentId: string | null;
  columns: ColumnDef[];
  rowCount: number;
  rowIds: string[];
  indexTargetPath: string;
  degradations: Degradation[];
}

export interface DatabaseRowNode {
  kind: "database-row";
  notionId: string | null;
  compositeKey: string;
  originalPath: string;
  cleanName: string;
  targetPath: string;
  wikilinkTarget: string;
  parentDatabaseId: string;
  properties: Record<string, unknown>;
  bodyRef: ContentRef | null;
  frontmatter: Record<string, unknown>;
  degradations: Degradation[];
}

export interface AttachmentNode {
  kind: "attachment";
  originalPath: string;
  stagedPath: string;
  contentHash: string;
  bucketPath: string;
  canonicalName: string;
  size: number;
  referencedBy: string[];
}

export interface UnresolvedRef {
  kind: "unresolved";
  originalHref: string;
  context: string;
  reason: "no-id-match" | "no-path-match" | "missing-file";
}

export type GraphNode =
  | PageNode
  | DatabaseNode
  | DatabaseRowNode
  | AttachmentNode
  | UnresolvedRef;

// ===== Edges =====

export type LinkType = "page-link" | "attachment" | "external" | "anchor";

export interface LinkEdge {
  fromId: string;
  toId: string | null;
  originalHref: string;
  rewrittenHref: string | null;
  type: LinkType;
}

// ===== Heading anchors =====

export interface HeadingAnchor {
  pageId: string;
  slug: string;
  originalText: string;
}

// ===== Top-level graph =====

export interface MigrationGraph {
  meta: {
    sourceZip: string;
    exportDate: string | null;
    startedAt: string;
    tempDir: string;
    nodeCount: number;
  };
  nodes: Map<string, GraphNode>;
  edges: LinkEdge[];
  headingAnchors: Map<string, HeadingAnchor[]>;
}

export function createEmptyGraph(
  sourceZip: string,
  tempDir: string,
): MigrationGraph {
  return {
    meta: {
      sourceZip,
      exportDate: null,
      startedAt: new Date().toISOString(),
      tempDir,
      nodeCount: 0,
    },
    nodes: new Map(),
    edges: [],
    headingAnchors: new Map(),
  };
}
