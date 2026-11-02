import { parseMcpToolError } from "../fixtures/mcpToolError.js";
import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, onTestFinished } from "vitest";

import { createFirmwareAnalysisProvider } from "../../src/composition/firmware.js";
import { createJavaScriptRecoveryProvider } from "../../src/composition/javascriptRecovery.js";
import { createServer } from "../../src/server/createServer.js";
import { createTestBinarySession } from "../fixtures/binarySession.js";
import { writeOrderedZip } from "../fixtures/artifactEntryOrder.js";
import { createTestTempDirectory } from "../fixtures/temporaryDirectory.js";
import { cliTest } from "../support/cli/cliFixture.js";

const connect = async (environment: NodeJS.ProcessEnv) => {
  const session = createTestBinarySession(() => {
    throw new Error("Target-free analysis must not acquire a deep provider");
  });
  const server = createServer(
    { kind: "session", session },
    {
      environment,
      firmwareAnalysis: createFirmwareAnalysisProvider(environment),
      javascriptRecovery: createJavaScriptRecoveryProvider(environment),
    },
  );
  const client = new Client({ name: "composition-parity", version: "1" });
  onTestFinished(async () => {
    await client.close();
    await server.close();
    await session.close();
  });
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  return client;
};

for (const { jarConfigured, setting } of [
  { jarConfigured: false, setting: "BAA_JADX_MCP_JAR" },
  { jarConfigured: true, setting: "JAVA_HOME" },
])
  cliTest.skipIf(process.platform === "win32")(
    `preserves the APK ${setting} failure through the compiled CLI and MCP factories`,
    async ({ cli }) => {
      const root = await createTestTempDirectory("baa-android-composition-");
      const apk = join(root, "fixture.apk");
      await writeOrderedZip(apk, ["AndroidManifest.xml", "classes.dex"]);
      const jar = join(root, "jadx-headless-mcp.jar");
      await writeFile(
        jar,
        "fixture jar; validation must fail before execution",
      );
      const environment = {
        BAA_LOG_LEVEL: "silent",
        JAVA_HOME: "relative-fixture-jdk",
        ...(jarConfigured ? { BAA_JADX_MCP_JAR: jar } : {}),
      };
      const cliResult = await cli.run({
        arguments: ["inspect-android-package", apk, "--json"],
        environment,
        timeoutMs: 10_000,
      });
      expect(cliResult.exitCode).toBe(1);
      expect(cliResult.json).toMatchObject({ code: "capability_unavailable" });
      const client = await connect(environment);
      const response = await client.callTool({
        name: "inspect_android_package",
        arguments: { path: apk },
      });
      expect(response.isError).toBe(true);
      expect(parseMcpToolError(response)).toEqual({ error: cliResult.json });
      expect(JSON.stringify(parseMcpToolError(response))).toContain(setting);
    },
  );

cliTest.skipIf(process.platform === "win32")(
  "distinguishes a rejected relative BAA_JADX_MCP_JAR from an unset one through CLI and MCP",
  async ({ cli }) => {
    const root = await createTestTempDirectory("baa-android-relative-jar-");
    const apk = join(root, "fixture.apk");
    await writeOrderedZip(apk, ["AndroidManifest.xml"]);
    const run = async (environment: Record<string, string>) => {
      const cliResult = await cli.run({
        arguments: ["inspect-android-package", apk, "--json"],
        environment: { BAA_LOG_LEVEL: "silent", ...environment },
        timeoutMs: 10_000,
      });
      expect(cliResult.exitCode).toBe(1);
      const client = await connect({ BAA_LOG_LEVEL: "silent", ...environment });
      const response = await client.callTool({
        name: "inspect_android_package",
        arguments: { path: apk },
      });
      expect(response.isError).toBe(true);
      expect(parseMcpToolError(response)).toEqual({ error: cliResult.json });
      return cliResult.json as {
        code: string;
        message: string;
        details: { diagnostics: Record<string, unknown> };
      };
    };

    const relative = "./tools/jadx-headless-mcp.jar";
    const rejected = await run({ BAA_JADX_MCP_JAR: relative });
    expect(rejected.code).toBe("capability_unavailable");
    expect(rejected.details.diagnostics).toEqual({
      jar_configured: true,
      jar_path: relative,
      path_requirement: "absolute",
      failure_kind: "jar",
      failure_code: "open_options_invalid",
    });
    expect(rejected.message).toContain(`received "${relative}"`);

    const empty = await run({ BAA_JADX_MCP_JAR: "" });
    expect(empty.details.diagnostics).toMatchObject({
      jar_configured: true,
      jar_path: "",
      failure_code: "open_options_invalid",
    });

    const unset = await run({});
    expect(unset.details.diagnostics).toEqual({
      jar_configured: false,
      failure_kind: "jar",
      failure_code: "not_configured",
    });
  },
);

cliTest.skipIf(process.platform !== "linux")(
  "preserves the missing firmware command reason through both caller paths",
  async ({ cli }) => {
    const root = await createTestTempDirectory("baa-firmware-composition-");
    const path = join(root, "input.bin");
    await writeFile(path, "firmware fixture");
    const environment = { BAA_LOG_LEVEL: "silent" };
    const cliResult = await cli.run({
      arguments: ["inspect-firmware-regions", path, "--json"],
      environment,
      timeoutMs: 10_000,
    });
    expect(cliResult.exitCode).toBe(1);
    expect(cliResult.json).toMatchObject({ code: "capability_unavailable" });
    const client = await connect(environment);
    const response = await client.callTool({
      name: "inspect_firmware_regions",
      arguments: { path },
    });
    expect(response.isError).toBe(true);
    expect(parseMcpToolError(response)).toEqual({ error: cliResult.json });
    expect(JSON.stringify(parseMcpToolError(response))).toContain(
      "BAA_BINWALK_COMMAND",
    );
  },
);

