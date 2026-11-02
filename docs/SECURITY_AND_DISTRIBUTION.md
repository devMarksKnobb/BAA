# Security, tenants, OAuth and workers

## Credential vault
`CredentialVault` encrypts credential JSON with AES-256-GCM, random 96-bit IVs, authentication tags and tenant/provider/credential ID as additional authenticated data. Set `AIME_MASTER_KEY` to a 32-byte key encoded as hex (64 characters) or base64. Generate it with a cryptographically secure secret manager; never commit it or use the example value in production. Back up the key separately from the database. Losing the key makes credentials unrecoverable. Rotate keys by decrypting and re-encrypting records during a controlled maintenance operation. Use a managed KMS/HSM for production key custody.

Tenant identifiers must come from authenticated server-side identity, never a client-supplied arbitrary tenant header. All reads and writes must include tenant scope. This module scopes vault and queue operations; it does not itself implement user authentication, organization membership, API authorization, or PostgreSQL RLS.

## OAuth
Use authorization code + PKCE S256. Persist OAuthAttempt server-side, bound to the authenticated user, tenant and browser session; delete it after callback. Call `validateOAuthCallback` before exchanging the code. Use exact registered redirect URIs, HTTPS in production, minimum scopes, state expiry and CSRF protection. Keep client secrets in a secret manager and tokens in CredentialVault. The helper does not host a callback route or implement provider-specific refresh/revocation; those must be implemented and tested per provider.

## Queue and deployment
`DurableQueue` provides durable SQLite job leases for a single host, with lease recovery and exponential retry. It is not a distributed multi-host queue: use PostgreSQL with transactional row locking (`FOR UPDATE SKIP LOCKED`) or a dedicated broker before horizontally scaling. Handlers must be idempotent and renew leases for long jobs. Never assume exactly-once delivery; use at-least-once processing with idempotency keys.

## Bidirectional sync
`decideSync` uses a common successful-sync baseline. Identical hashes are a no-op; a single changed side may flow to the unchanged side; two-sided edits, missing baseline and one-sided record presence are conflicts. Persist both baseline hashes only after destination write and verification succeed. Deletion propagation must be an explicit opt-in tombstone policy. Provider-native IDs and etags should be used for conditional writes whenever available.

## Current limitations
These building blocks do not by themselves make AIME production-ready. The Notion client is a live read/search API helper; the Google/GitHub/other OAuth providers, destination writers, refresh-token rotation, RBAC/auth middleware, tenant-bound web routes, PostgreSQL worker queue, observability/alerts and full recovery tests still need implementation. Run integration tests against disposable provider workspaces before using valuable data.
