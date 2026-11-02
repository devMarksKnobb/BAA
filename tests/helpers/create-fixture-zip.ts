import { zipSync, type Zippable } from "fflate";

const enc = new TextEncoder();

/**
 * Create a minimal Notion export zip for testing.
 */
export function createMinimalExportZip(): Uint8Array {
  const files: Zippable = {
    "Export abc123def456abc123def456abc123de/": new Uint8Array(0),
    "Export abc123def456abc123def456abc123de/Home abc123def456abc123def456abc12300.md":
      enc.encode(
        [
          "# Home",
          "",
          "Welcome to my notes.",
          "",
          "[Go to Projects](Projects%20abc123def456abc123def456abc12301.md)",
          "",
          '![Screenshot](images/screenshot%20abc123def456abc123def456abc12310.png)',
          "",
          "## Section One",
          "",
          "Some content here.",
          "",
          "[External Link](https://example.com)",
          "",
          "[Broken Link](Missing%20Page%20abc123def456abc123def456abc123ff.md)",
        ].join("\n"),
      ),
    "Export abc123def456abc123def456abc123de/Projects abc123def456abc123def456abc12301.md":
      enc.encode(
        [
          "# Projects",
          "",
          "My project list.",
          "",
          "[Back to Home](Home%20abc123def456abc123def456abc12300.md)",
          "",
          "## Active Projects",
          "",
          "- Project Alpha",
          "- Project Beta",
        ].join("\n"),
      ),
    "Export abc123def456abc123def456abc123de/Tasks abc123def456abc123def456abc12302.csv":
      enc.encode(
        [
          "Name,Status,Due Date",
          "Fix bug,Done,2024-01-15",
          "Add feature,In Progress,2024-02-20",
          "Write docs,Not Started,2024-03-01",
        ].join("\n"),
      ),
    "Export abc123def456abc123def456abc123de/images/": new Uint8Array(0),
    "Export abc123def456abc123def456abc123de/images/screenshot abc123def456abc123def456abc12310.png":
      enc.encode("fake-png-data"),
  };

  return zipSync(files);
}

/**
 * Create a zip with path traversal attack for security testing.
 */
export function createUnsafeZip(): Uint8Array {
  const files: Zippable = {
    "normal.md": enc.encode("# Normal file"),
    "../escape.md": enc.encode("# Escaped!"),
    "subdir/../../etc/passwd": enc.encode("root:x:0:0"),
  };

  return zipSync(files);
}

/**
 * Create a zip with edge cases.
 */
export function createEdgeCaseZip(): Uint8Array {
  const longName = "A".repeat(250);
  const files: Zippable = {
    // Empty markdown
    "Empty abc123def456abc123def456abc12390.md": enc.encode(""),
    // No notion ID
    "README.md": enc.encode("# Just a readme"),
    // Unicode name
    "笔记 abc123def456abc123def456abc12391.md": enc.encode("# 中文笔记\n\n内容"),
    // Very long filename
    [`${longName} abc123def456abc123def456abc12392.md`]: enc.encode("# Long"),
    // Filename with only UUID
    " abc123def456abc123def456abc12393.md": enc.encode("# Untitled page"),
  };

  return zipSync(files);
}
