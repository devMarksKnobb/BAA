import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, isAbsolute } from "node:path";
import { Client } from "@modelcontextprotocol/client";
import {
  StdioClientTransport,
  getDefaultEnvironment,
} from "@modelcontextprotocol/client/stdio";
import { expect, it, vi } from "vitest";
import { z } from "zod";
import { configureClientConfiguration } from "../../../src/application/SetupClientConfiguration.js";
import { readClientRegistrationStatuses } from "../../../src/application/ClientRegistrationStatus.js";
import { currentClientRegistrationCommand } from "../../../src/application/ClientRegistrationIdentity.js";
import { systemUninstallHost } from "../../../src/application/Uninstall.js";
import { PRODUCT_IDENTITY } from "../../../src/identity.js";
import { createTestTempDirectory } from "../../fixtures/temporaryDirectory.js";

// These writer tests model setup running from BAA's actual entrypoint, not Vitest's worker.
vi.mock(
  "../../../src/process/CurrentEntrypointPath.js",
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import("../../../src/process/CurrentEntrypointPath.js")
      >();
    const { fileURLToPath } = await import("node:url");
    return {
      ...actual,
      CURRENT_ENTRYPOINT_PATH: fileURLToPath(
        new URL("../../../scripts/baa.mjs", import.meta.url),
      ),
    };
  },
);

const configurationSchema = z.object({
  mcpServers: z.object({
    baa: z.object({ command: z.string(), args: z.array(z.string()) }),
  }),
});

it.each([
  {
    previousCommand: [
      "npx",
      "-y",
      PRODUCT_IDENTITY.registrationPackageSpecifier,
      "mcp",
    ],
  },
  { previousCommand: ["cmd", "/c", "npx", "-y", "build-anything-agents@5.0.0", "mcp"] },
])(
  "migrates Windows npx registration $previousCommand idempotently and uninstalls only BAA",
  async ({ previousCommand }) => {
    const home = await createTestTempDirectory("baa-windows-registration-");
    const configPath = join(home, ".claude.json");
    const original = JSON.stringify({
      theme: "dark",
      mcpServers: {
        other: { command: "another-server" },
        baa: {
          command: previousCommand[0],
          args: previousCommand.slice(1),
        },
      },
    });
    await writeFile(configPath, original);
    expect(
      await readClientRegistrationStatuses(home, undefined, {
        platform: "win32",
        environment: {},
      }),
    ).toContainEqual(
      expect.objectContaining({ client: "claude_code", state: "stale" }),
    );
    const client = {
      name: "claude_code",
      configPath,
      format: "claude_code",
    } as const;
    const command = currentClientRegistrationCommand({ platform: "win32" });
    expect(
      await configureClientConfiguration(client, {}, command),
    ).toMatchObject({ status: "configured" });
    expect(
      await readClientRegistrationStatuses(home, undefined, {
        platform: "win32",
        environment: {},
      }),
    ).toContainEqual(
      expect.objectContaining({ client: "claude_code", state: "aligned" }),
    );
    expect(await configureClientConfiguration(client, {}, command)).toEqual({
      status: "unchanged",
    });
    expect(await readFile(`${configPath}.baa.backup`, "utf8")).toBe(original);
    expect(await systemUninstallHost(home).removeClient(client)).toMatchObject({
      status: "removed",
    });
    const remaining: unknown = JSON.parse(await readFile(configPath, "utf8"));
    expect(remaining).toEqual({
      theme: "dark",
      mcpServers: { other: { command: "another-server" } },
    });
  },
);

it.each(["npx", "bunx"] as const)(
  "keeps the Windows %s launcher aligned through Codex TOML setup and removal",
  async (runner) => {
    const home = await createTestTempDirectory("baa-windows-codex-");
    await mkdir(join(home, ".codex"));
    const configPath = join(home, ".codex", "config.toml");
    const original =
      '\uFEFF# Keep this explanation.\nnotify = ["a", "b"]\nliteral = \'C:\\demo\\path\'\ndisabled_mcp_servers = ["baa"]\n\n[mcp_servers.other]\ncommand = "another-server"\n';
    await writeFile(configPath, original);
    const client = { name: "codex", configPath, format: "toml" } as const;
    const command = currentClientRegistrationCommand({ platform: "win32" });
    expect(
      await configureClientConfiguration(client, {}, command),
    ).toMatchObject({ status: "configured" });
    expect(
      await readClientRegistrationStatuses(home, undefined, {
        platform: "win32",
        environment: {},
      }),
    ).toContainEqual(
      expect.objectContaining({ client: "codex", state: "aligned" }),
    );
    expect(await configureClientConfiguration(client, {}, command)).toEqual({
      status: "unchanged",
    });
    expect(await readFile(`${configPath}.baa.backup`, "utf8")).toBe(original);
    expect(await systemUninstallHost(home).removeClient(client)).toMatchObject({
      status: "removed",
    });
    expect(await readFile(configPath, "utf8")).toBe(original);
  },
);

