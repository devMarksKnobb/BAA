# BAA Engineering Map

This guide explains where to make changes without imposing risky file moves on established imports, scripts or build tooling.

## Main areas

| Area | Responsibility | Start here when… |
|---|---|---|
| `src/server/` | MCP server composition and tool registration | Adding or changing an MCP tool |
| `src/application/` | Use cases and orchestration | Changing a workflow |
| `src/domain/` | Models, validation and evidence contracts | Changing core rules or data shapes |
| `src/providers/` | External runtimes and adapters | Integrating a provider or tool |
| `src/composition/` | Runtime wiring and worker composition | Changing dependency composition |
| `src/cli/` | Terminal commands and setup | Changing CLI behaviour |
| `bridge/` | External application and platform bridges | Extending a supported integration |
| `native/` | Native components | Changing native platform support |
| `scripts/` | Build, launch and verification automation | Updating developer workflows |
| `tests/` | Automated tests and fixtures | Adding regression coverage |
| `docs/` | User, developer and verification documentation | Documenting behaviour |

## Change workflow

1. Identify the owning domain before editing.
2. Read nearby types, tests and documentation.
3. Keep inputs bounded and validate untrusted data at boundaries.
4. Preserve existing public command and tool contracts unless a deliberate migration is planned.
5. Add focused tests for new behaviour and regression cases.
6. Run the narrowest relevant test first, then broader checks when dependencies are available.
7. Document limitations and distinguish checks that ran from checks that were not run.

## Language and platform coverage

BAA is a multi-language and multi-platform inspection toolkit. Its repository includes TypeScript/JavaScript application code plus bridge and native integration areas for selected ecosystems. Actual support varies by tool, provider and host environment; do not infer that every language or platform has complete build, execution or debugging support merely because related files or third-party tools are present.

## Safe repository organization

Prefer descriptive additions under `docs/` over moving established source files. Many paths are referenced by imports, package manifests, scripts, CI workflows and third-party build instructions. Before renaming any existing file, search for all references and update tests and automation in the same change.
