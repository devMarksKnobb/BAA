/**
 * Lightweight markdown link extraction using regex.
 * We use regex instead of mdast for the initial implementation because
 * Notion exports are predictable — links follow standard markdown patterns.
 * This avoids complex AST manipulation while remaining accurate.
 */

export interface ExtractedLink {
  /** Full match string including []() */
  fullMatch: string;
  /** The text portion inside [] */
  text: string;
  /** The href portion inside () */
  href: string;
  /** Whether this is an image link ![]() */
  isImage: boolean;
  /** Character index in the source string */
  index: number;
}

/**
 * Regex for markdown links: [text](href) and ![alt](href)
 * Handles nested brackets in text and parentheses in href.
 */
const LINK_REGEX = /(!?)\[([^\]]*)\]\(([^)]*)\)/g;

/**
 * Extract all markdown links from content.
 */
export function extractLinks(markdown: string): ExtractedLink[] {
  const links: ExtractedLink[] = [];
  let match: RegExpExecArray | null;

  // Reset regex state
  LINK_REGEX.lastIndex = 0;

  while ((match = LINK_REGEX.exec(markdown)) !== null) {
    links.push({
      fullMatch: match[0],
      text: match[2],
      href: match[3],
      isImage: match[1] === "!",
      index: match.index,
    });
  }

  return links;
}

/**
 * Replace all markdown links in content using a replacer function.
 */
export function replaceLinks(
  markdown: string,
  replacer: (link: ExtractedLink) => string,
): string {
  LINK_REGEX.lastIndex = 0;
  return markdown.replace(LINK_REGEX, (fullMatch, bang, text, href, index) => {
    const link: ExtractedLink = {
      fullMatch,
      text,
      href,
      isImage: bang === "!",
      index,
    };
    return replacer(link);
  });
}

/**
 * Extract headings from markdown for anchor generation.
 */
export function extractHeadings(
  markdown: string,
): Array<{ level: number; text: string }> {
  const headings: Array<{ level: number; text: string }> = [];
  const lines = markdown.split("\n");

  for (const line of lines) {
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      headings.push({
        level: match[1].length,
        text: match[2].trim(),
      });
    }
  }

  return headings;
}
