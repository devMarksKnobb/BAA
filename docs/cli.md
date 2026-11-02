# BAA command line

The single public executable is `baa`.

```bash
baa --help
baa --version
baa setup
baa mcp
baa mcp --http
baa project targets
baa project analyze ./source-app --out ./analysis.json
baa project generate --source ./source-app --target react --out ./generated-app --name "My App"
baa project generate --target flutter --out ./mobile-app --brief "A task tracker"
baa project verify ./generated-app
```

`baa setup` opens the interactive BAA setup flow for supported MCP clients. Project commands are routed through the local deterministic generator.

`baa project analyze` inventories local regular files and emits a JSON report. `baa project generate` creates a target starter and never overwrites existing files. `baa project verify` performs structural checks only.
