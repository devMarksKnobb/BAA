import { defineConfig } from 'tsup';
export default defineConfig({
  entry: { index: 'src/index.ts', 'mcp/server': 'src/mcp/server.ts', 'web/server': 'src/web/server.ts', 'security/index': 'src/security/index.ts', 'connectors/notion': 'src/connectors/notion.ts', 'sync/engine': 'src/sync/engine.ts', 'queue/distributed-queue': 'src/queue/distributed-queue.ts', 'queue/index': 'src/queue/index.ts', 'queue/postgres-queue': 'src/queue/postgres-queue.ts', 'queue/worker': 'src/queue/worker.ts', 'identity/index': 'src/identity/index.ts', 'identity/service': 'src/identity/service.ts', 'providers/index': 'src/providers/index.ts', 'providers/connections': 'src/providers/connections.ts', 'providers/clients': 'src/providers/clients.ts', 'connectors/google-drive': 'src/connectors/google-drive.ts', 'sync/index': 'src/sync/index.ts', 'sync/postgres-baseline': 'src/sync/postgres-baseline.ts', 'sync/coordinator': 'src/sync/coordinator.ts' },
  format: ['esm'], target: 'node22', splitting: false, sourcemap: true,
  clean: true, dts: false, banner: { js: '#!/usr/bin/env node' },
});
