import path from "node:path";

/**
 * Regex to match a 32-char hex Notion ID at the end of a filename (before extension).
 * Examples:
 *   "My Page abc123def456abc123def456abc123de.md"  → captures the 32-hex-char ID
 *   "My Page abc123def456abc123def456abc123de"      → captures (no extension)
 *   "image abc123def456abc123def456abc123de.png"    → captures
 */
const NOTION_ID_REGEX = / ([a-f0-9]{32})(?:\.\w+)?$/;

/**
 * Alternate: ID might be separated by space from the name, potentially URL-encoded in the zip.
 * Some exports use %20 instead of spaces.
 */
const NOTION_ID_REGEX_ENCODED = /%20([a-f0-9]{32})(?:\.\w+)?$/;

export interface IdExtractionResult {
  notionId: string | null;
  cleanName: string;
  extension: string;
}

/**
 * Extract a Notion ID from a filename (basename, not full path).
 * Returns the ID if found, plus the clean human-readable name.
 */
export function extractNotionId(filename: string): IdExtractionResult {
  const ext = path.extname(filename);
  const base = ext ? filename.slice(0, -ext.length) : filename;

  // Try space-separated ID
  const match = filename.match(NOTION_ID_REGEX);
  if (match) {
    const id = match[1];
    const cleanBase = base.replace(` ${id}`, "").trim();
    return {
      notionId: id,
      cleanName: cleanBase || `Untitled-${id.slice(0, 8)}`,
      extension: ext,
    };
  }

  // Try URL-encoded space
  const matchEncoded = filename.match(NOTION_ID_REGEX_ENCODED);
  if (matchEncoded) {
    const id = matchEncoded[1];
    const cleanBase = base.replace(`%20${id}`, "").trim();
    return {
      notionId: id,
      cleanName: cleanBase || `Untitled-${id.slice(0, 8)}`,
      extension: ext,
    };
  }

  // No ID found
  return {
    notionId: null,
    cleanName: base.trim() || "Untitled",
    extension: ext,
  };
}

/**
 * Build a composite key from parent directory path and clean filename.
 * Used as fallback when notionId is not available.
 */
export function buildCompositeKey(
  parentDir: string,
  cleanName: string,
): string {
  const normalized = parentDir
    .split("/")
    .filter(Boolean)
    .map((seg) => extractNotionId(seg).cleanName)
    .join("/");
  return normalized ? `${normalized}/${cleanName}` : cleanName;
}

/**
 * Determine the node key: notionId if available, otherwise compositeKey.
 */
export function nodeKey(
  notionId: string | null,
  compositeKey: string,
): string {
  return notionId ?? `composite:${compositeKey}`;
}
