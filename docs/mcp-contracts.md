# BAA MCP tool contracts

The BAA MCP server exposes project-building tools alongside source, runtime and evidence tools used to understand existing software. The table below lists the four project-building tools.

| Tool | Purpose | Key inputs |
|---|---|---|
| `baa_project_targets` | List supported starter targets | None |
| `baa_project_analyze` | Inventory a local source tree and extract deterministic candidates | `source_directory`, optional `output_file` |
| `baa_project_generate` | Generate a target-specific starter in a new output directory | `target`, `output_directory`, optional `name`, `brief`, `source_directory` |
| `baa_project_verify` | Check the generated manifest and required entry files | `project_directory` |

## Target identifiers

`react`, `next`, `vue`, `flutter`, `react-native`, `swiftui`, `compose`, `electron`, `tauri`, `unity`, `unreal`, `roblox`.

## Evidence and limitations

Project analysis is local and deterministic. It hashes included regular files, identifies package/framework hints, extracts CSS custom-property candidates, and heuristically identifies routes and component candidates. It skips symlinks, common dependency/build directories, hidden directories and files over its per-file limit.

Generation creates starter files and a `baa/project.json` manifest. It refuses to overwrite existing files. Verification checks project structure and target entry files only; it does not install dependencies, compile, run, test accessibility, inspect runtime behavior or compare visual output.

## Transport and configuration

The default transport is MCP stdio. Streamable HTTP is available through `baa mcp --http`. The server is local-first; tool arguments are passed as process arguments without a shell. Configure the `BAA_MCP_*` environment variables only when needed.
