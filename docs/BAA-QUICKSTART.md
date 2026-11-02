# BAA Quickstart

A practical first run for Build Anything (BAA).

## 1. Check your environment

```bash
node --version
npm --version
```

BAA's package metadata currently requires Node.js 22.23.4+, 24.22.1+, or 26.12.1+, with npm 11+.

## 2. Install and build

```bash
npm ci
npm run build:cached
```

## 3. Run setup

```bash
node scripts/baa.mjs setup
```

Use the absolute path to `scripts/baa.mjs` when configuring an MCP client. Build the runtime before the first server launch.

## 4. Explore project workflows

```bash
node scripts/baa.mjs project targets
node scripts/baa.mjs project analyze ./sample-project --out ./baa-analysis.json
node scripts/baa.mjs project generate --target react --out ./generated-app --name "Sample App"
node scripts/baa.mjs project verify ./generated-app
```

Use a destination that does not contain work you need to preserve. Review generated files before building on them.

## 5. Connect an MCP client

```json
{
  "mcpServers": {
    "baa": {
      "command": "node",
      "args": ["/absolute/path/to/BAA/scripts/baa.mjs", "mcp"],
      "cwd": "/absolute/path/to/BAA"
    }
  }
}
```

The exact configuration location depends on your MCP client. See the installation documentation for client-specific guidance.

## 6. Run focused checks

```bash
npm run test:baa
```

For broader test coverage, platform prerequisites and fixtures, consult [`testing.md`](testing.md).

## Next steps

- [Documentation index](index.md)
- [Architecture diagram](architecture.mermaid)
- [Contributing](../CONTRIBUTING.md)
- [Security policy](../SECURITY.md)
