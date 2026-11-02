# Changelog

Notable changes to AIME are documented here.

## 0.4.0

- Strengthened retry handling with capped exponential backoff, full jitter, and cancellation-safe delay cleanup.
- Mark failed migration jobs as failed in the durable journal instead of leaving them in a running state.
- Close the migration journal and clean up staged files on both success and failure paths.
- Write Markdown and attachment outputs through same-directory temporary files before atomic replacement, reducing the risk of partially written destination files.
- Treat inaccessible output directories as errors rather than silently interpreting them as empty.
- Align runtime requirements with the built-in SQLite API used by the platform modules.
- Improve GitHub contribution templates, repository guidance, and Chinese-language project documentation.
