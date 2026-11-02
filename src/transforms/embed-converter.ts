/**
 * Convert Notion embed/bookmark blocks to degraded Obsidian callout output.
 *
 * Notion exports embeds as various patterns:
 *   - Bookmark blocks: [Title](url) with surrounding divs
 *   - Embed blocks: <figure><iframe src="url"></iframe></figure>
 *   - Generic embeds: <a href="url">...</a> inside special divs
 *
 * Output (degraded):
 *   > [!info] Notion Embed
 *   > Original link: [Title](url)
 *   > This embedded content may not display correctly in Obsidian.
 */

import { degradation, DEGRADED_EMBED_TO_LINK } from "../types/degradation.js";
import type { Degradation } from "../types/degradation.js";

// Match iframe embeds
const IFRAME_REGEX =
  /<figure>\s*<iframe[^>]*src="([^"]*)"[^>]*>.*?<\/iframe>\s*<\/figure>/gi;

// Match Notion bookmark blocks (div with bookmark class containing a link)
const BOOKMARK_REGEX =
  /<a[^>]*href="([^"]*)"[^>]*class="[^"]*bookmark[^"]*"[^>]*>[\s\S]*?<\/a>/gi;

export interface EmbedConvertResult {
  markdown: string;
  degradations: Degradation[];
}

export function convertEmbeds(
  markdown: string,
  location: string,
): EmbedConvertResult {
  const degradations: Degradation[] = [];

  let result = markdown;

  // Convert iframe embeds
  result = result.replace(IFRAME_REGEX, (_match, url: string) => {
    degradations.push(
      degradation(
        DEGRADED_EMBED_TO_LINK,
        `Embed converted to link: ${url}`,
        location,
      ),
    );
    return [
      "> [!info] Notion Embed",
      `> Original link: [${url}](${url})`,
      "> This embedded content may not display correctly in Obsidian.",
    ].join("\n");
  });

  // Convert bookmark blocks
  result = result.replace(BOOKMARK_REGEX, (_match, url: string) => {
    return `[${url}](${url})`;
  });

  return { markdown: result, degradations };
}
