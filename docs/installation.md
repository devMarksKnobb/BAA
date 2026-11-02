# Installation and MCP setup

BAA is a local-first CLI and MCP server. It does not install a dashboard or modify an agent configuration automatically.

## Requirements

- Node.js 22.23.4+ or 24.22.1+ (or 26.12.1+)
- npm 11+

## Install from a source checkout

```bash
npm ci
npm run build:cached
```

## Connect an MCP client

Run `baa setup` after installing the package, or `node scripts/baa.mjs setup` from a source checkout. BAA offers an interactive setup flow for supported MCP clients. It can also be configured manually using the JSON registration below.

Example local registration:

```json
{
  "mcpServers": {
    "baa": {
      "command": "node",
      "args": ["/absolute/path/to/build-anything/scripts/baa.mjs", "mcp"],
      "cwd": "/absolute/path/to/your/project"
    }
  }
}
```

The setup flow writes the selected client configuration. For manual setup, replace the example path with the absolute path to your BAA checkout or global package entrypoint, then restart the MCP client.

## Run the server directly

```bash
baa mcp
```

The default transport is stdio. `baa mcp --http` starts the documented Streamable HTTP transport; bind and allowed-host settings are controlled by the `BAA_MCP_*` environment variables described in the MCP contract guide.

## Verify the installation

```bash
baa --version
baa --help
baa project targets
```

If the compiled runtime is missing in a source checkout, run `npm ci && npm run build:cached`, then restart the MCP client.
