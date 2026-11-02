import { describe, it, expect } from "vitest";
import { convertCallouts } from "../../src/transforms/callout-converter.js";

describe("convertCallouts", () => {
  it("converts basic aside to note callout", () => {
    const input = "<aside>\nSome callout text\n</aside>";
    const result = convertCallouts(input);
    expect(result).toBe("> [!note]\n> Some callout text");
  });

  it("converts aside with tip emoji", () => {
    const input = "<aside>\n💡 A helpful tip\n</aside>";
    const result = convertCallouts(input);
    expect(result).toBe("> [!tip]\n> A helpful tip");
  });

  it("converts aside with warning emoji", () => {
    const input = "<aside>\n⚠️ Be careful!\n</aside>";
    const result = convertCallouts(input);
    expect(result).toBe("> [!warning]\n> Be careful!");
  });

  it("preserves multiline content", () => {
    const input = "<aside>\nLine 1\nLine 2\nLine 3\n</aside>";
    const result = convertCallouts(input);
    expect(result).toBe("> [!note]\n> Line 1\n> Line 2\n> Line 3");
  });

  it("handles multiple callouts in one document", () => {
    const input =
      "Before\n\n<aside>\nFirst\n</aside>\n\nMiddle\n\n<aside>\n💡 Second\n</aside>\n\nAfter";
    const result = convertCallouts(input);
    expect(result).toContain("> [!note]\n> First");
    expect(result).toContain("> [!tip]\n> Second");
    expect(result).toContain("Before");
    expect(result).toContain("After");
  });

  it("leaves non-aside content unchanged", () => {
    const input = "# Hello\n\nJust normal text.";
    expect(convertCallouts(input)).toBe(input);
  });
});
