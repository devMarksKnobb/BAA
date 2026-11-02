# AIME connector expansion strategy

## Research-informed design

AIME should not attempt to hand-maintain hundreds of unrelated API clients. Mature connector ecosystems demonstrate the leverage of standard connector contracts and independently versioned connectors. Airbyte documents its MCP integration as a way for AI agents to interact with connector-backed data sources, and describes connectors as the component that communicates with third-party systems ([Airbyte MCP docs](https://docs.airbyte.com/platform/airbyte-mcp)). Airbyte's current comparison material describes a broad connector catalogue and custom connector tooling ([Airbyte vs. Meltano](https://airbyte.com/compare/meltano-vs-airbyte)). These are useful design references, not dependencies and not evidence that AIME supports those connectors.

## Adapter tiers

1. **Local formats** — Markdown folders, canonical JSONL, CSV, JSON, ZIP bundles. These can be implemented and tested without third-party credentials.
2. **Content workspaces** — Notion API/export, Obsidian filesystem, Evernote exports, Confluence, Google Drive, Dropbox, WordPress. Each requires its own pagination, attachments, metadata, permission and rate-limit semantics.
3. **Engineering workspaces** — GitHub/GitLab repositories and issues, Jira/Linear projects and tickets. Preserve immutable IDs as source metadata; translate cross-system references into canonical relationships and report unsupported fields.
4. **Databases** — PostgreSQL, MySQL and MongoDB. Use snapshot consistency, key/constraint introspection, bounded batches, explicit schema mapping and transaction-aware writes. Large databases need database-native incremental/CDC strategies rather than a generic page iterator.
5. **Specialist systems** — Cloud object stores, CRM, ticketing, knowledge bases and custom REST/GraphQL services through a separately sandboxed adapter SDK.

## Connector contract requirements

Every connector must declare: version and compatibility range; read/write capabilities; stable native ID rules; pagination and rate limits; incremental cursor support; attachment handling; permission fidelity; transaction semantics; idempotency strategy; and verification method. Planning must fail closed for destructive or unsupported operations unless the user explicitly approves a documented downgrade. A connector is not marked production-ready until it has contract tests, pagination tests, rate-limit tests, fault-injection/resume tests, data-integrity tests, and an end-to-end fixture or disposable-account test.

## Canonical archive bridge currently implemented

`src/adapters/canonical-jsonl.ts` adds an executable Markdown/filesystem ↔ canonical JSONL path. It includes stable relative-path IDs, SHA-256 digests, binary attachment encoding, symlink exclusion, path traversal rejection, integrity checks, per-file temporary writes/rename, and skip-on-conflict behavior. It is a useful staging bridge, not a claim of native support for SaaS APIs or database migration.

```bash
npm run build
node dist/index.js export-canonical ./my-vault --output ./archive.jsonl
node dist/index.js import-canonical ./archive.jsonl --output ./restored-vault
node dist/index.js import-canonical ./archive.jsonl --output ./restored-vault --overwrite
```

## Security and deployment gates

- Keep the bundled dashboard loopback-only unless proper authentication, CSRF protections, tenant isolation, quotas, audit retention and TLS are added.
- Never accept credentials in URLs or log them. Use a secret store or OS-protected credential provider; encrypted-at-rest application storage requires managed key rotation and must not store its key beside ciphertext.
- Run third-party adapters in a separate process/container with least-privilege credentials, explicit network egress, filesystem allowlists, CPU/memory/time limits and signed/version-pinned packages.
- A rollback is only safe when the destination supports transactions or AIME has a verified preimage/backup. Never promise rollback for external side effects that cannot be reversed.
- Treat model-generated mappings as proposals. Require schema validation, confidence/limitations, deterministic replay, and human approval for lossy or permission-sensitive transformations.

## Known gaps in this build

Native API connectors for the services listed above, PostgreSQL state backend, production OAuth/RBAC, encrypted credential vault, general transactional destination protocol, distributed workers, AI provider integration, two-way conflict resolution, and multi-tenant deployment are not implemented by the canonical bridge. The existing Notion ZIP → Obsidian path remains the only native application migration pipeline in this build.
