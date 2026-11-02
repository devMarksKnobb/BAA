import express from "express";
import multer from "multer";
import path from "node:path";
import { mkdtemp, rm, readdir, readFile, stat, access, cp } from "node:fs/promises";
import { tmpdir, homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { runPipelineWithEvents } from "../pipeline-events.js";
import type { MigrationConfig } from "../types/config.js";
import { IdentityService, createIdentityRouter, requirePrincipal, requirePermission, type Principal } from "../identity/service.js";
import { CredentialVault } from "../security/credential-vault.js";
import { ProviderConnections, type Provider } from "../providers/connections.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const upload = multer({ dest: path.join(tmpdir(), "aime-uploads"), limits: { fileSize: 2 * 1024 * 1024 * 1024, files: 1 } });

export function createServer(port = 3000) {
  const app = express();
  const identity = new IdentityService();
  app.use('/api/auth', createIdentityRouter(identity));
  // OAuth credentials are never kept in process memory or returned to the browser.
  const vault = process.env.AIME_MASTER_KEY ? new CredentialVault() : undefined;
  const connections = vault ? new ProviderConnections(vault) : undefined;
  const tenantRouter = express.Router({ mergeParams: true });
  tenantRouter.use(requirePrincipal(identity));
  tenantRouter.use((req, res, next) => {
    const p = (req as any).principal as Principal;
    if (req.params.tenantId !== p.tenantId) { res.status(404).json({ error: 'Organization not found' }); return; }
    next();
  });
  tenantRouter.get('/connections', requirePermission('connections:read'), (req, res) => {
    if (!connections) { res.status(503).json({ error: 'Set AIME_MASTER_KEY to enable provider connections' }); return; }
    res.json({ connections: connections.list(req.params.tenantId) });
  });
  tenantRouter.post('/connections/:provider/authorize', requirePermission('connections:write'), (req, res) => {
    try {
      if (!connections) { res.status(503).json({ error: 'Set AIME_MASTER_KEY to enable provider connections' }); return; }
      const provider = req.params.provider as Provider;
      if (provider !== 'notion' && provider !== 'google-drive') { res.status(404).json({ error: 'Unsupported provider' }); return; }
      const p = (req as any).principal as Principal;
      res.json(connections.start(p.tenantId, p.userId, provider));
    } catch (e) { res.status(400).json({ error: e instanceof Error ? e.message : 'Could not start OAuth' }); }
  });
  tenantRouter.delete('/connections/:connectionId', requirePermission('connections:write'), async (req, res) => {
    try { if (!connections) { res.status(503).json({ error: 'Set AIME_MASTER_KEY to enable provider connections' }); return; }
      await connections.revoke(req.params.tenantId, req.params.connectionId); res.status(204).end();
    } catch (e) { res.status(502).json({ error: e instanceof Error ? e.message : 'Could not revoke connection' }); }
  });
  app.use('/api/tenants/:tenantId', tenantRouter);
  // Protect legacy migration, vault discovery, progress and file endpoints too; only /api/auth and the tenant router are public to their own auth middleware.
  app.use('/api', requirePrincipal(identity));
  app.get('/oauth/callback/:provider', async (req, res) => {
    try {
      if (!connections) { res.status(503).send('Provider connections are disabled: configure AIME_MASTER_KEY.'); return; }
      const provider = req.params.provider as Provider;
      if (provider !== 'notion' && provider !== 'google-drive') { res.status(404).send('Unsupported provider'); return; }
      if (typeof req.query.error === 'string') { res.status(400).send('Provider authorization was denied. You may close this window.'); return; }
      if (typeof req.query.code !== 'string' || typeof req.query.state !== 'string') { res.status(400).send('Missing OAuth callback parameters'); return; }
      await connections.callback(provider, req.query.code, req.query.state);
      res.status(200).send('Provider connected successfully. You may close this window and return to AIME.');
    } catch (e) { res.status(400).send(e instanceof Error ? e.message : 'OAuth callback failed'); }
  });

  // Serve static UI
  app.use(express.static(path.join(__dirname, "../../src/web/public")));

  // SSE connections map: jobId → response
  const sseClients = new Map<string, express.Response>();
  // Only generated staging directories may be read through /api/file. Never expose arbitrary host paths.
  const readableRoots = new Set<string>();

  // Scan for local Obsidian vaults
  app.get("/api/vaults", async (_req, res) => {
    try {
      const vaults = await scanObsidianVaults();
      res.json({ vaults });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Validate a specific vault path
  app.get("/api/vaults/validate", async (req, res) => {
    const vaultPath = req.query.path as string;
    if (!vaultPath) {
      res.status(400).json({ error: "Missing path parameter" });
      return;
    }
    const obsidianDir = path.join(vaultPath, ".obsidian");
    try {
      await access(obsidianDir);
      const name = path.basename(vaultPath);
      res.json({ valid: true, name, path: vaultPath });
    } catch {
      res.json({ valid: false, path: vaultPath });
    }
  });

  // Upload and migrate
  app.post("/api/migrate", upload.single("zipFile"), async (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: "No zip file uploaded" });
      return;
    }

    const jobId = `job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const vaultPath = req.body?.vaultPath as string | undefined;
    // If a vault is selected, output to a temp dir first then copy
    const outputDir = await mkdtemp(path.join(tmpdir(), "aime-out-"));
    readableRoots.add(path.resolve(outputDir));

    const config: MigrationConfig = {
      inputZip: req.file.path,
      outputDir,
      force: true,
      dryRun: req.body?.dryRun === "true",
      verbose: false,
    };

    res.json({ jobId, outputDir: vaultPath || outputDir });

    // Run pipeline with events
    const emitter = runPipelineWithEvents(config);

    emitter.on("progress", (data) => {
      const client = sseClients.get(jobId);
      if (client) {
        client.write(`data: ${JSON.stringify({ type: "progress", ...data })}\n\n`);
      }
    });

    emitter.on("complete", async ({ report, writeResult }) => {
      const client = sseClients.get(jobId);
      if (client) {
        let finalOutputDir = outputDir;
        // If vault path specified, copy migrated files into the vault
        if (vaultPath && !config.dryRun) {
          try {
            await copyToVault(outputDir, vaultPath);
            finalOutputDir = vaultPath;
          } catch (copyErr: any) {
            client.write(`data: ${JSON.stringify({ type: "error", message: `Migration succeeded but failed to copy to vault: ${copyErr.message}` })}\n\n`);
            setTimeout(() => { client.end(); sseClients.delete(jobId); }, 1000);
            return;
          }
        }
        // Build file tree from staging dir (shows only migrated files, not entire vault)
        const tree = await buildFileTree(outputDir);
        client.write(`data: ${JSON.stringify({ type: "complete", report, writeResult, tree, outputDir: finalOutputDir })}\n\n`);
        // Keep connection open briefly then close
        setTimeout(() => {
          client.end();
          sseClients.delete(jobId);
        }, 1000);
      }
      // Cleanup uploaded zip
      await rm(req.file!.path, { force: true }).catch(() => {});
    });

    emitter.on("error", async (err) => {
      const client = sseClients.get(jobId);
      if (client) {
        client.write(`data: ${JSON.stringify({ type: "error", message: err.message })}\n\n`);
        setTimeout(() => {
          client.end();
          sseClients.delete(jobId);
        }, 1000);
      }
      await rm(req.file!.path, { force: true }).catch(() => {});
    });
  });

  // SSE endpoint for progress
  app.get("/api/progress/:jobId", (req, res) => {
    const { jobId } = req.params;
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    sseClients.set(jobId, res);

    req.on("close", () => {
      sseClients.delete(jobId);
    });
  });

  // Read a file from the output
  app.get("/api/file", async (req, res) => {
    const filePath = req.query.path as string;
    if (!filePath) {
      res.status(400).json({ error: "Missing path parameter" });
      return;
    }
    try {
      const resolved = path.resolve(filePath);
      const root = [...readableRoots].find(candidate => resolved.startsWith(candidate + path.sep));
      if (!root) { res.status(403).json({ error: "File is outside an AIME migration output directory" }); return; }
      const realRoot = await import("node:fs/promises").then(fs => fs.realpath(root));
      const realFile = await import("node:fs/promises").then(fs => fs.realpath(resolved));
      if (!realFile.startsWith(realRoot + path.sep)) { res.status(403).json({ error: "Symlink paths are not allowed" }); return; }
      const content = await readFile(realFile, "utf-8");
      res.type("text/plain").send(content);
    } catch {
      res.status(404).json({ error: "File not found" });
    }
  });

  const server = app.listen(port, "127.0.0.1", () => {
    console.log(`\n  AIME dashboard running at http://localhost:${port}\n`);
  });

  return server;
}

/** Scan common locations for directories containing .obsidian/ */
async function scanObsidianVaults(): Promise<Array<{ name: string; path: string }>> {
  const home = homedir();
  const searchDirs = [
    home,
    path.join(home, "Documents"),
    path.join(home, "Desktop"),
    path.join(home, "Downloads"),
    path.join(home, "Library", "Mobile Documents", "iCloud~md~obsidian", "Documents"),
  ];

  const vaults: Array<{ name: string; path: string }> = [];
  const seen = new Set<string>();

  for (const searchDir of searchDirs) {
    try {
      const entries = await readdir(searchDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
        const candidatePath = path.join(searchDir, entry.name);
        if (seen.has(candidatePath)) continue;
        seen.add(candidatePath);
        try {
          await access(path.join(candidatePath, ".obsidian"));
          vaults.push({ name: entry.name, path: candidatePath });
        } catch {
          // Not an Obsidian vault
        }
      }
    } catch {
      // Directory doesn't exist or not readable
    }
  }

  return vaults.sort((a, b) => a.name.localeCompare(b.name));
}

/** Copy all files from staging dir into an existing Obsidian vault */
async function copyToVault(stagingDir: string, vaultPath: string): Promise<void> {
  const entries = await readdir(stagingDir, { withFileTypes: true });
  for (const entry of entries) {
    const src = path.join(stagingDir, entry.name);
    const dest = path.join(vaultPath, entry.name);
    await cp(src, dest, { recursive: true, force: true });
  }
}

async function buildFileTree(
  dir: string,
  basePath = "",
): Promise<Array<{ path: string; name: string; type: "file" | "dir"; size?: number }>> {
  const results: Array<{ path: string; name: string; type: "file" | "dir"; size?: number }> = [];
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const fullPath = path.join(dir, entry.name);
    const relPath = basePath ? `${basePath}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      results.push({ path: fullPath, name: relPath, type: "dir" });
      results.push(...(await buildFileTree(fullPath, relPath)));
    } else {
      const s = await stat(fullPath);
      results.push({ path: fullPath, name: relPath, type: "file", size: s.size });
    }
  }
  return results;
}

// Direct invocation
const port = parseInt(process.env.PORT ?? "3000", 10);
createServer(port);
