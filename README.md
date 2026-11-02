<div align="center">

# Build Anything (BAA)

### An agent-native toolkit for understanding, creating and verifying software.

**One BAA MCP server. One CLI. A modular workflow from project evidence to implementation.**

[Quick start](#quick-start) · [MCP server](#mcp-server) · [CLI](#command-line) · [Architecture](#architecture) · [Localized READMEs](#localized-readmes)

</div>

Build Anything (BAA) is a local-first developer tool for AI agents and humans. It provides one MCP server and one CLI for bounded local source analysis, target-specific starter generation, and structural project verification. The codebase follows a mature tool-server architecture: typed MCP contracts, CLI orchestration, domain boundaries, provider composition, evidence handling, tests and documentation.

BAA is a terminal/MCP tool, **not a dashboard**.

## Quick start

Requirements: Node.js 22.23.4+ or 24.22.1+ (or 26.12.1+), and npm 11+.

```bash
npm ci
npm run build:cached
node scripts/baa.mjs setup
```

For a local source checkout, configure the MCP client with the absolute path to the BAA launcher.

## MCP server

```json
{
  "mcpServers": {
    "baa": {
      "command": "node",
      "args": ["/absolute/path/to/build-anything/scripts/baa.mjs", "mcp"],
      "cwd": "/absolute/path/to/build-anything"
    }
  }
}
```

The server supports the repository's existing MCP transport architecture, including stdio and the documented Streamable HTTP mode. Build the runtime before first launch.

The BAA project workflow adds four MCP tools:

- `baa_project_targets` — list the supported generation targets.
- `baa_project_analyze` — inventory a local source tree and extract deterministic candidates.
- `baa_project_generate` — create a target-specific starter without overwriting existing files.
- `baa_project_verify` — check the generated manifest and required entry files.

These sit alongside BAA's source/runtime evidence tools, so agents can inspect an existing system before generating or extending a project.

## Command line

The single public executable is `baa`; it provides setup, MCP, project analysis, generation and verification commands.

```bash
baa --help
baa project targets
baa project analyze ./existing-project --out ./baa-analysis.json
baa project generate --target react --out ./new-project --name "My App"
baa project verify ./new-project
```

BAA currently supports React, Next.js, Vue, Flutter, React Native, SwiftUI, Jetpack Compose, Electron, Tauri, Unity, Unreal and Roblox starter targets. Analysis is bounded and local. Structural verification does not claim to compile, run, accessibility-test or visually validate generated applications.

## Architecture and repository layout

- `src/server/` — MCP server composition and typed tool registration.
- `src/application/` — application services and orchestration.
- `src/domain/` — domain models, validation and evidence contracts.
- `src/providers/` and `src/composition/` — external runtimes and adapters.
- `src/cli/` — terminal commands and setup flows.
- `scripts/` — BAA launchers, build helpers and verification automation.
- `bridge/` and `native/` — optional platform/native integrations.
- `docs/` — installation, architecture, contracts and workflow references.
- `.agents/skills/` — BAA agent workflow instructions.

The MCP boundary, CLI, application services, domain contracts and providers remain separate. New capabilities should be added as typed tools with bounded inputs, explicit output/evidence contracts, tests and documentation—not as UI pages.

## Development and tests

```bash
npm ci
npm run build:cached
npm run test:baa
npm run test:local
```

`test:baa` covers BAA project analysis, generation and structural verification. The complete repository test suite and external integrations require their documented platform tools and fixtures; consult `docs/testing.md` and `docs/installation.md`.

## Safety and verification

Treat source projects, archives, binaries, model output and generated files as untrusted. Keep generated writes inside explicit output directories, avoid overwriting user files, distinguish observed facts from inferred/generated content, and report which checks actually ran. Passing structural checks is not proof that an application is production-ready.

## Localized READMEs

Localized BAA introductions are available in [`docs/readme/`](docs/readme/). They link to this canonical guide for complete installation, MCP configuration and development instructions.

## License

MIT. See [LICENSE](LICENSE) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for third-party components and their terms.
