import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { writeFile, mkdtemp, rm, readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { runPipeline } from "../../src/pipeline.js";
import type { MigrationConfig } from "../../src/types/config.js";
import { createMinimalExportZip } from "../helpers/create-fixture-zip.js";

let tmpDir: string;
let zipPath: string;

beforeAll(async () => {
  tmpDir = await mkdtemp(path.join(tmpdir(), "aime-e2e-"));
  zipPath = path.join(tmpDir, "export.zip");
  await writeFile(zipPath, createMinimalExportZip());
});

afterAll(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe("Full Pipeline E2E", () => {
  it("produces vault output from minimal export", async () => {
    const outputDir = path.join(tmpDir, "vault-output");
    const config: MigrationConfig = {
      inputZip: zipPath,
      outputDir,
      force: false,
      dryRun: false,
      verbose: false,
    };

    const result = await runPipeline(config);

    // Check summary
    expect(result.report.summary.pages).toBe(2);
    expect(result.report.summary.databases).toBe(1);
    expect(result.report.summary.attachments).toBe(1);
    expect(result.writeResult.mode).toBe("write");
    expect(result.writeResult.filesWritten).toBeGreaterThan(0);

    // Check that report files exist
    const reportJson = await readFile(
      path.join(outputDir, "report.json"),
      "utf-8",
    );
    const report = JSON.parse(reportJson);
    expect(report.summary.pages).toBe(2);

    const reportMd = await readFile(
      path.join(outputDir, "report.md"),
      "utf-8",
    );
    expect(reportMd).toContain("aime Migration Report");

    // Check that page files were written
    const files = await getAllFiles(outputDir);
    const mdFiles = files.filter((f) => f.endsWith(".md"));
    // Should have at least: Home.md, Projects.md, report.md
    expect(mdFiles.length).toBeGreaterThanOrEqual(3);
  });

  it("transforms links to wikilinks", async () => {
    const outputDir = path.join(tmpDir, "vault-links");
    const config: MigrationConfig = {
      inputZip: zipPath,
      outputDir,
      force: false,
      dryRun: false,
      verbose: false,
    };

    await runPipeline(config);

    // Find the Home page file
    const files = await getAllFiles(outputDir);
    const homePath = files.find((f) => path.basename(f).startsWith("Home"));
    expect(homePath).toBeDefined();

    const homeContent = await readFile(homePath!, "utf-8");

    // Should contain wikilink to Projects (not the original markdown link)
    expect(homeContent).toContain("[[");

    // External links should be preserved
    expect(homeContent).toContain("https://example.com");
  });

  it("dry-run produces report but no vault files", async () => {
    const outputDir = path.join(tmpDir, "vault-dry-run");
    const config: MigrationConfig = {
      inputZip: zipPath,
      outputDir,
      force: false,
      dryRun: true,
      verbose: false,
    };

    const result = await runPipeline(config);

    expect(result.writeResult.mode).toBe("dry-run");
    expect(result.writeResult.filesWritten).toBe(0);
    expect(result.writeResult.outputPaths.length).toBeGreaterThan(0);

    // Report should still be generated
    const reportJson = await readFile(
      path.join(outputDir, "report.json"),
      "utf-8",
    );
    expect(JSON.parse(reportJson).execution.mode).toBe("dry-run");
  });

  it("fails when output dir is non-empty without --force", async () => {
    const outputDir = path.join(tmpDir, "vault-nonempty");
    const { mkdir, writeFile: wf } = await import("node:fs/promises");
    await mkdir(outputDir, { recursive: true });
    await wf(path.join(outputDir, "existing.md"), "existing content");

    const config: MigrationConfig = {
      inputZip: zipPath,
      outputDir,
      force: false,
      dryRun: false,
      verbose: false,
    };

    await expect(runPipeline(config)).rejects.toThrow("not empty");
  });

  it("succeeds on non-empty dir with --force", async () => {
    const outputDir = path.join(tmpDir, "vault-force");
    const { mkdir, writeFile: wf } = await import("node:fs/promises");
    await mkdir(outputDir, { recursive: true });
    await wf(path.join(outputDir, "existing.md"), "existing content");

    const config: MigrationConfig = {
      inputZip: zipPath,
      outputDir,
      force: true,
      dryRun: false,
      verbose: false,
    };

    const result = await runPipeline(config);
    expect(result.writeResult.filesWritten).toBeGreaterThan(0);

    // Existing file should not be deleted
    const existingContent = await readFile(
      path.join(outputDir, "existing.md"),
      "utf-8",
    );
    expect(existingContent).toBe("existing content");
  });

  it("writes attachments to bucket paths", async () => {
    const outputDir = path.join(tmpDir, "vault-attachments");
    const config: MigrationConfig = {
      inputZip: zipPath,
      outputDir,
      force: false,
      dryRun: false,
      verbose: false,
    };

    await runPipeline(config);

    // Check for attachments directory
    const files = await getAllFiles(outputDir);
    const attachmentFiles = files.filter((f) => f.includes("attachments"));
    expect(attachmentFiles.length).toBeGreaterThanOrEqual(1);
  });

  it("produces idempotent output", async () => {
    const outputDir1 = path.join(tmpDir, "vault-idem-1");
    const outputDir2 = path.join(tmpDir, "vault-idem-2");

    const config1: MigrationConfig = {
      inputZip: zipPath,
      outputDir: outputDir1,
      force: false,
      dryRun: false,
      verbose: false,
    };
    const config2: MigrationConfig = {
      inputZip: zipPath,
      outputDir: outputDir2,
      force: false,
      dryRun: false,
      verbose: false,
    };

    await runPipeline(config1);
    await runPipeline(config2);

    // Compare file lists (excluding report which has timestamps)
    const files1 = (await getAllFiles(outputDir1))
      .map((f) => path.relative(outputDir1, f))
      .filter((f) => !f.startsWith("report"))
      .sort();
    const files2 = (await getAllFiles(outputDir2))
      .map((f) => path.relative(outputDir2, f))
      .filter((f) => !f.startsWith("report"))
      .sort();
    expect(files1).toEqual(files2);

    // Compare content of non-report files
    for (const relPath of files1) {
      const content1 = await readFile(path.join(outputDir1, relPath));
      const content2 = await readFile(path.join(outputDir2, relPath));
      expect(content1.equals(content2)).toBe(true);
    }
  });
});

async function getAllFiles(dir: string): Promise<string[]> {
  const results: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await getAllFiles(fullPath)));
    } else {
      results.push(fullPath);
    }
  }
  return results;
}
