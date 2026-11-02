import { readFile, stat } from "node:fs/promises";
import { unzipSync, type Unzipped } from "fflate";
import { type Degradation, degradation, ERROR_ZIP_ENTRY_SKIPPED } from "../types/degradation.js";

export interface ZipEntry {
  path: string;
  type: "file" | "directory";
  data: Uint8Array;
}

export interface ZipReaderResult {
  entries: ZipEntry[];
  diagnostics: Degradation[];
  zipSize: number;
}

/**
 * Check if a zip entry path is safe (no path traversal).
 */
function isSafePath(entryPath: string): boolean {
  // Reject absolute paths
  if (entryPath.startsWith("/") || /^[A-Za-z]:/.test(entryPath)) return false;
  // Reject path traversal
  const segments = entryPath.split("/");
  return !segments.some((s) => s === "..");
}

/**
 * Extract entries from an Unzipped result, handling safety checks.
 */
function extractEntries(
  unzipped: Unzipped,
  diagnostics: Degradation[],
): { entries: ZipEntry[]; totalUncompressed: number } {
  const entries: ZipEntry[] = [];
  let totalUncompressed = 0;

  for (const [entryPath, data] of Object.entries(unzipped)) {
    if (!isSafePath(entryPath)) {
      diagnostics.push(
        degradation(
          ERROR_ZIP_ENTRY_SKIPPED,
          `Unsafe path skipped: ${entryPath}`,
          entryPath,
          "error",
        ),
      );
      continue;
    }

    totalUncompressed += data.byteLength;

    const isDir = entryPath.endsWith("/");
    entries.push({
      path: entryPath,
      type: isDir ? "directory" : "file",
      data,
    });
  }

  return { entries, totalUncompressed };
}

/**
 * Check if a zip contains only nested zip files (Notion's multi-part export pattern).
 */
function isNestedZipExport(entries: ZipEntry[]): boolean {
  const files = entries.filter((e) => e.type === "file");
  return (
    files.length > 0 &&
    files.every((e) => e.path.endsWith(".zip"))
  );
}

/**
 * Read and decompress a Notion export zip file.
 * Automatically unpacks nested zips (Notion wraps large exports in Part-N.zip files).
 */
export async function readZip(zipPath: string): Promise<ZipReaderResult> {
  const diagnostics: Degradation[] = [];

  const zipBuffer = await readFile(zipPath);
  const zipSize = zipBuffer.byteLength;
  const unzipped: Unzipped = unzipSync(new Uint8Array(zipBuffer));

  let { entries, totalUncompressed } = extractEntries(unzipped, diagnostics);

  // Notion nests large exports: outer zip contains Part-1.zip, Part-2.zip, etc.
  if (isNestedZipExport(entries)) {
    const nestedFiles = entries.filter((e) => e.type === "file");
    entries = [];
    totalUncompressed = 0;

    for (const nested of nestedFiles) {
      const innerUnzipped = unzipSync(nested.data);
      const inner = extractEntries(innerUnzipped, diagnostics);
      entries.push(...inner.entries);
      totalUncompressed += inner.totalUncompressed;
    }
  }

  // Zip bomb warning
  if (zipSize > 0 && totalUncompressed > zipSize * 100) {
    diagnostics.push(
      degradation(
        "WARNING:zip-bomb-suspect",
        `Decompressed size (${totalUncompressed}) is ${Math.round(totalUncompressed / zipSize)}x the zip size (${zipSize})`,
        zipPath,
        "warning",
      ),
    );
  }

  return { entries, diagnostics, zipSize };
}
