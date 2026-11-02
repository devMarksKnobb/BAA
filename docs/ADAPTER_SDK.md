# Adapter SDK: current contract and extension guidance

`src/adapters/types.ts` defines typed source, destination and combined adapter interfaces. `src/core/canonical.ts` provides the versioned platform-neutral envelope for documents, collections, records, files, comments and users. Keep native identifiers in `source.nativeId`; preserve unknown provider fields in `metadata`; represent links as `relationships` and binary content as attachments with optional SHA-256.

An adapter should:
1. Declare only capabilities it actually supports.
2. Inspect source and validate destination before writes.
3. Emit explicit warnings/blockers for unsupported metadata, permission models and formatting.
4. Use stable source IDs for idempotency and content hashes for integrity checks.
5. Treat credentials as secrets and never log access tokens.
6. Make destructive operations opt-in and document what rollback can restore.
7. Add fixture-based tests for pagination, rate limits, retries, partial failures and duplicate execution.

`withRetry` is a reusable retry primitive. Configure `shouldRetry` to avoid retrying permanent errors such as authorization failures and invalid input. Respect `AbortSignal` and provider-specific `Retry-After` behavior in adapters.

## Built-in canonical JSONL bridge

AIME now provides an implemented filesystem bridge that can be used as a staging format between adapters:

```bash
# Export a vault or Markdown tree (includes binary files) to portable canonical records
 aime export-canonical ./my-vault --output ./migration.jsonl
# Import with SHA-256 checks, safe relative paths, per-file atomic replacement, and skip-on-conflict by default
 aime import-canonical ./migration.jsonl --output ./restored-vault
```

Run these commands with the `aime` executable.

Each JSONL line is one schema-versioned canonical record. Markdown content remains UTF-8 text; non-Markdown file contents are base64 encoded with a SHA-256 digest. The exporter skips symlinks and common metadata/dependency directories to avoid following paths outside the export root. The importer rejects absolute paths, traversal segments, malformed records, and content-hash mismatches. Files are staged to a unique sibling temporary file and renamed after successful verification. Existing files are skipped unless `--overwrite` is explicitly provided.

This bridge is not a substitute for native application adapters: it does not preserve app-specific permissions, comments, revision history, database semantics, or private metadata unless an upstream adapter explicitly encodes those details in canonical records. JSONL import reports invalid lines rather than silently accepting them.
