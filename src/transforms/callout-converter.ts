/**
 * Convert Notion-exported callout HTML (<aside>) to Obsidian callout syntax.
 *
 * Notion exports callouts as:
 *   <aside>
 *   💡 Some callout text
 *   </aside>
 *
 * Obsidian format:
 *   > [!note]
 *   > Some callout text
 */

const ASIDE_REGEX = /<aside>\s*\n?([\s\S]*?)\n?\s*<\/aside>/gi;

/** Map common Notion callout emojis to Obsidian callout types */
const EMOJI_TO_TYPE: Record<string, string> = {
  "💡": "tip",
  "⚠️": "warning",
  "❗": "danger",
  "❓": "question",
  "📌": "note",
  "🔥": "danger",
  "✅": "success",
  "📝": "note",
  "🚫": "danger",
  "ℹ️": "info",
  "💭": "quote",
  "📖": "note",
  "🎯": "tip",
  "⭐": "tip",
};

function detectCalloutType(content: string): { type: string; body: string } {
  // Check if content starts with an emoji
  for (const [emoji, type] of Object.entries(EMOJI_TO_TYPE)) {
    if (content.startsWith(emoji)) {
      return { type, body: content.slice(emoji.length).trim() };
    }
  }
  return { type: "note", body: content.trim() };
}

export function convertCallouts(markdown: string): string {
  return markdown.replace(ASIDE_REGEX, (_match, inner: string) => {
    const { type, body } = detectCalloutType(inner.trim());
    const lines = body.split("\n");
    const quoted = lines.map((line) => `> ${line}`).join("\n");
    return `> [!${type}]\n${quoted}`;
  });
}
