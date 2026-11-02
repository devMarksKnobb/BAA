---
name: build-anything
description: Plan, generate, inspect and verify software projects using the BAA MCP server and CLI.
metadata:
  version: "1"
---

# Build Anything (BAA)

Use BAA to create or extend software from a written brief and an existing local source project. The current BAA tool surface supports deterministic source inventory, starter generation and structural verification. BAA is a local-first MCP and CLI developer tool. It has no dashboard.

## Operating rules

- Keep the user's source project safe; generate into a separate output directory unless asked to edit in place.
- Distinguish observed, derived, inferred and confirmed requirements.
- Do not claim to have inspected media, a website, a design file or runtime behaviour unless the corresponding artifact was actually available and inspected.
- Treat APIs, authentication, persistence, permissions and business rules as unknown until supported by source, runtime evidence or trusted documentation.
- Never overwrite existing files without explicit approval.
- Run target builds, tests and runtime checks when the toolchain is available; clearly report checks that were not run.

## Workflow

1. Clarify target platform, product brief, constraints and acceptance criteria.
2. Inventory supplied source files and capture evidence only through available BAA tools/providers.
3. Build an evidence ledger with source references, confidence and limitations.
4. Produce an implementation plan and identify unresolved assumptions.
5. Generate or modify the project using the requested target stack.
6. Install dependencies only with authorization and within the project boundary.
7. Run format, type, unit, integration, build and runtime checks where available.
8. Compare output against supplied references only when an external image/runtime inspection tool is actually available.
9. Report changed files, commands run, test results, known gaps and next steps.

## BAA CLI

```bash
baa project analyze /absolute/path/to/source --out /absolute/path/to/analysis.json
baa project generate --target react --out /absolute/path/to/output --name "My App"
baa project verify /absolute/path/to/output
```

The helper supports React, Next.js, Vue, Flutter, React Native, SwiftUI, Jetpack Compose, Electron, Tauri, Unity, Unreal and Roblox starter targets. Structural verification is not a substitute for compiling, launching, testing, accessibility review or visual comparison.
