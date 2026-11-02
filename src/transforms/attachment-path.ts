import type { MigrationGraph } from "../types/graph.js";
import { replaceLinks, type ExtractedLink } from "../utils/markdown-links.js";

/**
 * Rewrite attachment references to bucket paths.
 * This is handled separately from link-rewriter because it operates
 * on already-transformed content (after link-rewriter has run).
 *
 * Note: In practice, link-rewriter already handles attachment→wikilink conversion.
 * This module exists as a fallback for any attachment references that weren't
 * caught by the edge-based rewriter (e.g., raw HTML img tags).
 */

const HTML_IMG_REGEX = /<img[^>]*src="([^"]*)"[^>]*\/?>/gi;

export function rewriteHtmlImages(
  markdown: string,
  pageKey: string,
  graph: MigrationGraph,
): string {
  // Build a map from original attachment paths to bucket paths
  const attachmentPaths = new Map<string, string>();
  for (const edge of graph.edges) {
    if (edge.fromId === pageKey && edge.toId) {
      const target = graph.nodes.get(edge.toId);
      if (target?.kind === "attachment" && target.bucketPath) {
        // Map the original href to the bucket path
        attachmentPaths.set(edge.originalHref, target.bucketPath);
      }
    }
  }

  // Replace HTML img tags with Obsidian embeds
  return markdown.replace(HTML_IMG_REGEX, (_match, src: string) => {
    const decoded = decodeURIComponent(src);
    for (const [origPath, bucketPath] of attachmentPaths) {
      if (decoded.includes(origPath) || origPath.includes(decoded)) {
        return `![[${bucketPath}]]`;
      }
    }
    // Can't resolve — keep original
    return _match;
  });
}
