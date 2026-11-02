import { describe, it, expect } from "vitest";
import {
  normalizeUnicode,
  cleanFilename,
  truncateFilename,
  resolveCollision,
  buildBucketPath,
  headingSlug,
  isWithinDir,
  computeWikilinkTarget,
} from "../../src/utils/path-utils.js";

describe("normalizeUnicode", () => {
  it("normalizes NFD to NFC", () => {
    // é as NFD (e + combining accent) vs NFC (single codepoint)
    const nfd = "e\u0301"; // NFD
    const nfc = "\u00e9"; // NFC
    expect(normalizeUnicode(nfd)).toBe(nfc);
  });

  it("preserves already NFC strings", () => {
    expect(normalizeUnicode("hello")).toBe("hello");
  });

  it("handles CJK characters", () => {
    expect(normalizeUnicode("笔记")).toBe("笔记");
  });
});

describe("cleanFilename", () => {
  it("removes illegal characters", () => {
    expect(cleanFilename('My<Page>:"/file')).toBe("MyPagefile");
  });

  it("collapses whitespace", () => {
    expect(cleanFilename("  My   Page  ")).toBe("My Page");
  });

  it("returns Untitled for empty result", () => {
    expect(cleanFilename(":::")).toBe("Untitled");
  });

  it("preserves Unicode", () => {
    expect(cleanFilename("笔记 页面")).toBe("笔记 页面");
  });

  it("removes null bytes", () => {
    expect(cleanFilename("My\x00Page")).toBe("MyPage");
  });
});

describe("truncateFilename", () => {
  it("does not truncate short names", () => {
    expect(truncateFilename("Short Name")).toBe("Short Name");
  });

  it("truncates long names with hash suffix", () => {
    const longName = "A".repeat(250);
    const result = truncateFilename(longName, "abcdef1234567890");
    expect(result.length).toBeLessThanOrEqual(200);
    expect(result).toMatch(/-abcdef$/);
  });

  it("truncates without hash if not provided", () => {
    const longName = "B".repeat(250);
    const result = truncateFilename(longName);
    expect(result.length).toBe(200);
    expect(result).toBe("B".repeat(200));
  });
});

describe("resolveCollision", () => {
  it("returns original name if no collision", () => {
    const existing = new Set(["other"]);
    expect(resolveCollision("My Page", existing)).toBe("My Page");
  });

  it("appends -1 on first collision", () => {
    const existing = new Set(["My Page"]);
    expect(resolveCollision("My Page", existing)).toBe("My Page-1");
  });

  it("increments suffix on multiple collisions", () => {
    const existing = new Set(["Page", "Page-1", "Page-2"]);
    expect(resolveCollision("Page", existing)).toBe("Page-3");
  });
});

describe("buildBucketPath", () => {
  it("builds correct bucket path", () => {
    const hash =
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824";
    expect(buildBucketPath(hash, "image.png")).toBe(
      "attachments/2cf24dba/image.png",
    );
  });
});

describe("headingSlug", () => {
  it("converts to lowercase with hyphens", () => {
    expect(headingSlug("My Heading")).toBe("my-heading");
  });

  it("removes special characters", () => {
    expect(headingSlug("What's this? (a test!)")).toBe("whats-this-a-test");
  });

  it("handles Chinese characters", () => {
    expect(headingSlug("我的标题")).toBe("我的标题");
  });

  it("handles mixed content", () => {
    expect(headingSlug("Chapter 1: Introduction")).toBe("chapter-1-introduction");
  });

  it("strips leading/trailing hyphens", () => {
    expect(headingSlug("  --hello--  ")).toBe("hello");
  });
});

describe("isWithinDir", () => {
  it("returns true for child path", () => {
    expect(isWithinDir("/output/vault/file.md", "/output/vault")).toBe(true);
  });

  it("returns false for path traversal", () => {
    expect(isWithinDir("/output/vault/../secret", "/output/vault")).toBe(false);
  });

  it("returns true for exact match", () => {
    expect(isWithinDir("/output/vault", "/output/vault")).toBe(true);
  });

  it("returns false for sibling directory", () => {
    expect(isWithinDir("/output/vault2/file.md", "/output/vault")).toBe(false);
  });
});

describe("computeWikilinkTarget", () => {
  it("returns just the name when unique", () => {
    const counts = new Map([["My Page", 1]]);
    expect(computeWikilinkTarget("My Page", "Projects/My Page", counts)).toBe(
      "My Page",
    );
  });

  it("prefixes with parent folder when name is duplicated", () => {
    const counts = new Map([["README", 3]]);
    expect(
      computeWikilinkTarget("README", "Projects/README", counts),
    ).toBe("Projects/README");
  });

  it("returns just name if at root level with collision", () => {
    const counts = new Map([["Page", 2]]);
    expect(computeWikilinkTarget("Page", "Page", counts)).toBe("Page");
  });
});
