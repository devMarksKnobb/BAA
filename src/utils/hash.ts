import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";

/**
 * Compute SHA-256 hex digest of a Buffer.
 */
export function sha256(data: Buffer | Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

/**
 * Compute SHA-256 hex digest of a file via streaming.
 */
export async function sha256File(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", reject);
  });
}

/**
 * Get the first N characters of a SHA-256 hash for bucket paths.
 */
export function hashPrefix(hash: string, length = 8): string {
  return hash.slice(0, length);
}
