<div align="center">

# ⚡ BUILD ANYTHING

### The agent-native engineering workbench

**Understand systems. Generate projects. Inspect evidence. Verify what changed.**

[![Node.js](https://img.shields.io/badge/Node.js-22%2B-43853D?logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-first-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![MCP](https://img.shields.io/badge/MCP-enabled-6E56CF)](https://modelcontextprotocol.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

[Get started](#-get-started) · [What it does](#-what-baa-does) · [Use with agents](#-connect-an-mcp-client) · [Developer guide](#-work-on-baa) · [Safety](#-trust-and-safety)

</div>

---

## What is BAA?

**Build Anything (BAA)** is a local-first toolkit for developers and AI agents. It brings project workflows and software-inspection capabilities together behind a command-line interface and a Model Context Protocol (MCP) server.

BAA is designed to help an agent or developer move from *understanding a codebase* to *creating a project* and *checking the resulting structure*—while keeping the work inspectable and the limits of each check explicit.

> **The BAA principle:** make useful engineering actions available as bounded tools, return evidence, and never claim a check happened when it did not.

## ✨ What BAA does

| Capability | What it is for |
|---|---|
| **Project discovery** | Inspect a local source tree and produce a bounded analysis of its structure and candidates. |
| **Project generation** | Create a starter project for a supported target without silently overwriting existing files. |
| **Structural verification** | Check generated manifests and required entry files. |
| **Source and runtime inspection** | Use the repository's existing analysis and evidence tools to investigate supported software artifacts. |
| **Agent integration** | Expose tools through MCP so compatible AI clients can use BAA in their workflows. |
| **CLI workflows** | Run setup, analysis, generation and verification from a terminal. |

BAA currently includes starter targets for React, Next.js, Vue, Flutter, React Native, SwiftUI, Jetpack Compose, Electron, Tauri, Unity, Unreal and Roblox. See the project documentation for the precise capabilities and requirements of each target.

## 🚀 Get started

### Requirements

- Node.js **22.23.4+**, **24.22.1+**, or **26.12.1+**
- npm **11+**

### Install from a source checkout

```bash
git clone https://github.com/devMarksKnobb/BAA.git
cd BAA
npm ci
npm run build:cached
node scripts/baa.mjs setup
```

> If your local checkout directory has a different name, run the commands from that directory. Build BAA before starting its MCP server for the first time.

### Try the project workflow

```bash
# See available starter targets
node scripts/baa.mjs project targets

# Analyse an existing local project
node scripts/baa.mjs project analyze ./existing-project --out ./baa-analysis.json

# Generate a starter project
node scripts/baa.mjs project generate --target react --out ./new-project --name "My App"

# Check the generated project structure
node scripts/baa.mjs project verify ./new-project
```

Use `baa --help` (or `node scripts/baa.mjs --help` from a checkout) for the current command reference.

## 🤖 Connect an MCP client

Add a BAA server entry to the MCP client's configuration. Replace the example paths with absolute paths on your machine:

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

BAA supports the repository's configured MCP transports, including stdio and the documented Streamable HTTP mode. Consult the installation and MCP documentation for client-specific setup and transport details.

### Core project tools

| Tool | Purpose |
|---|---|
| `baa_project_targets` | List supported project-generation targets. |
| `baa_project_analyze` | Inventory a local source tree and extract deterministic candidates. |
| `baa_project_generate` | Generate a target-specific starter without overwriting existing files. |
| `baa_project_verify` | Check a generated manifest and required entry files. |

These project tools sit alongside BAA's broader source and runtime evidence capabilities.

## 🧭 Navigate the repository

```text
BAA/
├── .agents/       Agent instructions and reusable workflows
├── .github/       GitHub automation and contribution templates
├── assets/        Project artwork and supporting assets
├── bridge/        External-tool and platform bridges
├── docs/          Guides, architecture, references and verification records
├── examples/      Example configurations and workflows
├── native/        Native integration components
├── scripts/       CLI entry points, build and verification helpers
├── src/           Application source and domain modules
├── tests/         Automated tests and fixtures
├── third_party/   Vendored and referenced third-party projects
├── README.md      Project overview and first steps
├── CONTRIBUTING.md
├── SECURITY.md
└── package.json
```

For a deeper explanation, start with [`docs/BAA-QUICKSTART.md`](docs/BAA-QUICKSTART.md), then browse [`docs/index.md`](docs/index.md) and [`docs/architecture.mermaid`](docs/architecture.mermaid).

## 🛠️ Work on BAA

```bash
npm ci
npm run build:cached
npm run test:baa
npm run test:local
```

The focused BAA test command covers project analysis, generation and structural verification. The full suite and integrations may require additional platform tools and fixtures; read [`docs/testing.md`](docs/testing.md) and [`docs/installation.md`](docs/installation.md) before running broader checks.

Useful project references:

- [Contributing guide](CONTRIBUTING.md)
- [Architecture overview](docs/architecture.mermaid)
- [Documentation index](docs/index.md)
- [Testing guide](docs/testing.md)
- [Security policy](SECURITY.md)
- [Third-party notices](THIRD_PARTY_NOTICES.md)

## 🛡️ Trust, safety and honest verification

BAA may inspect source projects, archives, binaries and generated files. Treat all such inputs—including model output—as untrusted.

- Keep generated writes within explicit output directories.
- Review proposed changes before using them in important projects.
- Do not place secrets, credentials or private keys in source fixtures or issue reports.
- Respect licenses and terms for third-party components.
- Distinguish structural checks from compilation, execution, accessibility testing and visual validation.

**A passing structural check is not proof that an application is production-ready.** BAA should report what it actually checked, not imply that unrun checks succeeded.

## 🌍 Documentation languages

Localized introductions are available in the repository root. Choose the language that works best for you; the canonical English guide remains the reference for current commands and setup details.

| Language | README |
|---|---|
| العربية | [README_ar.md](docs/readme/README_ar.md) |
| Deutsch | [README_de.md](docs/readme/README_de.md) |
| Ελληνικά | [README_el.md](docs/readme/README_el.md) |
| English | [README.md](README.md) |
| Español | [README_es.md](docs/readme/README_es.md) |
| فارسی | [README_fa.md](docs/readme/README_fa.md) |
| Français | [README_fr.md](docs/readme/README_fr.md) |
| Bahasa Indonesia | [README_id.md](docs/readme/README_id.md) |
| Italiano | [README_it.md](docs/readme/README_it.md) |
| 日本語 | [README_ja.md](docs/readme/README_ja.md) |
| 한국어 | [README_ko.md](docs/readme/README_ko.md) |
| മലയാളം | [README_ml.md](docs/readme/README_ml.md) |
| Polski | [README_pl.md](docs/readme/README_pl.md) |
| Português (Brasil) | [README_pt-BR.md](docs/readme/README_pt-BR.md) |
| Română | [README_ro.md](docs/readme/README_ro.md) |
| Русский | [README_ru.md](docs/readme/README_ru.md) |
| ไทย | [README_th.md](docs/readme/README_th.md) |
| Türkçe | [README_tr.md](docs/readme/README_tr.md) |
| Українська | [README_uk.md](docs/readme/README_uk.md) |
| اردو | [README_ur-Latn.md](docs/readme/README_ur-Latn.md) |
| Tiếng Việt | [README_vi.md](docs/readme/README_vi.md) |
| 简体中文 | [README_zh.md](docs/readme/README_zh.md) |
| 繁體中文 | [README_zh-TW.md](docs/readme/README_zh-TW.md) |

Localized files provide translated introductions; links and command examples should be checked against the canonical guide when updating releases.

## License

BAA is released under the MIT License. See [`LICENSE`](LICENSE) and [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) for details and third-party terms.
