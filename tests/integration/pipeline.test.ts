import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { writeFile, mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { readZip } from "../../src/stages/zip-reader.js";
import { normalize } from "../../src/stages/normalizer.js";
import { linkGraph } from "../../src/stages/graph-linker.js";
import {
  createMinimalExportZip,
  createUnsafeZip,
  createEdgeCaseZip,
} from "../helpers/create-fixture-zip.js";

let tmpDir: string;
let minimalZipPath: string;
let unsafeZipPath: string;
let edgeCaseZipPath: string;

beforeAll(async () => {
  tmpDir = await mkdtemp(path.join(tmpdir(), "aime-test-"));

  minimalZipPath = path.join(tmpDir, "minimal.zip");
  await writeFile(minimalZipPath, createMinimalExportZip());

  unsafeZipPath = path.join(tmpDir, "unsafe.zip");
  await writeFile(unsafeZipPath, createUnsafeZip());

  edgeCaseZipPath = path.join(tmpDir, "edge-cases.zip");
  await writeFile(edgeCaseZipPath, createEdgeCaseZip());
});

afterAll(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe("ZipReader", () => {
  it("reads entries from a valid zip", async () => {
    const result = await readZip(minimalZipPath);
    // Directories + files
    const files = result.entries.filter((e) => e.type === "file");
    expect(files.length).toBeGreaterThanOrEqual(4); // 2 md + 1 csv + 1 png
    expect(result.diagnostics).toHaveLength(0);
  });

  it("skips unsafe path traversal entries", async () => {
    const result = await readZip(unsafeZipPath);
    const files = result.entries.filter((e) => e.type === "file");
    // Only "normal.md" should survive
    expect(files.length).toBe(1);
    expect(files[0].path).toBe("normal.md");
    // Should have diagnostics for skipped entries
    expect(result.diagnostics.length).toBeGreaterThanOrEqual(1);
    expect(result.diagnostics.some((d) => d.tag === "ERROR:zip-entry-skipped")).toBe(true);
  });
});

describe("Normalizer", () => {
  it("builds graph from minimal export", async () => {
    const { entries } = await readZip(minimalZipPath);
    const normTmpDir = path.join(tmpDir, "norm-test");
    const graph = await normalize(entries, minimalZipPath, normTmpDir);

    // Should have pages, database, and attachment
    const nodes = [...graph.nodes.values()];
    const pages = nodes.filter((n) => n.kind === "page");
    const dbs = nodes.filter((n) => n.kind === "database");
    const attachments = nodes.filter((n) => n.kind === "attachment");

    expect(pages.length).toBe(2); // Home + Projects
    expect(dbs.length).toBe(1); // Tasks
    expect(attachments.length).toBe(1); // screenshot

    // Check clean names
    const homeNode = pages.find((p) => p.cleanName === "Home");
    expect(homeNode).toBeDefined();
    expect(homeNode!.notionId).toBe("abc123def456abc123def456abc12300");

    const projNode = pages.find((p) => p.cleanName === "Projects");
    expect(projNode).toBeDefined();

    // Database should have columns
    const dbNode = dbs[0];
    if (dbNode.kind === "database") {
      expect(dbNode.columns.length).toBe(3);
      expect(dbNode.columns[0].name).toBe("Name");
    }
  });

  it("extracts IDs and generates composite keys", async () => {
    const { entries } = await readZip(edgeCaseZipPath);
    const normTmpDir = path.join(tmpDir, "edge-norm-test");
    const graph = await normalize(entries, edgeCaseZipPath, normTmpDir);

    const nodes = [...graph.nodes.values()];

    // README.md has no notion ID → should use composite key
    const readmeNode = nodes.find(
      (n) => n.kind === "page" && n.cleanName === "README",
    );
    expect(readmeNode).toBeDefined();
    if (readmeNode?.kind === "page") {
      expect(readmeNode.notionId).toBeNull();
    }

    // Unicode filename should work
    const chineseNode = nodes.find(
      (n) => n.kind === "page" && n.cleanName === "笔记",
    );
    expect(chineseNode).toBeDefined();
  });
});

describe("GraphLinker", () => {
  it("resolves internal links between pages", async () => {
    const { entries } = await readZip(minimalZipPath);
    const normTmpDir = path.join(tmpDir, "link-test");
    const graph = await normalize(entries, minimalZipPath, normTmpDir);
    await linkGraph(graph);

    // Should have edges
    expect(graph.edges.length).toBeGreaterThan(0);

    // Check for page-to-page links
    const pageLinks = graph.edges.filter((e) => e.type === "page-link");
    expect(pageLinks.length).toBeGreaterThanOrEqual(2); // Home→Projects + Projects→Home

    // Check for resolved links (toId is not null)
    const resolved = pageLinks.filter((e) => e.toId !== null);
    expect(resolved.length).toBeGreaterThanOrEqual(2);
  });

  it("detects external links", async () => {
    const { entries } = await readZip(minimalZipPath);
    const normTmpDir = path.join(tmpDir, "ext-link-test");
    const graph = await normalize(entries, minimalZipPath, normTmpDir);
    await linkGraph(graph);

    const external = graph.edges.filter((e) => e.type === "external");
    expect(external.length).toBeGreaterThanOrEqual(1);
    expect(external[0].originalHref).toBe("https://example.com");
  });

  it("marks broken links as unresolved", async () => {
    const { entries } = await readZip(minimalZipPath);
    const normTmpDir = path.join(tmpDir, "broken-link-test");
    const graph = await normalize(entries, minimalZipPath, normTmpDir);
    await linkGraph(graph);

    // Home has a link to "Missing Page" which doesn't exist
    const broken = graph.edges.filter(
      (e) => e.type === "page-link" && e.toId === null,
    );
    expect(broken.length).toBeGreaterThanOrEqual(1);

    // Check that degradation was recorded
    const allDegrads = [...graph.nodes.values()]
      .filter((n): n is Extract<typeof n, { degradations: unknown }> => "degradations" in n)
      .flatMap((n) => n.degradations);
    expect(allDegrads.some((d) => d.tag === "ERROR:unresolved-link")).toBe(true);
  });

  it("detects attachment references", async () => {
    const { entries } = await readZip(minimalZipPath);
    const normTmpDir = path.join(tmpDir, "attach-link-test");
    const graph = await normalize(entries, minimalZipPath, normTmpDir);
    await linkGraph(graph);

    const attachLinks = graph.edges.filter((e) => e.type === "attachment");
    expect(attachLinks.length).toBeGreaterThanOrEqual(1);
  });

  it("extracts heading anchors", async () => {
    const { entries } = await readZip(minimalZipPath);
    const normTmpDir = path.join(tmpDir, "heading-test");
    const graph = await normalize(entries, minimalZipPath, normTmpDir);
    await linkGraph(graph);

    // Home page has "# Home" and "## Section One" headings
    const allAnchors = [...graph.headingAnchors.values()].flat();
    expect(allAnchors.length).toBeGreaterThan(0);
    expect(allAnchors.some((a) => a.slug === "section-one")).toBe(true);
  });
});
