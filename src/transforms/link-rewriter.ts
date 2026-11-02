import type { MigrationGraph, GraphNode } from "../types/graph.js";
import { replaceLinks, type ExtractedLink } from "../utils/markdown-links.js";

/**
 * Rewrite all markdown links to Obsidian wikilinks.
 * Uses the edge table to map original hrefs to rewritten targets.
 */
export function rewriteLinks(
  markdown: string,
  pageKey: string,
  graph: MigrationGraph,
): string {
  // Build a map from originalHref → edge for this page's outgoing edges
  const edgeMap = new Map<string, { toId: string | null; type: string }>();
  for (const edge of graph.edges) {
    if (edge.fromId === pageKey) {
      edgeMap.set(edge.originalHref, { toId: edge.toId, type: edge.type });
    }
  }

  return replaceLinks(markdown, (link: ExtractedLink) => {
    const edge = edgeMap.get(link.href);

    // External links: keep as-is
    if (!edge || edge.type === "external") {
      return link.fullMatch;
    }

    // Unresolved links: keep original markdown
    if (!edge.toId) {
      return link.fullMatch;
    }

    const targetNode = graph.nodes.get(edge.toId);
    if (!targetNode) return link.fullMatch;

    // Attachment links
    if (targetNode.kind === "attachment") {
      const bucketPath = targetNode.bucketPath;
      if (!bucketPath) return link.fullMatch;
      if (link.isImage) {
        return `![[${bucketPath}]]`;
      }
      return `[[${bucketPath}]]`;
    }

    // Page / database-row links → wikilink
    if (targetNode.kind === "page" || targetNode.kind === "database-row") {
      const target = targetNode.wikilinkTarget;
      if (!target) return link.fullMatch;

      // Handle anchor
      const hashIdx = link.href.indexOf("#");
      if (hashIdx !== -1) {
        const anchor = link.href.slice(hashIdx + 1);
        return `[[${target}#${decodeURIComponent(anchor)}]]`;
      }

      // If the link text differs from the target name, use alias
      if (link.text && link.text !== target) {
        return `[[${target}|${link.text}]]`;
      }
      return `[[${target}]]`;
    }

    // Database links
    if (targetNode.kind === "database") {
      return `[[${targetNode.cleanName}]]`;
    }

    return link.fullMatch;
  });
}
