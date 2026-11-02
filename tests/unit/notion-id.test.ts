import { describe, it, expect } from "vitest";
import {
  extractNotionId,
  buildCompositeKey,
  nodeKey,
} from "../../src/utils/notion-id.js";

describe("extractNotionId", () => {
  it("extracts 32-char hex ID from .md filename", () => {
    const result = extractNotionId(
      "My Page abc123def456abc123def456abc123de.md",
    );
    expect(result.notionId).toBe("abc123def456abc123def456abc123de");
    expect(result.cleanName).toBe("My Page");
    expect(result.extension).toBe(".md");
  });

  it("extracts ID from filename without extension", () => {
    const result = extractNotionId(
      "Folder Name abc123def456abc123def456abc123de",
    );
    expect(result.notionId).toBe("abc123def456abc123def456abc123de");
    expect(result.cleanName).toBe("Folder Name");
    expect(result.extension).toBe("");
  });

  it("extracts ID from image filename", () => {
    const result = extractNotionId(
      "screenshot abc123def456abc123def456abc123de.png",
    );
    expect(result.notionId).toBe("abc123def456abc123def456abc123de");
    expect(result.cleanName).toBe("screenshot");
    expect(result.extension).toBe(".png");
  });

  it("handles URL-encoded spaces (%20)", () => {
    const result = extractNotionId(
      "My%20Page%20abc123def456abc123def456abc123de.md",
    );
    expect(result.notionId).toBe("abc123def456abc123def456abc123de");
    expect(result.cleanName).toBe("My%20Page");
    expect(result.extension).toBe(".md");
  });

  it("returns null notionId when no ID present", () => {
    const result = extractNotionId("README.md");
    expect(result.notionId).toBeNull();
    expect(result.cleanName).toBe("README");
    expect(result.extension).toBe(".md");
  });

  it("returns null for short hex that is not 32 chars", () => {
    const result = extractNotionId("Page abc123.md");
    expect(result.notionId).toBeNull();
    expect(result.cleanName).toBe("Page abc123");
  });

  it("handles Unicode filenames", () => {
    const result = extractNotionId(
      "笔记页面 abc123def456abc123def456abc123de.md",
    );
    expect(result.notionId).toBe("abc123def456abc123def456abc123de");
    expect(result.cleanName).toBe("笔记页面");
  });

  it("handles filename that is only UUID", () => {
    const result = extractNotionId(
      " abc123def456abc123def456abc123de.md",
    );
    expect(result.notionId).toBe("abc123def456abc123def456abc123de");
    expect(result.cleanName).toBe("Untitled-abc123de");
  });

  it("handles empty filename gracefully", () => {
    const result = extractNotionId("");
    expect(result.notionId).toBeNull();
    expect(result.cleanName).toBe("Untitled");
  });

  it("handles filename with multiple spaces before ID", () => {
    const result = extractNotionId(
      "My  Great  Page abc123def456abc123def456abc123de.md",
    );
    expect(result.notionId).toBe("abc123def456abc123def456abc123de");
    expect(result.cleanName).toBe("My  Great  Page");
  });
});

describe("buildCompositeKey", () => {
  it("combines parent dir and clean name", () => {
    const key = buildCompositeKey("Projects/Work", "Meeting Notes");
    expect(key).toBe("Projects/Work/Meeting Notes");
  });

  it("strips Notion IDs from parent directory segments", () => {
    const key = buildCompositeKey(
      "Projects abc123def456abc123def456abc123de/Work abc123def456abc123def456abc123de",
      "Notes",
    );
    expect(key).toBe("Projects/Work/Notes");
  });

  it("handles empty parent dir", () => {
    const key = buildCompositeKey("", "My Page");
    expect(key).toBe("My Page");
  });

  it("handles root-level path", () => {
    const key = buildCompositeKey("/", "My Page");
    expect(key).toBe("My Page");
  });
});

describe("nodeKey", () => {
  it("returns notionId when available", () => {
    expect(nodeKey("abc123", "some/key")).toBe("abc123");
  });

  it("returns composite key with prefix when notionId is null", () => {
    expect(nodeKey(null, "some/key")).toBe("composite:some/key");
  });
});
