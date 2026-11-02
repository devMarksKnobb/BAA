import path from "node:path";
import { readFile } from "node:fs/promises";
import type {
  MigrationGraph,
  LinkEdge,
  HeadingAnchor,
  GraphNode,
  ContentRef,
} from "../types/graph.js";
import type { Degradation } from "../types/degradation.js";
import { degradation, ERROR_UNRESOLVED_LINK } from "../types/degradation.js";
import { extractNotionId } from "../utils/notion-id.js";
import { headingSlug } from "../utils/path-utils.js";
import { extractLinks, extractHeadings } from "../utils/markdown-links.js";

/**
 * Read content from a ContentRef.
 */
async function readContentRef(ref: ContentRef): Promise<string> {
  if (ref.kind === "memory") return ref.value;
  return readFile(ref.value, "utf-8");
}

/**
 * Build lookup tables for link resolution.
 */
function buildLookupTables(graph: MigrationGraph) {
  // notionId → node key
  const idToKey = new Map<string, string>();
  // original path (without leading slash) → node key
  const pathToKey = new Map<string, string>();
  // cleanName (lowercase) → node keys (for fuzzy matching)
  const nameToKeys = new Map<string, string[]>();

  for (const [key, node] of graph.nodes) {
    if (node.kind === "unresolved") continue;

    if ("notionId" in node && node.notionId) {
      idToKey.set(node.notionId, key);
    }

    if ("originalPath" in node) {
      pathToKey.set(node.originalPath, key);
      // Also register without the extension for link matching
      const ext = path.extname(node.originalPath);
      if (ext) {
        pathToKey.set(node.originalPath.slice(0, -ext.length), key);
      }
    }

    if ("cleanName" in node) {
      const lower = (node.cleanName as string).toLowerCase();
      const existing = nameToKeys.get(lower) ?? [];
      existing.push(key);
      nameToKeys.set(lower, existing);
    }
  }

  return { idToKey, pathToKey, nameToKeys };
}

/**
 * Resolve a link href to a node key.
 */
function resolveHref(
  href: string,
  fromPath: string,
  lookups: ReturnType<typeof buildLookupTables>,
): { targetKey: string | null; anchor: string | null } {
  // Skip external links
  if (/^https?:\/\//.test(href) || href.startsWith("mailto:")) {
    return { targetKey: null, anchor: null };
  }

  // Split off anchor
  let anchor: string | null = null;
  let cleanHref = href;
  const hashIdx = href.indexOf("#");
  if (hashIdx !== -1) {
    anchor = href.slice(hashIdx + 1);
    cleanHref = href.slice(0, hashIdx);
  }

  // URL-decode
  const decoded = decodeURIComponent(cleanHref);

  // Try to extract notion ID from the href
  const basename = path.basename(decoded);
  const { notionId } = extractNotionId(basename);
  if (notionId && lookups.idToKey.has(notionId)) {
    return { targetKey: lookups.idToKey.get(notionId)!, anchor };
  }

  // Try resolving as relative path from source file
  const fromDir = path.dirname(fromPath);
  const resolved = path.join(fromDir, decoded);
  const normalizedResolved = path.normalize(resolved);

  if (lookups.pathToKey.has(normalizedResolved)) {
    return { targetKey: lookups.pathToKey.get(normalizedResolved)!, anchor };
  }

  // Try just the decoded href directly
  if (lookups.pathToKey.has(decoded)) {
    return { targetKey: lookups.pathToKey.get(decoded)!, anchor };
  }

  // Try name-based fuzzy match (last resort)
  const nameWithoutExt = path.basename(decoded, path.extname(decoded));
  const { cleanName } = extractNotionId(nameWithoutExt);
  const candidates = lookups.nameToKeys.get(cleanName.toLowerCase());
  if (candidates && candidates.length === 1) {
    return { targetKey: candidates[0], anchor };
  }

  // Could not resolve
  return { targetKey: null, anchor };
}

/**
 * Determine the link type.
 */
function classifyLink(
  href: string,
  targetNode: GraphNode | undefined,
  isImage: boolean,
): LinkEdge["type"] {
  if (/^https?:\/\//.test(href) || href.startsWith("mailto:")) return "external";
  if (targetNode?.kind === "attachment" || isImage) return "attachment";
  if (href.includes("#")) return "anchor";
  return "page-link";
}

/**
 * Stage 3: Resolve links between nodes, build edges, extract headings.
 */
export async function linkGraph(graph: MigrationGraph): Promise<void> {
  const lookups = buildLookupTables(graph);

  for (const [key, node] of graph.nodes) {
    if (node.kind !== "page") continue;

    const content = await readContentRef(node.sourceRef);

    // Extract headings for anchor targets
    const headings = extractHeadings(content);
    if (headings.length > 0) {
      const anchors: HeadingAnchor[] = headings.map((h) => ({
        pageId: key,
        slug: headingSlug(h.text),
        originalText: h.text,
      }));
      graph.headingAnchors.set(key, anchors);
    }

    // Extract and resolve links
    const links = extractLinks(content);
    for (const link of links) {
      const { targetKey, anchor } = resolveHref(
        link.href,
        node.originalPath,
        lookups,
      );

      const isExternal =
        /^https?:\/\//.test(link.href) || link.href.startsWith("mailto:");

      if (isExternal) {
        graph.edges.push({
          fromId: key,
          toId: null,
          originalHref: link.href,
          rewrittenHref: null,
          type: "external",
        });
        continue;
      }

      const targetNode = targetKey ? graph.nodes.get(targetKey) : undefined;
      const linkType = classifyLink(link.href, targetNode, link.isImage);

      if (targetKey) {
        // Track references for attachments
        if (targetNode?.kind === "attachment") {
          targetNode.referencedBy.push(key);
        }

        graph.edges.push({
          fromId: key,
          toId: targetKey,
          originalHref: link.href,
          rewrittenHref: null, // set by Transformer
          type: linkType,
        });
      } else {
        // Unresolved link
        graph.edges.push({
          fromId: key,
          toId: null,
          originalHref: link.href,
          rewrittenHref: null,
          type: linkType,
        });

        node.degradations.push(
          degradation(
            ERROR_UNRESOLVED_LINK,
            `Could not resolve link: ${link.href}`,
            `${node.originalPath}:${link.index}`,
            "warning",
          ),
        );
      }
    }
  }
}