cliTest.skipIf(process.platform !== "linux")(
  "resolves relative firmware CLI paths against the operator working directory",
  async ({ cli }) => {
    const root = await createTestTempDirectory("baa-firmware-cli-relative-");
    await writeFile(join(root, "input.bin"), "firmware fixture");
    const cliResult = await cli.run({
      arguments: ["inspect-firmware-regions", "input.bin", "--json"],
      cwd: root,
      environment: { BAA_LOG_LEVEL: "silent" },
      timeoutMs: 10_000,
    });
    // A relative path must pass input validation and reach the provider,
    // which reports the missing firmware engine — not a validation error.
    expect(cliResult.exitCode).toBe(1);
    expect(cliResult.json).toMatchObject({ code: "capability_unavailable" });
  },
);

cliTest(
  "preserves optional JavaScript recovery configuration through CLI and MCP",
  async ({ cli }) => {
    const root = await createTestTempDirectory("baa-recovery-composition-");
    const path = join(root, "bundle.js");
    await writeFile(path, "globalThis.fixture = 1;");
    const environment = {
      BAA_LOG_LEVEL: "silent",
      BAA_WAKARU_COMMAND: "relative-unavailable-tool",
    };
    const cliResult = await cli.run({
      arguments: [
        "recover-javascript-sources",
        path,
        join(root, "output"),
        "--json",
      ],
      environment,
      timeoutMs: 10000,
    });
    expect(cliResult.exitCode).toBe(1);
    expect(cliResult.json).toMatchObject({ code: "capability_unavailable" });
    const client = await connect(environment);
    const response = await client.callTool({
      name: "recover_javascript_sources",
      arguments: { path, output_directory: join(root, "output") },
    });
    expect(response.isError).toBe(true);
    expect(parseMcpToolError(response)).toEqual({ error: cliResult.json });
    expect(JSON.stringify(parseMcpToolError(response))).toContain(
      "BAA_WAKARU_COMMAND",
    );
  },
);

cliTest(
  "returns recovery path diagnostics before missing-engine errors in CLI and MCP",
  async ({ cli }) => {
    const root = await createTestTempDirectory("baa-recovery-path-parity-");
    const environment = {
      BAA_LOG_LEVEL: "silent",
      BAA_WAKARU_COMMAND: "relative-unavailable-tool",
    };
    const client = await connect(environment);
    for (const field of ["path", "output_directory"] as const) {
      const input = {
        path: join(root, "bundle.js"),
        output_directory: join(root, "output"),
        [field]: "relative.js",
      };
      const result = await cli.run({
        arguments: [
          "recover-javascript-sources",
          input.path,
          input.output_directory,
          "--json",
        ],
        environment,
        timeoutMs: 10_000,
      });
      const response = await client.callTool({
        name: "recover_javascript_sources",
        arguments: input,
      });
      expect(result.exitCode).toBe(1);
      expect(response.isError).toBe(true);
      expect(parseMcpToolError(response)).toEqual({ error: result.json });
      expect(result.json).toMatchObject({
        code: "invalid_request",
        details: {
          operation: "recover_javascript_sources",
          issues: [{ path: [field], reason: "invalid_format" }],
        },
      });
    }
  },
);

cliTest.skipIf(process.platform === "win32")(
  "shares runtime JADX settings with the default embedded MCP provider",
  async () => {
    const root = await createTestTempDirectory("baa-embedded-jadx-settings-");
    const apk = join(root, "fixture.apk");
    await writeOrderedZip(apk, ["AndroidManifest.xml", "classes.dex"]);
    const client = await connect({
      BAA_LOG_LEVEL: "silent",
      BAA_JADX_OPERATION_TIMEOUT_MS: "0",
    });
    const request = {
      name: "inspect_android_package",
      arguments: { path: apk },
    };
    const inspect = async () =>
      parseMcpToolError(await client.callTool(request)).error;
    const invalid = {
      code: "capability_unavailable",
      details: {
        diagnostics: {
          failure_kind: "operation_timeout",
          failure_code: "open_options_invalid",
          setting: "BAA_JADX_OPERATION_TIMEOUT_MS",
          value: "0",
        },
      },
    };
    expect(await inspect()).toMatchObject(invalid);
    const updated = await client.callTool({
      name: "update_analysis_settings",
      arguments: {
        changes: [
          { setting: "jadx.operation_timeout_ms", action: "set", value: 42000 },
        ],
      },
    });
    expect(updated.isError).not.toBe(true);
    expect(updated.structuredContent).toMatchObject({
      settings: [
        {
          setting: "jadx.operation_timeout_ms",
          value: 42000,
          source: "runtime",
        },
      ],
    });
    // The same provider/request now passes timeout validation and reaches the
    // deliberately absent JAR prerequisite. No engine launch is simulated.
    expect(await inspect()).toMatchObject({
      code: "capability_unavailable",
      details: {
        diagnostics: {
          failure_kind: "jar",
          failure_code: "not_configured",
          jar_configured: false,
        },
      },
    });
    const reset = await client.callTool({
      name: "update_analysis_settings",
      arguments: {
        changes: [{ setting: "jadx.operation_timeout_ms", action: "reset" }],
      },
    });
    expect(reset.isError).not.toBe(true);
    expect(await inspect()).toMatchObject(invalid);
  },
);
