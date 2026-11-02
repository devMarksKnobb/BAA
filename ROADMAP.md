# AIME implementation roadmap

## Working in this foundation
- Notion export ZIP ingestion and structural normalization.
- Page/database/attachment extraction, graph-based link resolution, Markdown transformations and Obsidian-oriented output.
- Dry-run mode, overwrite protection, progress events, migration report and unresolved-link/degradation diagnostics.
- CLI, local browser dashboard, MCP stdio tools, and typed adapter contracts.

## Next reliability milestones
1. Persist job manifests/checkpoints (SQLite or append-only journal) and resume only idempotent stages.
2. Stage destination writes into a sibling directory; verify hashes and file counts; atomically promote on success; retain rollback snapshot.
3. Add property-based fixtures for Unicode paths, duplicate titles, large exports, malformed ZIPs, symlinks and adversarial archive entries.
4. Add a hardened API service: authentication, authorization, quotas, CSRF protection, audit log, secret vault and isolated workers. Current dashboard server is local-development only.
5. Implement Notion live API and additional destination adapters behind the same contracts; capability negotiation must report permissions/history/comments/database limitations explicitly.
6. Publish adapter SDK, conformance test suite, signed adapter manifests and a community registry with sandboxed execution.

## Non-goals of v0.1
No universal semantic equivalence guarantee; no live Notion OAuth/API sync; no permission or revision-history recreation in Obsidian; no multi-tenant hosted service; no durable distributed queue. Those require platform-specific semantics and security controls and must not be implied by the adapter interface alone.
