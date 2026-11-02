import { describe, it, expect } from "vitest";
import { extractLinks, replaceLinks, extractHeadings } from "../../src/utils/markdown-links.js";

describe("extractLinks", () => {
  it("extracts standard markdown links", () => {
    const links = extractLinks("[text](url)");
    expect(links).toHaveLength(1);
    expect(links[0].text).toBe("text");
    expect(links[0].href).toBe("url");
    expect(links[0].isImage).toBe(false);
  });

  it("extracts image links", () => {
    const links = extractLinks("![alt](image.png)");
    expect(links).toHaveLength(1);
    expect(links[0].isImage).toBe(true);
    expect(links[0].text).toBe("alt");
    expect(links[0].href).toBe("image.png");
  });

  it("extracts multiple links", () => {
    const md = "See [page1](a.md) and [page2](b.md) and ![img](c.png)";
    const links = extractLinks(md);
    expect(links).toHaveLength(3);
  });

  it("handles URL-encoded hrefs", () => {
    const links = extractLinks("[My Page](My%20Page%20abc123.md)");
    expect(links[0].href).toBe("My%20Page%20abc123.md");
  });

  it("handles links with anchors", () => {
    const links = extractLinks("[section](page.md#heading)");
    expect(links[0].href).toBe("page.md#heading");
  });

  it("returns empty array for no links", () => {
    expect(extractLinks("Just plain text")).toHaveLength(0);
  });
});

describe("replaceLinks", () => {
  it("replaces links using a callback", () => {
    const result = replaceLinks("[text](url)", () => "[[replaced]]");
    expect(result).toBe("[[replaced]]");
  });

  it("preserves non-link text", () => {
    const result = replaceLinks(
      "Before [text](url) after",
      () => "[[new]]",
    );
    expect(result).toBe("Before [[new]] after");
  });

  it("passes link info to callback", () => {
    let captured: any = null;
    replaceLinks("![alt](img.png)", (link) => {
      captured = link;
      return link.fullMatch;
    });
    expect(captured.isImage).toBe(true);
    expect(captured.text).toBe("alt");
    expect(captured.href).toBe("img.png");
  });
});

describe("extractHeadings", () => {
  it("extracts headings with levels", () => {
    const md = "# H1\n\nSome text\n\n## H2\n\n### H3";
    const headings = extractHeadings(md);
    expect(headings).toHaveLength(3);
    expect(headings[0]).toEqual({ level: 1, text: "H1" });
    expect(headings[1]).toEqual({ level: 2, text: "H2" });
    expect(headings[2]).toEqual({ level: 3, text: "H3" });
  });

  it("ignores non-heading lines", () => {
    const md = "Not a heading\n\n# Real heading\n\n##Not valid";
    const headings = extractHeadings(md);
    expect(headings).toHaveLength(1);
    expect(headings[0].text).toBe("Real heading");
  });
});
