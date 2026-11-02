import path from "node:path";
import { hashPrefix } from "./hash.js";

const MAX_FILENAME_LENGTH = 200;

/**
 * NFC-normalize a string for consistent Unicode handling.
 */
export function normalizeUnicode(s: string): string {
  return s.normalize("NFC");
}

/**
 * Clean a filename: strip illegal characters, collapse whitespace, NFC normalize.
 */
export function cleanFilename(name: string): string {
  let clean = normalizeUnicode(name);
  // Remove characters illegal on Windows/macOS
  clean = clean.replace(/[<>:"/\\|?*\x00-\x1f]/g, "");
  // Collapse whitespace
  clean = clean.replace(/\s+/g, " ").trim();
  return clean || "Untitled";
}

/**
 * Truncate a filename to MAX_FILENAME_LENGTH, appending a hash suffix if truncated.
 */
export function truncateFilename(name: string, hash?: string): string {
  if (name.length <= MAX_FILENAME_LENGTH) return name;
  const suffix = hash ? `-${hashPrefix(hash, 6)}` : "";
  return name.slice(0, MAX_FILENAME_LENGTH - suffix.length) + suffix;
}

/**
 * Resolve collision by appending -1, -2, etc.
 * Returns the first name not present in the `existing` set.
 */
export function resolveCollision(
  name: string,
  existing: Set<string>,
): string {
  if (!existing.has(name)) return name;
  let i = 1;
  while (existing.has(`${name}-${i}`)) i++;
  return `${name}-${i}`;
}

/**
 * Build an attachment bucket path: attachments/<8-char-hash>/<filename>
 */
export function buildBucketPath(
  contentHash: string,
  filename: string,
): string {
  return `attachments/${hashPrefix(contentHash)}/${filename}`;
}

/**
 * Generate a github-style heading slug.
 */
export function headingSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Check that a resolved path is within the allowed base directory.
 * Prevents path traversal attacks.
 */
export function isWithinDir(filePath: string, baseDir: string): boolean {
  const resolved = path.resolve(filePath);
  const resolvedBase = path.resolve(baseDir);
  return resolved.startsWith(resolvedBase + path.sep) || resolved === resolvedBase;
}

/**
 * Compute a unique wikilink target for a page.
 * If the cleanName is unique across the vault, use just the name.
 * If there are collisions, prefix with the parent folder.
 */
export function computeWikilinkTarget(
  cleanName: string,
  targetPath: string,
  allCleanNames: Map<string, number>,
): string {
  const count = allCleanNames.get(cleanName) ?? 0;
  if (count <= 1) return cleanName;
  // Use parent folder + name for disambiguation
  const parent = path.dirname(targetPath);
  const parentName = path.basename(parent);
  return parentName && parentName !== "." ? `${parentName}/${cleanName}` : cleanName;
}