it("retains baa-named custom shell registrations without writing a backup", async () => {
  const home = await createTestTempDirectory("baa-custom-shell-registration-");
  const configPath = join(home, ".claude.json");
  const client = {
    name: "claude_code",
    configPath,
    format: "claude_code",
  } as const;
  for (const command of [
    ["cmd.exe", "/d", "/c", "node", "custom.js", "mcp"],
    ["cmd.exe", "/k", "npx", "-y", "build-anything-agents@5.0.0", "mcp"],
    ["cmd.exe", "/c", "npx -y build-anything-agents@5.0.0 mcp"],
    ["cmd.exe", "/c", "npx", "-y", "another-package", "mcp"],
    ["cmd.exe", "/c", "npx", "-y", "build-anything-agents@5.0.0", "mcp", "&", "other"],
    ["cmd.exe", "/c", "npx", "-y", "build-anything-agents@5.0.0 & other", "mcp"],
    ["cmd.exe", "/c", "bunx", "another-package", "mcp"],
    ["cmd.exe", "/c", "bunx", "-y", "build-anything-agents@5.0.0", "mcp"],
    ["cmd.exe", "/c", "bunx", "build-anything-agents@5.0.0", "mcp", "&", "other"],
  ]) {
    const original = JSON.stringify({
      mcpServers: { baa: { command: command[0], args: command.slice(1) } },
    });
    await writeFile(configPath, original);
    expect(await systemUninstallHost(home).removeClient(client)).toMatchObject({
      status: "retained",
    });
    expect(await readFile(configPath, "utf8")).toBe(original);
    await expect(readFile(`${configPath}.baa.backup`)).rejects.toMatchObject({
      code: "ENOENT",
    });
  }
});

it.skipIf(process.platform !== "win32")(
  "starts the written Windows registration without current-directory package runners",
  async () => {
    const root = await createTestTempDirectory("baa-windows-mcp-");
    const home = join(root, "home with spaces");
    await mkdir(home);
    const configPath = join(home, ".claude.json");
    const setupClient = {
      name: "claude_code",
      configPath,
      format: "claude_code",
    } as const;
    const command = currentClientRegistrationCommand({ platform: "win32" });
    expect(await configureClientConfiguration(setupClient)).toMatchObject({
      status: "configured",
    });
    const registration = configurationSchema.parse(
      JSON.parse(await readFile(configPath, "utf8")),
    ).mcpServers.baa;
    expect([registration.command, ...registration.args]).toEqual(command);
    expect(isAbsolute(registration.command)).toBe(true);
    const marker = join(home, "runner-called.txt");
    for (const runner of ["npx", "bunx"])
      await writeFile(
        join(home, `${runner}.cmd`),
        `@echo unexpected>"${marker}"\r\n@exit /b 73\r\n`,
      );
    await writeFile(join(home, ".npmrc"), "registry=http://127.0.0.1:9/\n");
    const transport = new StdioClientTransport({
      command: registration.command,
      args: registration.args,
      cwd: home,
      env: getDefaultEnvironment(),
      stderr: "pipe",
    });
    const client = new Client({
      name: "windows-direct-registration",
      version: "1",
    });
    try {
      await client.connect(transport);
      expect(client.getServerVersion()?.version).toBe(
        PRODUCT_IDENTITY.packageVersion,
      );
      const status = await client.callTool({
        name: "binary_session",
        arguments: {},
      });
      expect(status.isError).not.toBe(true);
      expect(status.structuredContent).toMatchObject({
        result: { open: false },
      });
      await expect(readFile(marker)).rejects.toMatchObject({ code: "ENOENT" });
    } finally {
      await client.close();
      await transport.close();
    }
  },
  30_000,
);
