import { Command } from "commander";
import { access, constants } from "node:fs/promises";
import type { MigrationConfig } from "./types/config.js";
import { runPipeline } from "./pipeline.js";
import { exportMarkdownToCanonicalJsonl, importCanonicalJsonl } from "./adapters/canonical-jsonl.js";
import { NotionClient } from "./connectors/notion.js";
import { writeFile, rename, rm } from "node:fs/promises";
import path from "node:path";
import { randomUUID, createHash } from "node:crypto";

export function createCli(): Command {
  const program = new Command();

  program
    .name("aime")
    .description("AI Migration Engineer — inspect, plan, and migrate data safely")
    .version("0.1.0");

  program
    .command("migrate")
    .description("Migrate a Notion export ZIP to an Obsidian vault")
    .argument("<input-zip>", "Path to Notion export zip file")
    .requiredOption("-o, --output <dir>", "Output directory for Obsidian vault")
    .option("--force", "Overwrite existing files in output directory", false)
    .option("--dry-run", "Run pipeline without writing files", false)
    .option("--verbose", "Enable debug logging to stderr", false)
    .action(async (inputZip: string, opts) => {
      // Validate input file exists
      try {
        await access(inputZip, constants.R_OK);
      } catch {
        console.error(`Error: Input file not found: ${inputZip}`);
        process.exit(1);
      }

      const config: MigrationConfig = {
        inputZip,
        outputDir: opts.output,
        force: opts.force,
        dryRun: opts.dryRun,
        verbose: opts.verbose,
      };

      try {
        const result = await runPipeline(config);

        console.log(
          `Migration ${result.writeResult.mode === "dry-run" ? "(dry run) " : ""}complete.`,
        );
        console.log(
          `  Pages: ${result.report.summary.pages}`,
        );
        console.log(
          `  Databases: ${result.report.summary.databases}`,
        );
        console.log(
          `  Attachments: ${result.report.summary.attachments}`,
        );
        console.log(
          `  Files written: ${result.writeResult.filesWritten}`,
        );

        if (result.report.degradations.length > 0) {
          console.log(
            `  Degradations: ${result.report.degradations.reduce((s, d) => s + d.count, 0)}`,
          );
        }
        if (result.report.unresolvedLinks.length > 0) {
          console.log(
            `  Unresolved links: ${result.report.unresolvedLinks.length}`,
          );
        }

        console.log(`  Report: ${opts.output}/report.md`);
      } catch (err: any) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
    });

  program.command("export-canonical")
    .description("Export a Markdown directory and its files to portable canonical JSONL")
    .argument("<source-dir>", "Source directory (for example, an Obsidian vault)")
    .requiredOption("-o, --output <file>", "Output JSONL archive path")
    .action(async (sourceDir: string, opts) => {
      try { const result = await exportMarkdownToCanonicalJsonl(sourceDir, opts.output); console.log(JSON.stringify(result, null, 2)); }
      catch (err) { console.error(`Export failed: ${err instanceof Error ? err.message : String(err)}`); process.exitCode = 1; }
    });

  program.command("import-canonical")
    .description("Import a canonical JSONL archive into a directory with SHA-256 verification")
    .argument("<archive>", "Canonical JSONL archive path")
    .requiredOption("-o, --output <dir>", "Destination directory")
    .option("--overwrite", "Replace existing files (default is to skip them)", false)
    .action(async (archive: string, opts) => {
      try { await access(archive, constants.R_OK); const result = await importCanonicalJsonl(archive, opts.output, {overwrite:opts.overwrite}); console.log(JSON.stringify(result, null, 2)); if(result.errors.length) process.exitCode = 1; }
      catch (err) { console.error(`Import failed: ${err instanceof Error ? err.message : String(err)}`); process.exitCode = 1; }
    });

  program.command("notion-export")
    .description("Export live Notion pages and block content to canonical JSONL (requires NOTION_TOKEN)")
    .requiredOption("-o, --output <file>", "Output canonical JSONL archive")
    .option("--max-pages <number>", "Maximum number of pages to export", "10000")
    .action(async (opts) => {
      const token = process.env.NOTION_TOKEN;
      if (!token) { console.error("Set NOTION_TOKEN to a Notion integration token with access to the pages you want to export."); process.exitCode = 1; return; }
      const destination = path.resolve(opts.output); const temp = `${destination}.${randomUUID()}.tmp`;
      try {
        const client = new NotionClient(token); const result = await client.exportPages({ maxPages: Math.max(1, Math.min(100000, Number(opts.maxPages) || 10000)) });
        const payload = result.records.map(record => JSON.stringify(record)).join("\n") + (result.records.length ? "\n" : "");
        await writeFile(temp, payload, { flag: "wx", mode: 0o600 }); await rename(temp, destination);
        console.log(JSON.stringify({ records: result.records.length, output: destination, sha256: createHash("sha256").update(payload).digest("hex"), hasMore: result.hasMore, nextCursor: result.nextCursor }, null, 2));
        if (result.hasMore) console.error("Export limit reached. Increase --max-pages and run another export; use a controlled incremental process to avoid duplicate archives.");
      } catch (err) { await rm(temp, { force: true }); console.error(`Notion export failed: ${err instanceof Error ? err.message : String(err)}`); process.exitCode = 1; }
    });

  program.command("adapters").description("List implemented migration paths").action(() => {
    console.log("notion-zip-to-obsidian  Notion export ZIP → Obsidian-compatible Markdown vault");
    console.log("filesystem-to-canonical-jsonl  Markdown/filesystem → canonical JSONL archive");
    console.log("canonical-jsonl-to-filesystem  canonical JSONL archive → Markdown/filesystem");
    console.log("notion-api-to-canonical-jsonl  Live Notion API → canonical JSONL (requires NOTION_TOKEN)");
    console.log("\nCanonical JSONL supports content hashes, path validation, atomic per-file writes, and conflict skipping.");
    console.log("API-based integrations require dedicated credentials and adapter implementations; they are not advertised as enabled.");
  });

  return program;
}
