/**
 * Convert Notion-exported toggle HTML (<details><summary>) to Obsidian callout syntax.
 *
 * Notion exports toggles as:
 *   <details>
 *   <summary>Toggle Title</summary>
 *   Content here
 *   </details>
 *
 * Obsidian format (foldable callout):
 *   > [!faq]- Toggle Title
 *   > Content here
 */

const DETAILS_REGEX =
  /<details>\s*\n?\s*<summary>([\s\S]*?)<\/summary>\s*\n?([\s\S]*?)\n?\s*<\/details>/gi;

export function convertToggles(markdown: string): string {
  return markdown.replace(DETAILS_REGEX, (_match, summary: string, body: string) => {
    const title = summary.trim();
    const content = body.trim();
    const lines = content.split("\n");
    const quoted = lines.map((line) => `> ${line}`).join("\n");
    return `> [!faq]- ${title}\n${quoted}`;
  });
}
