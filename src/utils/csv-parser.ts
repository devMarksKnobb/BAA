import type { NotionColumnType, ColumnDef } from "../types/graph.js";

export interface CsvParseResult {
  headers: string[];
  columns: ColumnDef[];
  rows: Record<string, string>[];
}

/**
 * Parse a CSV string into structured rows.
 * Handles: quoted fields, commas in quotes, multiline cells, BOM.
 */
export function parseCsv(content: string): CsvParseResult {
  // Strip BOM
  const text = content.charCodeAt(0) === 0xfeff ? content.slice(1) : content;

  const rows = parseCsvRows(text);
  if (rows.length === 0) {
    return { headers: [], columns: [], rows: [] };
  }

  const headers = rows[0];
  const columns = headers.map((h) => ({
    name: h,
    notionType: "text" as NotionColumnType,
    inferred: true,
  }));

  const dataRows: Record<string, string>[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const record: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      record[headers[j]] = row[j] ?? "";
    }
    dataRows.push(record);
  }

  // Infer column types from data
  for (let j = 0; j < columns.length; j++) {
    columns[j].notionType = inferColumnType(
      columns[j].name,
      dataRows.map((r) => r[columns[j].name] ?? ""),
    );
  }

  return { headers, columns, rows: dataRows };
}

/**
 * Low-level CSV row parser. Handles RFC 4180 with some tolerance.
 */
function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let current: string[] = [];
  let field = "";
  let inQuote = false;
  let i = 0;

  while (i < text.length) {
    const ch = text[i];

    if (inQuote) {
      if (ch === '"') {
        if (i + 1 < text.length && text[i + 1] === '"') {
          // Escaped quote
          field += '"';
          i += 2;
        } else {
          // End of quoted field
          inQuote = false;
          i++;
        }
      } else {
        field += ch;
        i++;
      }
    } else {
      if (ch === '"' && field.length === 0) {
        inQuote = true;
        i++;
      } else if (ch === ",") {
        current.push(field);
        field = "";
        i++;
      } else if (ch === "\r") {
        // Handle \r\n or lone \r
        current.push(field);
        field = "";
        rows.push(current);
        current = [];
        i++;
        if (i < text.length && text[i] === "\n") i++;
      } else if (ch === "\n") {
        current.push(field);
        field = "";
        rows.push(current);
        current = [];
        i++;
      } else {
        field += ch;
        i++;
      }
    }
  }

  // Handle last field/row
  if (field.length > 0 || current.length > 0) {
    current.push(field);
    rows.push(current);
  }

  return rows;
}

/**
 * Infer the Notion column type from a column name and sample values.
 */
function inferColumnType(
  name: string,
  values: string[],
): NotionColumnType {
  const nonEmpty = values.filter((v) => v.length > 0);
  if (nonEmpty.length === 0) return "text";

  const nameLower = name.toLowerCase();

  // Check for checkbox pattern
  if (nonEmpty.every((v) => v === "Yes" || v === "No" || v === "true" || v === "false")) {
    return "checkbox";
  }

  // Check for number pattern
  if (nonEmpty.every((v) => /^-?[\d,]+(\.\d+)?$/.test(v.trim()))) {
    return "number";
  }

  // Check for date pattern (ISO date or common formats)
  if (nonEmpty.every((v) => /^\d{4}-\d{2}-\d{2}/.test(v.trim()))) {
    return "date";
  }

  // Check for URL pattern
  if (nonEmpty.every((v) => /^https?:\/\//.test(v.trim()))) {
    return "url";
  }

  // Check for email pattern
  if (nonEmpty.every((v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()))) {
    return "email";
  }

  // Check for multi_select pattern (comma-separated values)
  if (nonEmpty.some((v) => v.includes(",")) && !nonEmpty.some((v) => v.length > 200)) {
    return "multi_select";
  }

  // Check name hints for relation
  if (nameLower.includes("relation") || nameLower.includes("related")) {
    return "relation";
  }

  // Check name hints for rollup/formula
  if (nameLower.includes("rollup")) return "rollup";
  if (nameLower.includes("formula")) return "formula";

  // Check for select-like (few unique short values)
  const unique = new Set(nonEmpty);
  if (unique.size <= 10 && nonEmpty.every((v) => v.length < 50)) {
    return "select";
  }

  return "text";
}
