import { describe, it, expect } from "vitest";
import { convertToggles } from "../../src/transforms/toggle-converter.js";

describe("convertToggles", () => {
  it("converts basic details/summary to foldable callout", () => {
    const input =
      "<details>\n<summary>My Toggle</summary>\nHidden content\n</details>";
    const result = convertToggles(input);
    expect(result).toBe("> [!faq]- My Toggle\n> Hidden content");
  });

  it("preserves multiline toggle content", () => {
    const input =
      "<details>\n<summary>Title</summary>\nLine 1\nLine 2\n</details>";
    const result = convertToggles(input);
    expect(result).toBe("> [!faq]- Title\n> Line 1\n> Line 2");
  });

  it("handles multiple toggles", () => {
    const input = [
      "<details>",
      "<summary>Toggle 1</summary>",
      "Content 1",
      "</details>",
      "",
      "Normal text",
      "",
      "<details>",
      "<summary>Toggle 2</summary>",
      "Content 2",
      "</details>",
    ].join("\n");
    const result = convertToggles(input);
    expect(result).toContain("> [!faq]- Toggle 1");
    expect(result).toContain("> [!faq]- Toggle 2");
    expect(result).toContain("Normal text");
  });

  it("leaves non-toggle content unchanged", () => {
    const input = "# Normal heading\n\nNormal paragraph.";
    expect(convertToggles(input)).toBe(input);
  });
});
