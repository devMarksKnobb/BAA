import { stringify } from "yaml";
import type { ColumnDef, NotionColumnType } from "../types/graph.js";
import type { Degradation } from "../types/degradation.js";
import {
  degradation,
  DEGRADED_RELATION_PROPERTY,
  DEGRADED_ROLLUP_FLAT,
  DEGRADED_FORMULA_FLAT,
} from "../types/degradation.js";

// Types that get degraded
const DEGRADED_TYPES: Record<string, string> = {
  relation: DEGRADED_RELATION_PROPERTY,
  rollup: DEGRADED_ROLLUP_FLAT,
  formula: DEGRADED_FORMULA_FLAT,
};

/**
 * Convert a raw CSV value to a typed frontmatter value based on column type.
 */
function convertValue(
  raw: string,
  colType: NotionColumnType,
): unknown {
  if (raw === "") return undefined;

  switch (colType) {
    case "checkbox":
      return raw === "Yes" || raw === "true";
    case "number": {
      const num = Number(raw.replace(/,/g, ""));
      return isNaN(num) ? raw : num;
    }
    case "multi_select":
      return raw.split(",").map((s) => s.trim()).filter(Boolean);
    case "date":
    case "url":
    case "email":
    case "phone":
    case "text":
    case "select":
    case "person":
      return raw;
    case "relation":
    case "rollup":
    case "formula":
    case "file":
      return raw;
    default:
      return raw;
  }
}

export interface FrontmatterResult {
  frontmatter: Record<string, unknown>;
  degradations: Degradation[];
}

/**
 * Build frontmatter from a CSV row using column definitions.
 */
export function buildFrontmatter(
  row: Record<string, string>,
  columns: ColumnDef[],
  location: string,
): FrontmatterResult {
  const frontmatter: Record<string, unknown> = {};
  const degradations: Degradation[] = [];
  const notionTypes: Record<string, string> = {};

  for (const col of columns) {
    const raw = row[col.name];
    if (raw === undefined || raw === "") continue;

    const value = convertValue(raw, col.notionType);
    if (value !== undefined) {
      frontmatter[col.name] = value;
    }

    // Track notion types for metadata block
    notionTypes[col.name] = col.notionType;

    // Record degradation for special types
    const degradedTag = DEGRADED_TYPES[col.notionType];
    if (degradedTag) {
      degradations.push(
        degradation(
          degradedTag,
          `${col.notionType} property "${col.name}" preserved as text value`,
          location,
        ),
      );
    }
  }

  // Add _notion_types metadata block
  if (Object.keys(notionTypes).length > 0) {
    frontmatter._notion_types = notionTypes;
  }

  return { frontmatter, degradations };
}

/**
 * Serialize frontmatter to YAML string with --- delimiters.
 * Keys are sorted for deterministic output.
 */
export function serializeFrontmatter(
  frontmatter: Record<string, unknown>,
): string {
  if (Object.keys(frontmatter).length === 0) return "";

  // Sort keys, but put _notion_types last
  const sorted: Record<string, unknown> = {};
  const keys = Object.keys(frontmatter).sort((a, b) => {
    if (a === "_notion_types") return 1;
    if (b === "_notion_types") return -1;
    return a.localeCompare(b);
  });

  for (const key of keys) {
    sorted[key] = frontmatter[key];
  }

  const yamlStr = stringify(sorted, {
    lineWidth: 0, // no wrapping
    sortMapEntries: false, // we already sorted
  });

  return `---\n${yamlStr}---\n\n`;
}
