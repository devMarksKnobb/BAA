# BAA Plugin Ecosystem

This is a **registry and manifest starter**, not a claim that every listed integration is implemented.

- `registry.json`: discovery index.
- `schema.json`: JSON Schema for plugin manifests.
- `providers/`: AI provider and coding-assistant entries.
- `integrations/`: MCP, source-control, editor and local-tool entries.
- `templates/`: starting points for custom plugins.

## Status
- `available`: an integration point is documented in BAA; client-specific adapters may still need work.
- `planned`: manifest/example only; runtime implementation and tests are required.
- `experimental`: prototype requiring review.

## Security
All plugins are disabled by default. Manifests describe capabilities; they do not grant permissions. A future loader should validate manifests, require explicit approval, scope file access to the selected workspace, and never run arbitrary commands automatically. Keep credentials out of manifests and source control; use environment variables or a secure secret store.

## ChatGPT and AI tools
ChatGPT, the OpenAI API, Codex, Claude, Gemini, Copilot, Cursor, Windsurf, Ollama and LM Studio are distinct integration targets. Use documented APIs, supported MCP interfaces and user-authorized connections only. This registry does not provide access to private product internals.

## Add a plugin
1. Copy a file from `templates/`.
2. Give it a unique lowercase `id`.
3. Define its protocol, capabilities and minimum permissions.
4. Add its path to `registry.json`.
5. Implement the adapter and tests in BAA.
6. Mark it `available` only after it has been implemented and verified.

Suggested next steps: implement manifest loading/schema validation, then `baa plugin list`, `inspect`, `validate`, `enable` and `disable` commands.
