import { describe, it, expect } from "vitest";
import { parseCsv } from "../../src/utils/csv-parser.js";

describe("parseCsv", () => {
  it("parses simple CSV", () => {
    const result = parseCsv("Name,Age\nAlice,30\nBob,25");
    expect(result.headers).toEqual(["Name", "Age"]);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toEqual({ Name: "Alice", Age: "30" });
    expect(result.rows[1]).toEqual({ Name: "Bob", Age: "25" });
  });

  it("handles quoted fields with commas", () => {
    const result = parseCsv('Name,Bio\nAlice,"Likes cats, dogs"\nBob,"Hi"');
    expect(result.rows[0].Bio).toBe("Likes cats, dogs");
  });

  it("handles escaped quotes inside quoted fields", () => {
    const result = parseCsv('Name,Quote\nAlice,"She said ""hello"""');
    expect(result.rows[0].Quote).toBe('She said "hello"');
  });

  it("handles multiline cells", () => {
    const result = parseCsv('Name,Notes\nAlice,"Line 1\nLine 2"\nBob,Simple');
    expect(result.rows[0].Notes).toBe("Line 1\nLine 2");
    expect(result.rows).toHaveLength(2);
  });

  it("handles BOM", () => {
    const bom = "\uFEFF";
    const result = parseCsv(`${bom}Name,Age\nAlice,30`);
    expect(result.headers).toEqual(["Name", "Age"]);
  });

  it("handles CRLF line endings", () => {
    const result = parseCsv("Name,Age\r\nAlice,30\r\nBob,25");
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toEqual({ Name: "Alice", Age: "30" });
  });

  it("handles empty CSV", () => {
    const result = parseCsv("");
    expect(result.headers).toEqual([]);
    expect(result.rows).toEqual([]);
  });

  it("handles CSV with only headers", () => {
    const result = parseCsv("Name,Age");
    expect(result.headers).toEqual(["Name", "Age"]);
    expect(result.rows).toEqual([]);
  });

  it("handles rows with fewer columns than headers", () => {
    const result = parseCsv("Name,Age,City\nAlice,30");
    expect(result.rows[0]).toEqual({ Name: "Alice", Age: "30", City: "" });
  });

  it("handles empty cells", () => {
    const result = parseCsv("A,B,C\n,hello,\nworld,,");
    expect(result.rows[0]).toEqual({ A: "", B: "hello", C: "" });
    expect(result.rows[1]).toEqual({ A: "world", B: "", C: "" });
  });

  it("handles Unicode content", () => {
    const result = parseCsv("名前,年齢\n太郎,25\n花子,30");
    expect(result.headers).toEqual(["名前", "年齢"]);
    expect(result.rows[0]).toEqual({ "名前": "太郎", "年齢": "25" });
  });
});

describe("column type inference", () => {
  it("infers checkbox type", () => {
    const result = parseCsv("Done\nYes\nNo\nYes");
    expect(result.columns[0].notionType).toBe("checkbox");
    expect(result.columns[0].inferred).toBe(true);
  });

  it("infers number type", () => {
    const result = parseCsv("Amount\n100\n200.50\n-30");
    expect(result.columns[0].notionType).toBe("number");
  });

  it("infers date type", () => {
    const result = parseCsv("Created\n2024-01-15\n2024-03-20");
    expect(result.columns[0].notionType).toBe("date");
  });

  it("infers url type", () => {
    const result = parseCsv("Link\nhttps://example.com\nhttps://test.org");
    expect(result.columns[0].notionType).toBe("url");
  });

  it("infers email type", () => {
    const result = parseCsv("Email\nalice@example.com\nbob@test.org");
    expect(result.columns[0].notionType).toBe("email");
  });

  it("infers multi_select from comma-separated values", () => {
    const result = parseCsv("Tags\n\"work,personal\"\n\"code,review\"");
    expect(result.columns[0].notionType).toBe("multi_select");
  });

  it("falls back to text for mixed content", () => {
    const result = parseCsv(
      "Notes\nHello world this is a longer note about things\nAnother long note with different content about various topics and ideas",
    );
    expect(result.columns[0].notionType).toBe("text");
  });
});
