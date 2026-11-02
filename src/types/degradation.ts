export type Severity = "info" | "warning" | "error";

export interface Degradation {
  tag: string;
  message: string;
  location: string;
  severity: Severity;
}

// ===== Tag constants =====

// Info-level: content preserved but worth noting
export const INFO_EXTERNAL_IMAGE = "INFO:external-image";
export const INFO_CODE_LANG_MISSING = "INFO:code-lang-missing";

// Warning-level: content partially degraded
export const DEGRADED_RELATION_PROPERTY = "DEGRADED:relation-property";
export const DEGRADED_ROLLUP_FLAT = "DEGRADED:rollup-flat";
export const DEGRADED_FORMULA_FLAT = "DEGRADED:formula-flat";
export const DEGRADED_DB_VIEWS_LOST = "DEGRADED:db-views-lost";
export const DEGRADED_COLOR_STRIPPED = "DEGRADED:color-stripped";
export const DEGRADED_TABLE_INLINE_MEDIA = "DEGRADED:table-inline-media";
export const DEGRADED_EMBED_TO_LINK = "DEGRADED:embed-to-link";
export const DEGRADED_SYNCED_EXPANDED = "DEGRADED:synced-expanded";
export const DEGRADED_NESTED_PAGE_IN_CELL = "DEGRADED:nested-page-in-cell";

// Error-level: content lost or link broken
export const ERROR_UNRESOLVED_LINK = "ERROR:unresolved-link";
export const ERROR_ZIP_ENTRY_SKIPPED = "ERROR:zip-entry-skipped";
export const ERROR_CORRUPT_ENTRY = "ERROR:corrupt-entry";

export function degradation(
  tag: string,
  message: string,
  location: string,
  severity: Severity = "warning",
): Degradation {
  return { tag, message, location, severity };
}
