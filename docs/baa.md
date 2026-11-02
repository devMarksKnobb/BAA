# Build Anything (BAA) architecture

BAA is the product identity. The repository uses a modular MCP + CLI architecture: a local tool server, typed contracts, application orchestration, providers, and verification workflows. It does not ship a dashboard.

```text
Agent / developer
      |
      +---- BAA CLI
      |
      +---- BAA MCP server (stdio / Streamable HTTP)
                    |
             Tool registration
                    |
          Application orchestration
                    |
       Domain contracts and evidence
                    |
       Provider / runtime adapters
                    |
     Project artifacts + verification
```

## Repository layout

- `src/server/`: MCP server composition and tool registration.
- `src/application/`: orchestration and application services.
- `src/domain/`: domain contracts and evidence models.
- `src/providers/`, `src/composition/`: integrations and adapters.
- `src/cli/`: terminal commands and setup flows.
- `scripts/`: BAA launchers, build helpers and verification automation.
- `bridge/`, `native/`: optional platform/native adapters.
- `docs/`: architecture, contracts, installation and workflow documentation.
- `.agents/skills/`: BAA agent operating instructions.

## Project commands

The `baa` CLI provides bounded local source inventory, starter generation and structural verification.

```bash
baa project targets
baa project analyze ./source --out ./baa-analysis.json
baa project generate --target react --out ./new-app --name "My App"
baa project verify ./new-app
```

Supported starter targets: React, Next.js, Vue, Flutter, React Native, SwiftUI, Jetpack Compose, Electron, Tauri, Unity, Unreal and Roblox. These are starter scaffolds. Structural verification does not establish that an application compiles, runs, meets accessibility requirements or matches a visual reference.

## Development

```bash
npm ci
npm run build:cached
npm run test:baa
```
