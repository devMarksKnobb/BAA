# Security Policy

## Reporting a vulnerability

Please do not publish credentials, private migration exports, or exploitable vulnerability details in a public issue. Use GitHub's private vulnerability reporting feature if it is enabled for this repository, or contact the repository maintainer privately.

Include the affected component, impact, reproduction conditions, and any mitigations you know. Allow maintainers reasonable time to investigate before public disclosure.

## Security-sensitive areas

AIME handles content that may be confidential. Areas deserving particular care include tenant authorization, provider OAuth scopes, credential encryption and key custody, archive path validation, file writes, job ownership, sync conflict handling, and logs or reports that may contain content.

## Deployment principles

- Never commit `.env` files, provider tokens, encryption keys, or real user exports.
- Keep `AIME_MASTER_KEY` in a secrets manager and restrict access to it.
- Use HTTPS and secure cookie settings behind a trusted proxy.
- Restrict database access and use least-privilege provider scopes.
- Treat imported archives, attachments, generated reports, and logs as potentially sensitive.
- Enable GitHub secret scanning, push protection, Dependabot alerts, and code scanning where available.
