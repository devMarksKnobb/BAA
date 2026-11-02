/**
 * Expand Notion synced blocks.
 *
 * Notion doesn't export synced block markers in a consistent way,
 * but when present, they appear as special div elements or comments.
 * We detect them and add a source marker comment.
 *
 * For v1: content is kept inline, synchronization is not preserved.
 */

import { degradation, DEGRADED_SYNCED_EXPANDED } from "../types/degradation.js";
import type { Degradation } from "../types/degradation.js";

// Notion sometimes exports synced blocks with specific HTML markers
const SYNCED_BLOCK_REGEX =
  /<div[^>]*data-block-id="([^"]*)"[^>]*class="[^"]*synced[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;

export interface SyncedBlockResult {
  markdown: string;
  degradations: Degradation[];
}

export function expandSyncedBlocks(
  markdown: string,
  location: string,
): SyncedBlockResult {
  const degradations: Degradation[] = [];

  const result = markdown.replace(
    SYNCED_BLOCK_REGEX,
    (_match, blockId: string, content: string) => {
      degradations.push(
        degradation(
          DEGRADED_SYNCED_EXPANDED,
          `Synced block expanded (sync not preserved): ${blockId}`,
          location,
        ),
      );
      return `${content.trim()}\n<!-- synced-block:${blockId} -->`;
    },
  );

  return { markdown: result, degradations };
}
