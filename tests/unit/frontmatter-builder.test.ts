import { describe, it, expect } from "vitest";
import {
  buildFrontmatter,
  serializeFrontmatter,
} from "../../src/transforms/frontmatter-builder.js";
import type { ColumnDef } from "../../src/types/graph.js";

describe("buildFrontmatter", () => {
  const columns: ColumnDef[] = [
    { name: "Name", notionType: "text", inferred: false },
    { name: "Done", notionType: "checkbox", inferred: false },
    { name: "Count", notionType: "number", inferred: false },
    { name: "Tags", notionType: "multi_select", inferred: false },
    { name: "Due", notionType: "date", inferred: false },
    { name: "Related", notionType: "relation", inferred: false },
  ];

  it("converts values according to column types", () => {
    const row = {
      Name: "Task 1",
      Done: "Yes",
      Count: "42",
      Tags: "work,urgent",
      Due: "2024-03-15",
      Related: "some-notion-id",
    };
    const result = buildFrontmatter(row, columns, "test.csv#row-1");

    expect(result.frontmatter.Name).toBe("Task 1");
    expect(result.frontmatter.Done).toBe(true);
    expect(result.frontmatter.Count).toBe(42);
    expect(result.frontmatter.Tags).toEqual(["work", "urgent"]);
    expect(result.frontmatter.Due).toBe("2024-03-15");
    expect(result.frontmatter.Related).toBe("some-notion-id");
  });

  it("includes _notion_types metadata", () => {
    const row = { Name: "Test", Done: "No" };
    const result = buildFrontmatter(row, columns, "test.csv#row-1");
    expect(result.frontmatter._notion_types).toBeDefined();
    const types = result.frontmatter._notion_types as Record<string, string>;
    expect(types.Name).toBe("text");
    expect(types.Done).toBe("checkbox");
  });

  it("records degradation for relation properties", () => {
    const row = { Related: "some-id" };
    const result = buildFrontmatter(row, columns, "test.csv#row-1");
    expect(result.degradations.some((d) => d.tag === "DEGRADED:relation-property")).toBe(true);
  });

  it("skips empty values", () => {
    const row = { Name: "Hello", Done: "", Count: "" };
    const result = buildFrontmatter(row, columns, "test.csv#row-1");
    expect(result.frontmatter.Done).toBeUndefined();
    expect(result.frontmatter.Count).toBeUndefined();
  });

  it("handles checkbox false values", () => {
    const row = { Done: "No" };
    const result = buildFrontmatter(row, columns, "test.csv#row-1");
    expect(result.frontmatter.Done).toBe(false);
  });
});

describe("serializeFrontmatter", () => {
  it("produces valid YAML with --- delimiters", () => {
    const fm = { title: "Hello", tags: ["a", "b"] };
    const result = serializeFrontmatter(fm);
    expect(result).toMatch(/^---\n/);
    expect(result).toMatch(/---\n\n$/);
    expect(result).toContain("tags:");
    expect(result).toContain("title: Hello");
  });

  it("sorts keys alphabetically with _notion_types last", () => {
    const fm = {
      zebra: "z",
      alpha: "a",
      _notion_types: { zebra: "text" },
    };
    const result = serializeFrontmatter(fm);
    const alphaIdx = result.indexOf("alpha");
    const zebraIdx = result.indexOf("zebra");
    const notionIdx = result.indexOf("_notion_types");
    expect(alphaIdx).toBeLessThan(zebraIdx);
    expect(zebraIdx).toBeLessThan(notionIdx);
  });

  it("returns empty string for empty frontmatter", () => {
    expect(serializeFrontmatter({})).toBe("");
  });
});
