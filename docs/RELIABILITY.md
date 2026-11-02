# Reliability model

AIME treats migration as a sequence of observable stages rather than a single opaque copy operation. The pipeline records job lifecycle events and stage checkpoints, validates canonical records, uses content hashes where appropriate, supports retry policies, and guards filesystem paths and writes.

## Migration behavior

- The native file-based path converts a Notion export ZIP into an Obsidian-compatible Markdown vault.
- A canonical JSONL envelope supports portable file-oriented migration and hash verification.
- SQLite WAL-backed state stores migration records, checkpoints, and audit events.
- Dry-run planning allows transformation and reporting to be inspected before destination writes.
- The report surfaces unresolved links, unsupported transformations, and other fidelity concerns.

## Recovery and consistency

A stored stage checkpoint records progress; it does not make a filesystem migration a single atomic transaction. A process can fail after a destination write and before its completion is recorded. Recovery must therefore consider the actual destination state, not merely replay every operation. Back up important destinations and review the migration report before relying on the result.

The PostgreSQL queue and sync-store modules provide additional primitives for leases, worker heartbeats, idempotency keys, persisted baselines, and recoverable write intents. External providers may not offer atomic conditional writes or exactly-once operations, so adapters must reconcile remote state when a request may have succeeded but its acknowledgement was lost.

## Content fidelity

A successful migration process does not imply semantic equivalence between source and destination. Platforms differ in permissions, comments, revision history, database behavior, formulas, embedded content, and other features. Adapter capability declarations and migration reports should make unsupported or lossy conversions explicit.

## State database

Set `AIME_STATE_DB` to choose the SQLite migration journal location. The default is `.aime/state.sqlite`. The store records migration lifecycle and stage checkpoints and exposes query methods for migration records and events.

## Operational safeguards

- Keep source exports, output vaults, reports, database files, and credentials private.
- Back up important destinations before a migration.
- Use dry-run output and reports to review intended changes.
- Keep provider scopes minimal and store encryption keys outside source control.
- Treat retries as potentially repeated remote operations unless the adapter has a provider-supported idempotency guarantee.
- Validate destination content and important relationships after a migration.
