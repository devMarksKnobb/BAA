# Contributing to AIME

Thanks for helping improve AIME. Contributions can improve migration fidelity, add a provider adapter, strengthen reliability, clarify documentation, or improve accessibility and developer experience.

## What makes a good contribution?

- Explain the user problem and the intended behavior.
- Keep provider-specific behavior inside provider adapters.
- Prefer small, focused changes with clear types and useful error messages.
- Preserve source data; make destructive behavior explicit.
- Report unsupported mappings and data-loss risks rather than silently discarding information.
- Never commit access tokens, credentials, private exports, generated databases, or customer data.

## Before opening a pull request

1. Open or reference an issue for significant changes.
2. Describe the problem, approach, and any compatibility implications.
3. Include tests or reproducible examples for behavior changes.
4. Update the relevant documentation when behavior or configuration changes.
5. Run the project's typecheck, tests, and build locally when possible.
6. Keep pull requests focused and explain any known limitations.

## Provider adapter expectations

An adapter should declare its capabilities, enumerate content safely, preserve stable source identifiers, respect provider pagination and rate limits, handle cancellation where possible, and expose unsupported features as actionable issues. Writes should be idempotent where the provider permits it. Never assume that matching titles imply matching records.

## Reporting bugs and proposing features

Use the GitHub issue templates. For security-sensitive reports, follow [SECURITY.md](SECURITY.md) rather than publishing exploit details in a public issue.

By contributing, you agree that your contribution is submitted under the repository's MIT license.
