# AIME platform services and production deployment

This repository now includes concrete service modules for password-based identity, organization memberships and RBAC, encrypted provider credentials, OAuth authorization/callback/refresh/revocation, Google Drive API operations, PostgreSQL queue leasing/heartbeats/checkpoints, and persisted PostgreSQL sync baselines/write intents.

## Authentication and tenant boundaries

- `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`
- `GET/POST/PATCH/DELETE /api/auth/members` (member administration; add by registered email)
- `GET /api/auth/audit` (owner/admin)
- `GET /api/tenants/:tenantId/connections`
- `POST /api/tenants/:tenantId/connections/:provider/authorize`
- `DELETE /api/tenants/:tenantId/connections/:connectionId`
- OAuth callback: `/oauth/callback/notion` or `/oauth/callback/google-drive`

For users in more than one organization, send `X-AIME-Tenant: <tenant-id>` or use a bearer session token with that header. A membership lookup is performed against that tenant; non-member tenant IDs are returned as not found. Roles: owner, admin, operator, viewer. API cookies are HttpOnly and SameSite=Strict. Deploy behind HTTPS; use secure cookies in production. Passwords are scrypt-hashed; session tokens are stored as SHA-256 digests.

## Provider setup

Set `AIME_MASTER_KEY` to a random 32-byte key (base64 or 64-character hex), then configure provider OAuth credentials and exact redirect URIs. Keep the master key in a secrets manager, never in source control. The built-in SQLite vault encrypts each credential using AES-256-GCM with tenant/provider/credential scope as authenticated data. This is application-level encryption, not a substitute for KMS/HSM key custody or key rotation. Back up the vault and key together under a controlled recovery process.

Google Drive access requests read-only scopes. The connector supports list, metadata read, download/export, create, conditional update and delete. A Google Drive write is only safe when the caller supplies and checks a baseline version/ETag. Notion supports live API read/export, child-page create, append-block, title update and archive operations plus OAuth connection. Notion does not expose an atomic If-Match condition for page edits, so the connector checks last-edited time before mutation but cannot eliminate the race between the check and the write. Remote revocation is not implemented where the provider has no supported revocation endpoint.

## PostgreSQL workers

`PostgresJobQueue` and `PostgresSyncStore` accept a structural node-postgres-compatible pool. Install `pg` in the deployment host, construct a `pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: ... })`, and inject it. Call `await queue.migrate()` and `await syncStore.migrate()` at deploy/migration time. Do not run schema migration concurrently from every worker in production. `FOR UPDATE SKIP LOCKED` leasing, lease expiration, heartbeats, checkpoint storage, retry backoff, idempotency keys and event records are implemented. Workers should use stable idempotency keys at external write boundaries; provider APIs can still fail after a remote write and before AIME records completion, so adapters must reconcile remote state before replaying a prepared intent.

## Bidirectional synchronization

`PostgresSyncStore` persists per-tenant/per-sync/per-record source and destination hashes, provider versions, deletion markers and prepared write intents. `syncWithBaseline` orchestrates reads, baseline comparison, explicit conflict/deletion policy, prepared intents, conditional adapter writes and post-write verification. The policy in `src/sync/engine.ts` refuses to guess when there is no baseline or both sides changed. Deletion is intentionally not propagated implicitly. A production sync handler must: (1) read both sides and provider-native versions, (2) compare against the persisted baseline, (3) enforce the configured deletion policy, (4) persist a prepared intent, (5) use conditional provider writes, (6) re-read/verify both sides, and (7) commit the new baseline. Recovery should reconcile `recoverableWrites()` against the providers before retrying.

## Hardening checklist before internet exposure

- Put the service behind TLS and a reverse proxy with request-size/time limits and rate limiting on login/register/OAuth initiation.
- Disable open self-registration or add email verification, invitations and abuse controls for your deployment.
- Use a managed PostgreSQL instance, least-privilege DB role, TLS, backups, point-in-time recovery and migrations in a controlled release step.
- Move master-key custody to KMS/HSM and implement rotation/rewrapping, session rotation, account recovery, MFA/SSO and retention controls for your threat model.
- Add a CSRF token/origin policy for any state-changing cookie-authenticated browser UI and configure allowed origins explicitly.
- Test provider scopes, quotas, refresh token rotation, deletion behavior and restore/replay in a staging tenant before production.

The code is a stronger deployable foundation, not a certification that every provider feature, deployment configuration, or threat-model control is production-complete. Run typecheck, full tests, migration tests and real provider contract tests in CI with dependencies and credentials configured before release.
