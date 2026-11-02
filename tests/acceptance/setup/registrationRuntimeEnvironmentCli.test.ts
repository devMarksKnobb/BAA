import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { expect } from "vitest";
import { Scalar, stringify } from "yaml";

import {
  effectiveClientServer,
  parseClientConfiguration,
  clientRegistrationEntry,
} from "../../../src/application/ClientConfigurationDocument.js";
import { createTestTempDirectory } from "../../fixtures/temporaryDirectory.js";
import { cliTest } from "../../support/cli/cliFixture.js";

// Registration configuration tests must not discover installed providers or
// plan provider-environment edits based on the machine running the suite.
const missingHopperAndGhidraEnvironment = (home: string) => ({
  HOPPER_LAUNCHER_PATH: join(home, "missing-hopper"),
  GHIDRA_INSTALL_DIR: join(home, "missing-ghidra"),
  JAVA_HOME: join(home, "missing-java"),
});

cliTest(
  "retains selected MCP settings and unavailable provider paths in a new registration",
  async ({ cli }) => {
    const home = await createTestTempDirectory("baa-selected-registration-");
    const config = join(home, ".qwen/settings.json");
    const selected = {
      HOPPER_LAUNCHER_PATH: join(home, "missing-hopper"),
      HOPPER_LOADER_ARGS_JSON: '["", "--loader", "Mach-O"]',
      GHIDRA_INSTALL_DIR: join(home, "offline-ghidra"),
      GHIDRA_HEADLESS_MAXMEM: "512M",
      GHIDRA_MAXMEM: "3G",
      JAVA_HOME: join(home, "offline-jdk"),
      BAA_IDA_MCP_CONFIG: join(home, "offline-ida.json"),
      BAA_JADX_MCP_JAR: join(home, "offline-jadx.jar"),
      BAA_KUNA_COMMAND: join(home, "offline-kuna"),
      BAA_ADB_PATH: join(home, "offline-adb"),
      BAA_APKTOOL_COMMAND: join(home, "offline-apktool"),
      BAA_TSHARK_COMMAND: join(home, "offline-tshark"),
      BAA_CAPINFOS_COMMAND: join(home, "offline-capinfos"),
      BAA_TSHARK_PRLIMIT_COMMAND: join(home, "offline-prlimit"),
      BAA_OBJDUMP_COMMAND: join(home, "offline-objdump"),
      BAA_GDB_COMMAND: join(home, "offline-gdb"),
      BAA_RIZIN_COMMAND: join(home, "offline-rizin"),
      BAA_CUTTER_BRIDGE_DIR: join(home, "cutter-bridge"),
      BAA_WABT_BIN_DIRECTORY: join(home, "wabt"),
      BAA_WAKARU_COMMAND: join(home, "offline-wakaru"),
      BAA_JAVASCRIPT_PRLIMIT_COMMAND: join(home, "javascript-prlimit"),
      BAA_BINWALK_COMMAND: join(home, "offline-binwalk"),
      BAA_UNBLOB_COMMAND: join(home, "offline-unblob"),
      BAA_FIRMWARE_PRLIMIT_COMMAND: join(home, "firmware-prlimit"),
      BAA_EVM_PRLIMIT_COMMAND: join(home, "evm-prlimit"),
      BAA_SIGROK_COMMAND: join(home, "offline-sigrok"),
      BAA_SIGROK_PRLIMIT_COMMAND: join(home, "sigrok-prlimit"),
      BAA_MITMDUMP_COMMAND: join(home, "offline-mitmdump"),
      BAA_BROWSER_EXECUTABLE: join(home, "offline-chromium"),
      BAA_BROWSER_NO_SANDBOX: "false",
      BAA_PWNTOOLS_PYTHON: join(home, "offline-python"),
      BAA_PWNTOOLS_MAX_INPUT_BYTES: "67108864",
      BAA_PWNDBG_GDB: join(home, "pwndbg-gdb"),
      BAA_PWNDBG_GDBINIT: join(home, "pwndbg-gdbinit"),
      BAA_PWNDBG_VENV_PATH: join(home, "pwndbg-venv"),
      ...(process.platform === "darwin"
        ? {}
        : {
            BAA_DARWIN_SWIFTC_PATH: join(home, "offline-swiftc"),
            BAA_DARWIN_MODULE_CACHE_PATH: join(home, "swift-module-cache"),
            SDKROOT: join(home, "macos-sdk"),
          }),
      BAA_SWIFTC_COMPILE_TIMEOUT_MS: "180000",
      BAA_LOG_LEVEL: "warn",
      BAA_REFERENCE_SECRET_PATTERNS_JSON: '["explicit-private-value"]',
      BAA_ANALYSIS_PROVIDER: "ghidra",
      BAA_MCP_INPUT_SCHEMA_PROFILE: "compact",
      BAA_MCP_OUTPUT_SCHEMA_PROFILE: "off",
      BAA_MCP_MAX_RESPONSE_BYTES: "20971520",
      BAA_MCP_TOOL_FAMILIES: "session",
    };
    const environment = {
      HOME: home,
      USERPROFILE: home,
      QWEN_HOME: join(home, ".qwen"),
      ...selected,
      CALLER_UNRELATED_SETTING: "do not copy",
      BAA_UNKNOWN_SETTING: "do not copy",
      BAA_PROCESS_RUN_ID: "do not copy",
      BAA_TOKEN: "do not copy",
      HOPPER_TARGET_PATH: "do not copy",
    };
    const run = () =>
      cli.run({
        arguments: [
          "setup",
          "--client",
          "qwen_code",
          "--skill=false",
          "--yes",
          "--json",
        ],
        cwd: home,
        environment,
      });
    const setup = await run();
    expect(setup.exitCode, setup.stdout).toBe(0);
    const configured = await readFile(config, "utf8");
    expect(JSON.parse(configured)).toMatchObject({
      mcpServers: { baa: { env: selected } },
    });
    expect(configured).not.toContain("do not copy");
    // A later setup must update a selection rather than retaining the first value.
    selected.BAA_MCP_TOOL_FAMILIES = "session,application";
    environment.BAA_MCP_TOOL_FAMILIES = selected.BAA_MCP_TOOL_FAMILIES;
    selected.BAA_OBJDUMP_COMMAND = join(home, "replacement-objdump");
    environment.BAA_OBJDUMP_COMMAND = selected.BAA_OBJDUMP_COMMAND;
    selected.HOPPER_LOADER_ARGS_JSON = "[]";
    environment.HOPPER_LOADER_ARGS_JSON = selected.HOPPER_LOADER_ARGS_JSON;
    // Empty headless heap explicitly selects the lower-priority caller value.
    selected.GHIDRA_HEADLESS_MAXMEM = "";
    selected.GHIDRA_MAXMEM = "768M";
    environment.GHIDRA_HEADLESS_MAXMEM = selected.GHIDRA_HEADLESS_MAXMEM;
    environment.GHIDRA_MAXMEM = selected.GHIDRA_MAXMEM;
    const updated = await run();
    expect(updated.exitCode, updated.stdout).toBe(0);
    const updatedConfiguration = await readFile(config, "utf8");
    expect(JSON.parse(updatedConfiguration)).toMatchObject({
      mcpServers: { baa: { env: selected } },
    });
    expect(updatedConfiguration).not.toContain("do not copy");
    const repeated = await run();
    expect(repeated.exitCode, repeated.stdout).toBe(0);
    expect(repeated.json).toMatchObject({
      plannedActions: [],
      appliedActions: [],
    });
    expect(await readFile(config, "utf8")).toBe(updatedConfiguration);
  },
);

cliTest(
  "persists, updates and validates tool-family scopes without losing client configuration",
  async ({ cli }) => {
    const home = await createTestTempDirectory("baa-family-registration-");
    const config = join(home, ".qwen/settings.json");
    const foreign = { command: "foreign-tool", args: ["keep"] };
    const original = JSON.stringify({ mcpServers: { foreign } });
    await mkdir(dirname(config), { recursive: true });
    await writeFile(config, original);
    const environment = {
      HOME: home,
      USERPROFILE: home,
      QWEN_HOME: join(home, ".qwen"),
      ...missingHopperAndGhidraEnvironment(home),
      BAA_MCP_INPUT_SCHEMA_PROFILE: "compact",
      BAA_MCP_OUTPUT_SCHEMA_PROFILE: "compact",
    };
    const run = (families: string) =>
      cli.run({
        arguments: [
          "setup",
          "--client",
          "qwen_code",
          "--tool-families",
          families,
          "--skill=false",
          "--yes",
          "--json",
        ],
        cwd: home,
        environment,
      });
    const first = await run("session");
    expect(first.exitCode, first.stdout).toBe(0);
    expect(await readFile(`${config}.baa.backup`, "utf8")).toBe(original);
    const scope = "native,application,session";
    const updated = await run(scope);
    expect(updated.exitCode, updated.stdout).toBe(0);
    const selected = await readFile(config, "utf8");
    expect(JSON.parse(selected)).toMatchObject({
      mcpServers: {
        foreign,
        baa: {
          env: {
            BAA_MCP_TOOL_FAMILIES: scope,
            BAA_MCP_INPUT_SCHEMA_PROFILE: "compact",
            BAA_MCP_OUTPUT_SCHEMA_PROFILE: "compact",
          },
        },
      },
    });
    const backup = await readFile(`${config}.baa.backup`, "utf8");
    const repeated = await run(scope);
    expect(repeated.exitCode, repeated.stdout).toBe(0);
    expect(repeated.json).toMatchObject({
      plannedActions: [],
      appliedActions: [],
    });
    const rejected = await run("session,typo");
    expect(rejected.exitCode).not.toBe(0);
    expect(rejected.stdout + rejected.stderr).toContain(
      "BAA_MCP_TOOL_FAMILIES",
    );
    expect(await readFile(config, "utf8")).toBe(selected);
    expect(await readFile(`${config}.baa.backup`, "utf8")).toBe(backup);
  },
);

cliTest.skipIf(process.platform !== "win32")(
  "rejects lowercase Windows provider settings in doctor and setup without writing",
  async ({ cli }) => {
    const home = await createTestTempDirectory("baa-registration-case-");
    const config = join(home, ".cursor/mcp.json");
    await mkdir(dirname(config), { recursive: true });
    const original = JSON.stringify({
      mcpServers: {
        baa: clientRegistrationEntry(
          "json",
          [process.execPath, resolve("scripts/baa.mjs"), "mcp"],
          { baa_analysis_provider: "invalid provider" },
        ),
      },
    });
    await writeFile(config, original);
    const environment = {
      HOME: home,
      USERPROFILE: home,
      XDG_CONFIG_HOME: join(home, ".config"),
      ...missingHopperAndGhidraEnvironment(home),
    };
    const doctor = await cli.run({
      arguments: ["doctor", "--client", "cursor", "--skill=false", "--json"],
      cwd: home,
      environment,
    });
    expect(doctor.exitCode).toBe(1);
    expect(doctor.json).toMatchObject({
      scope_checks: expect.arrayContaining([
        expect.objectContaining({
          name: "registration:cursor",
          ok: false,
          classification: "config_drift",
          remediation: expect.stringContaining("BAA_ANALYSIS_PROVIDER"),
        }),
      ]),
    });
    const setup = await cli.run({
      arguments: [
        "setup",
        "--client",
        "cursor",
        "--skill=false",
        "--yes",
        "--json",
      ],
      cwd: home,
      environment,
    });
    expect(setup.exitCode).toBe(1);
    expect(setup.json).toMatchObject({
      status: "needs_human",
      plannedActions: [],
      appliedActions: [],
      remediation: expect.stringContaining("BAA_ANALYSIS_PROVIDER"),
    });
    expect(await readFile(config, "utf8")).toBe(original);
    await expect(access(`${config}.baa.backup`)).rejects.toMatchObject({
      code: "ENOENT",
    });
  },
);

const scenarios = [
  {
    client: "cursor",
    format: "json",
    path: ".cursor/mcp.json",
    setting: "HOPPER_LOADER_ARGS_JSON",
    invalid: { HOPPER_LOADER_ARGS_JSON: "{" },
    repaired: { HOPPER_LOADER_ARGS_JSON: '["", "--loader", "Mach-O"]' },
  },
  {
    client: "dsh",
    format: "dsh",
    path: ".dsh/cordis.patch.yml",
    setting: "BAA_GHIDRA_COMPILER_SPEC_ID",
    invalid: { BAA_GHIDRA_COMPILER_SPEC_ID: "borlandcpp" },
    repaired: {
      BAA_GHIDRA_COMPILER_SPEC_ID: "borlandcpp",
      BAA_GHIDRA_LANGUAGE_ID: "x86:LE:32:default",
    },
  },
] as const;

cliTest.for([
  {
    client: "cursor",
    format: "json",
    path: ".cursor/mcp.json",
    position: "value",
  },
  {
    client: "cursor",
    format: "json",
    path: ".cursor/mcp.json",
    position: "name",
  },
  {
    client: "dsh",
    format: "dsh",
    path: ".dsh/cordis.patch.yml",
    position: "value",
  },
  {
    client: "dsh",
    format: "dsh",
    path: ".dsh/cordis.patch.yml",
    position: "name",
  },
  {
    client: "dsh",
    format: "dsh",
    path: ".dsh/cordis.patch.yml",
    position: "expression name",
  },
] as const)(
  "refuses a NUL environment $position in $client before setup writes",
  async (scenario, { cli }) => {
    const home = await createTestTempDirectory("baa-registration-nul-");
    const config = join(home, scenario.path);
    await mkdir(dirname(config), { recursive: true });
    const environment = {
      HOME: home,
      USERPROFILE: home,
      XDG_CONFIG_HOME: join(home, ".config"),
      DSH_HOME: join(home, ".dsh"),
      ...missingHopperAndGhidraEnvironment(home),
    };
    const registration = (env: Readonly<Record<string, string>>) => {
      const entry = clientRegistrationEntry(
        scenario.format,
        [process.execPath, resolve("scripts/baa.mjs"), "mcp"],
        env,
      );
      if (scenario.position === "expression name")
        entry.env = Object.fromEntries(
          Object.entries(env).map(([key, value]) => {
            if (!key.includes("\0")) return [key, value];
            const expression = new Scalar("process.env.CALLER_SETTING");
            expression.tag = "tag:yaml.org,2002:js";
            return [key, expression];
          }),
        );
      return scenario.format === "dsh"
        ? stringify([
            {
              insert: [
                {
                  id: "baa-mcp",
                  name: "@deepseek-ai/dsh-mcp-client",
                  config: entry,
                },
              ],
            },
          ])
        : JSON.stringify({ mcpServers: { baa: entry } });
    };
    const valueMarker = "reaNulFixtureValue_6c04e2";
    const original = registration(
      scenario.position === "value"
        ? { CALLER_SETTING: `${valueMarker}\0value` }
        : { ["CALLER\0SETTING"]: `${valueMarker} value` },
    );
    await writeFile(config, original);
    const doctor = await cli.run({
      arguments: [
        "doctor",
        "--client",
        scenario.client,
        "--skill=false",
        "--json",
      ],
      cwd: home,
      environment,
    });
    expect(doctor.exitCode).toBe(1);
    expect(doctor.json).toMatchObject({
      scope_checks: expect.arrayContaining([
        expect.objectContaining({
          name: `registration:${scenario.client}`,
          ok: false,
          classification: "config_drift",
          remediation: expect.stringContaining("NUL"),
        }),
      ]),
    });
    const setup = await cli.run({
      arguments: [
        "setup",
        "--client",
        scenario.client,
        "--skill=false",
        "--yes",
        "--json",
      ],
      cwd: home,
      environment,
    });
    expect(setup.exitCode).toBe(1);
    expect(setup.json).toMatchObject({
      status: "needs_human",
      plannedActions: [],
      appliedActions: [],
      remediation: expect.stringContaining("NUL"),
    });
    expect(setup.stdout + doctor.stdout).not.toContain(valueMarker);
    expect(await readFile(config, "utf8")).toBe(original);
    await expect(access(`${config}.baa.backup`)).rejects.toMatchObject({
      code: "ENOENT",
    });

    const repaired = registration({
      CALLER_SETTING: "ordinary\nvalue=二\t",
      EMPTY_SETTING: "",
    });
    await writeFile(config, repaired);
    const healthy = await cli.run({
      arguments: [
        "doctor",
        "--client",
        scenario.client,
        "--skill=false",
        "--json",
      ],
      cwd: home,
      environment,
    });
    expect(healthy.exitCode, healthy.stdout).toBe(0);
    expect(healthy.json).toMatchObject({ healthy: true });
    expect(await readFile(config, "utf8")).toBe(repaired);
  },
);

for (const scenario of scenarios)
  cliTest(
    `setup and doctor reject ${scenario.client} overrides rejected by MCP startup`,
    async ({ cli }) => {
      const home = await createTestTempDirectory("baa-registration-runtime-");
      const config = join(home, scenario.path);
      await mkdir(dirname(config), { recursive: true });
      const environment = {
        HOME: home,
        USERPROFILE: home,
        XDG_CONFIG_HOME: join(home, ".config"),
        DSH_HOME: join(home, ".dsh"),
        ...missingHopperAndGhidraEnvironment(home),
      };
      const registration = (env: Readonly<Record<string, string>>) => {
        const server = {
          command: "npx",
          args: ["-y", "build-anything-agents@6.6.0", "mcp"],
          env: {
            CALLER_SETTING: "keep exactly",
            ["__proto__"]: "retain caller key",
            ...env,
          },
        };
        return scenario.client === "dsh"
          ? stringify([
              {
                insert: [
                  {
                    id: "baa-mcp",
                    name: "@deepseek-ai/dsh-mcp-client",
                    config: {
                      serverName: "baa",
                      transport: "stdio",
                      ...server,
                    },
                  },
                ],
              },
            ])
          : JSON.stringify({ mcpServers: { baa: server } });
      };
      const original = registration(scenario.invalid);
      await writeFile(config, original);
      const startup = await cli.run({
        arguments: ["mcp"],
        cwd: home,
        environment: { ...environment, ...scenario.invalid },
      });
      expect(startup.exitCode).toBe(1);
      expect(startup.stderr).toContain(scenario.setting);
      expect(startup.stdout).toBe("");
      const run = (args: readonly string[]) =>
        cli.run({ arguments: [...args, "--json"], cwd: home, environment });
      const setup = await run([
        "setup",
        "--client",
        scenario.client,
        "--skill=false",
        "--yes",
      ]);
      expect(setup.exitCode).toBe(1);
      expect(setup.json).toMatchObject({
        status: "needs_human",
        plannedActions: [],
        appliedActions: [],
        remediation: expect.stringContaining(scenario.setting),
      });
      const doctor = await run(["doctor", "--client", scenario.client]);
      expect(doctor.exitCode).toBe(1);
      expect(doctor.json).toMatchObject({
        identity: {
          registrations: expect.arrayContaining([
            expect.objectContaining({
              client: scenario.client,
              state: "invalid",
              remediation: expect.stringContaining(scenario.setting),
            }),
          ]),
        },
      });
      expect(await readFile(config, "utf8")).toBe(original);
      await expect(access(`${config}.baa.backup`)).rejects.toMatchObject({
        code: "ENOENT",
      });

      // Model the caller repairing the named setting before rerunning setup.
      const repaired = registration(scenario.repaired);
      await writeFile(config, repaired);
      const configured = await run([
        "setup",
        "--client",
        scenario.client,
        "--skill=false",
        "--yes",
      ]);
      expect(configured.exitCode, configured.stdout).toBe(0);
      const text = await readFile(config, "utf8");
      const parsed = parseClientConfiguration(text, scenario.format);
      expect(effectiveClientServer(parsed, "baa")).toMatchObject({
        env: {
          CALLER_SETTING: "keep exactly",
          ["__proto__"]: "retain caller key",
          ...scenario.repaired,
        },
      });
      expect(await readFile(`${config}.baa.backup`, "utf8")).toBe(repaired);
      const repeated = await run([
        "setup",
        "--client",
        scenario.client,
        "--skill=false",
        "--yes",
      ]);
      expect(repeated.json).toMatchObject({
        status: "ready",
        appliedActions: [],
        plannedActions: [],
      });
      expect(await readFile(config, "utf8")).toBe(text);
    },
  );

cliTest(
  "OpenCode CLI validates dependent settings after merging JSON and JSONC",
  async ({ cli }) => {
    const home = await createTestTempDirectory("baa-layered-runtime-cli-");
    const directory = join(home, ".config/opencode");
    await mkdir(directory, { recursive: true });
    const lower = join(directory, "opencode.json");
    const upper = join(directory, "opencode.jsonc");
    const content = (env: Record<string, string>) =>
      JSON.stringify({
        mcp: {
          baa: clientRegistrationEntry(
            "opencode",
            [process.execPath, resolve("scripts/baa.mjs"), "mcp"],
            env,
          ),
        },
      });
    const lowerContent = content({
      BAA_GHIDRA_LANGUAGE_ID: "x86:LE:32:default",
    });
    const upperContent = content({
      ...missingHopperAndGhidraEnvironment(home),
      BAA_GHIDRA_COMPILER_SPEC_ID: "borlandcpp",
    });
    await writeFile(lower, lowerContent);
    await writeFile(upper, upperContent);
    const environment = {
      HOME: home,
      USERPROFILE: home,
      XDG_CONFIG_HOME: join(home, ".config"),
      ...missingHopperAndGhidraEnvironment(home),
    };
    const run = (args: readonly string[]) =>
      cli.run({ arguments: [...args, "--json"], cwd: home, environment });
    const setup = await run([
      "setup",
      "--client",
      "opencode",
      "--skill=false",
      "--yes",
    ]);
    expect(setup.exitCode, setup.stdout).toBe(0);
    expect(setup.json).toMatchObject({
      status: "ready",
      plannedActions: [],
      appliedActions: [],
    });
    const doctor = await run(["doctor", "--client", "opencode"]);
    expect(doctor.exitCode, doctor.stdout).toBe(0);
    expect(doctor.json).toMatchObject({
      identity: {
        registrations: expect.arrayContaining([
          expect.objectContaining({ client: "opencode", state: "aligned" }),
        ]),
      },
    });
    expect(await readFile(lower, "utf8")).toBe(lowerContent);
    expect(await readFile(upper, "utf8")).toBe(upperContent);
    await writeFile(lower, content({ CALLER_SETTING: "retained" }));
    const missing = await run([
      "setup",
      "--client",
      "opencode",
      "--skill=false",
      "--yes",
    ]);
    expect(missing.exitCode).toBe(1);
    expect(missing.json).toMatchObject({
      status: "needs_human",
      plannedActions: [],
      appliedActions: [],
      remediation: expect.stringContaining("BAA_GHIDRA_COMPILER_SPEC_ID"),
    });
    const invalidDoctor = await run(["doctor", "--client", "opencode"]);
    expect(invalidDoctor.exitCode).toBe(1);
    expect(invalidDoctor.json).toMatchObject({
      identity: {
        registrations: expect.arrayContaining([
          expect.objectContaining({ client: "opencode", state: "invalid" }),
        ]),
      },
    });
    expect(await readFile(upper, "utf8")).toBe(upperContent);
    for (const path of [lower, upper])
      await expect(access(`${path}.baa.backup`)).rejects.toMatchObject({
        code: "ENOENT",
      });
  },
);

cliTest(
  "public setup propagates selected provider deadlines and input profile to Codex and Kimi",
  async ({ cli }) => {
    const home = await createTestTempDirectory(
      "baa-selected-registration-env-",
    );
    const codexHome = join(home, "codex");
    const kimiHome = join(home, "kimi");
    await Promise.all(
      [codexHome, kimiHome].map((path) => mkdir(path, { recursive: true })),
    );
    const environment = {
      HOME: home,
      USERPROFILE: home,
      XDG_CONFIG_HOME: join(home, ".config"),
      CODEX_HOME: codexHome,
      KIMI_CODE_HOME: kimiHome,
      ...missingHopperAndGhidraEnvironment(home),
      BAA_ANALYSIS_PROVIDER: "auto",
      BAA_BRIDGE_MAX_REQUEST_BYTES: "33554432",
      BAA_GHIDRA_STARTUP_TIMEOUT_MS: "2700001",
      BAA_HOPPER_STARTUP_TIMEOUT_MS: "2800002",
      BAA_JEB_MCP_TIMEOUT_MS: "2900003",
      BAA_MCP_INPUT_SCHEMA_PROFILE: "full",
      BAA_CAPTURE_DECODER_OLD_GENERATION_MIB: "256",
      BAA_REGEX_MATCHING_DEADLINE_MS: "10000",
      BAA_REGEX_WORKER_HEAP_REQUEST_MIB: "256",
      BAA_MCP_INITIALIZE_BUDGET_MS: "16000",
      BAA_MCP_TOOLS_LIST_BUDGET_MS: "6000",
      BAA_MCP_FIRST_CATALOG_BUDGET_MS: "21000",
      BAA_MCP_DOCTOR_DEADLINE_MS: "31000",
      BAA_UNRELATED_MARKER: "do-not-persist",
    };
    const run = (arguments_: readonly string[]) =>
      cli.run({
        arguments: [...arguments_, "--json"],
        cwd: home,
        environment,
      });

    for (const client of ["codex", "kimi"] as const) {
      const setup = await run([
        "setup",
        "--client",
        client,
        "--skill=false",
        "--yes",
      ]);
      expect(setup.exitCode, setup.stderr).toBe(0);
      expect(setup.json).toMatchObject({ status: "ready" });
    }

    const codexConfig = await readFile(join(codexHome, "config.toml"), "utf8");
    const codexRegistration = effectiveClientServer(
      parseClientConfiguration(codexConfig, "toml"),
      "baa",
    );
    expect(codexRegistration).toMatchObject({ tool_timeout_sec: 3021 });
    expect(codexConfig).toContain('BAA_BRIDGE_MAX_REQUEST_BYTES = "33554432"');
    expect(codexConfig).toContain('BAA_JEB_MCP_TIMEOUT_MS = "2900003"');
    expect(codexConfig).toContain(
      'BAA_CAPTURE_DECODER_OLD_GENERATION_MIB = "256"',
    );
    expect(codexConfig).toContain('BAA_REGEX_MATCHING_DEADLINE_MS = "10000"');
    expect(codexConfig).toContain('BAA_REGEX_WORKER_HEAP_REQUEST_MIB = "256"');
    expect(codexConfig).toContain('BAA_MCP_INITIALIZE_BUDGET_MS = "16000"');
    expect(codexConfig).toContain('BAA_MCP_TOOLS_LIST_BUDGET_MS = "6000"');
    expect(codexConfig).toContain('BAA_MCP_FIRST_CATALOG_BUDGET_MS = "21000"');
    expect(codexConfig).toContain('BAA_MCP_DOCTOR_DEADLINE_MS = "31000"');
    expect(codexConfig).not.toContain("BAA_UNRELATED_MARKER");

    const kimiPath = join(kimiHome, "mcp.json");
    const kimiRegistration = effectiveClientServer(
      parseClientConfiguration(await readFile(kimiPath, "utf8"), "kimi"),
      "baa",
    );
    expect(kimiRegistration).toMatchObject({
      toolTimeoutMs: 3_020_003,
      env: {
        BAA_ANALYSIS_PROVIDER: "auto",
        BAA_BRIDGE_MAX_REQUEST_BYTES: "33554432",
        BAA_GHIDRA_STARTUP_TIMEOUT_MS: "2700001",
        BAA_HOPPER_STARTUP_TIMEOUT_MS: "2800002",
        BAA_JEB_MCP_TIMEOUT_MS: "2900003",
        BAA_MCP_INPUT_SCHEMA_PROFILE: "full",
        BAA_CAPTURE_DECODER_OLD_GENERATION_MIB: "256",
        BAA_REGEX_MATCHING_DEADLINE_MS: "10000",
        BAA_REGEX_WORKER_HEAP_REQUEST_MIB: "256",
        BAA_MCP_INITIALIZE_BUDGET_MS: "16000",
        BAA_MCP_TOOLS_LIST_BUDGET_MS: "6000",
        BAA_MCP_FIRST_CATALOG_BUDGET_MS: "21000",
        BAA_MCP_DOCTOR_DEADLINE_MS: "31000",
      },
    });
    expect(await readFile(kimiPath, "utf8")).not.toContain(
      "BAA_UNRELATED_MARKER",
    );

    const doctor = await run(["doctor", "--client", "kimi"]);
    expect(doctor.exitCode, doctor.stderr).toBe(0);
    expect(doctor.json).toMatchObject({
      identity: {
        registrations: expect.arrayContaining([
          expect.objectContaining({ client: "kimi", state: "aligned" }),
        ]),
      },
    });
  },
  120_000,
);

for (const [client, provider] of [
  ["codex", "ida"],
  ["kimi", "ida"],
  ["kimi", "auto"],
] as const)
  cliTest(
    `public ${client} setup and doctor use the effective IDA registration request budget with ${provider} selection`,
    async ({ cli }) => {
      const home = await createTestTempDirectory(
        "baa-ida-registration-budget-",
      );
      const clientHome = join(home, client);
      await mkdir(clientHome, { recursive: true });
      const idaConfig = join(home, "ida.json");
      const writeRegistration = (timeoutMs: number) =>
        writeFile(
          idaConfig,
          JSON.stringify({
            url: "http://127.0.0.1:12345/mcp",
            headers: { Authorization: "Bearer fixture-credential" },
            timeoutMs,
          }),
        );
      await writeRegistration(1_800_001);
      const environment = {
        HOME: home,
        USERPROFILE: home,
        XDG_CONFIG_HOME: join(home, ".config"),
        CODEX_HOME: clientHome,
        KIMI_CODE_HOME: clientHome,
        ...missingHopperAndGhidraEnvironment(home),
      };
      const setupArguments = [
        "setup",
        "--client",
        client,
        "--skill=false",
        "--yes",
        "--json",
      ];
      const configured = await cli.run({
        arguments: setupArguments,
        cwd: home,
        environment: {
          ...environment,
          BAA_ANALYSIS_PROVIDER: provider,
          BAA_IDA_MCP_CONFIG: idaConfig,
        },
      });
      expect(configured.exitCode, configured.stdout).toBe(0);
      const config = join(
        clientHome,
        client === "codex" ? "config.toml" : "mcp.json",
      );
      const text = await readFile(config, "utf8");
      expect(
        effectiveClientServer(
          parseClientConfiguration(text, client === "codex" ? "toml" : "kimi"),
          "baa",
        ),
      ).toMatchObject({
        ...(client === "codex"
          ? { tool_timeout_sec: 1921 }
          : { toolTimeoutMs: 1_920_001 }),
        env: { BAA_ANALYSIS_PROVIDER: provider, BAA_IDA_MCP_CONFIG: idaConfig },
      });
      expect(text).not.toContain("fixture-credential");
      const run = (arguments_: readonly string[]) =>
        cli.run({ arguments: arguments_, cwd: home, environment });
      const healthy = await run(["doctor", "--client", client, "--json"]);
      expect(healthy.exitCode, healthy.stdout).toBe(0);
      expect(JSON.stringify(healthy.json)).not.toContain('"advisory"');

      // Only the stored client's provider path identifies this changed budget;
      // the doctor/setup process has no IDA configuration in its environment.
      await writeRegistration(2_400_001);
      const doctor = await run(["doctor", "--client", client, "--json"]);
      expect(doctor.exitCode, doctor.stdout).toBe(0);
      expect(doctor.json).toMatchObject({
        identity: {
          registrations: expect.arrayContaining([
            expect.objectContaining({
              client,
              state: "aligned",
              advisory: expect.stringContaining(
                client === "codex"
                  ? "tool_timeout_sec = 2521 seconds"
                  : "toolTimeoutMs = 2520001 ms",
              ),
            }),
          ]),
        },
      });
      const repeated = await run(setupArguments);
      expect(repeated.exitCode, repeated.stdout).toBe(0);
      expect(repeated.json).toMatchObject({
        status: "ready",
        plannedActions: [],
        appliedActions: [],
      });
      expect(await readFile(config, "utf8")).toBe(text);
      await expect(access(`${config}.baa.backup`)).rejects.toMatchObject({
        code: "ENOENT",
      });
      if (provider === "ida") {
        await writeRegistration(0);
        const invalidDoctor = await run([
          "doctor",
          "--client",
          client,
          "--json",
        ]);
        expect(invalidDoctor.exitCode).toBe(1);
        expect(invalidDoctor.json).toMatchObject({
          identity: {
            registrations: expect.arrayContaining([
              expect.objectContaining({
                client,
                state: "invalid",
                remediation: expect.stringContaining("BAA_IDA_MCP_CONFIG"),
              }),
            ]),
          },
        });
        const invalidSetup = await run(setupArguments);
        expect(invalidSetup.exitCode).toBe(1);
        expect(invalidSetup.stdout).toContain("BAA_IDA_MCP_CONFIG");
        expect(await readFile(config, "utf8")).toBe(text);
        await expect(access(`${config}.baa.backup`)).rejects.toMatchObject({
          code: "ENOENT",
        });
      }
    },
    120_000,
  );

for (const invalidSetting of [
  { setting: "BAA_MCP_INPUT_SCHEMA_PROFILE", value: "unknown" },
  { setting: "BAA_GHIDRA_STARTUP_TIMEOUT_MS", value: "0" },
  { setting: "BAA_JEB_MCP_TIMEOUT_MS", value: "1.5" },
] as const)
  cliTest(
    `setup rejects malformed selected ${invalidSetting.setting} before writing`,
    async ({ cli }) => {
      const home = await createTestTempDirectory(
        "baa-invalid-selected-registration-env-",
      );
      const kimiHome = join(home, "kimi");
      await mkdir(kimiHome, { recursive: true });
      const config = join(kimiHome, "mcp.json");
      const environment = {
        HOME: home,
        USERPROFILE: home,
        XDG_CONFIG_HOME: join(home, ".config"),
        KIMI_CODE_HOME: kimiHome,
        ...missingHopperAndGhidraEnvironment(home),
        [invalidSetting.setting]: invalidSetting.value,
      };
      const result = await cli.run({
        arguments: [
          "setup",
          "--client",
          "kimi",
          "--skill=false",
          "--yes",
          "--json",
        ],
        cwd: home,
        environment,
      });
      expect(result.exitCode).toBe(1);
      expect(result.json).toMatchObject({
        status: "needs_human",
        plannedActions: [],
        appliedActions: [],
        remediation: expect.stringContaining(invalidSetting.setting),
      });
      expect(`${result.stdout}\n${result.stderr}`).toContain(
        invalidSetting.setting,
      );
      await expect(access(config)).rejects.toMatchObject({ code: "ENOENT" });
      await expect(access(`${config}.baa.backup`)).rejects.toMatchObject({
        code: "ENOENT",
      });
    },
    120_000,
  );

cliTest(
  "public VS Code setup registers in VSCODE_APPDATA without changing the default configuration",
  async ({ cli }) => {
    const home = await createTestTempDirectory("baa-vscode-appdata-cli-");
    const selectedData = join(home, "selected data");
    const config = join(selectedData, "Code", "User", "mcp.json");
    const defaultData =
      process.platform === "win32"
        ? join(home, "AppData", "Roaming")
        : process.platform === "darwin"
          ? join(home, "Library", "Application Support")
          : join(home, ".config");
    const defaultConfig = join(defaultData, "Code", "User", "mcp.json");
    const original = JSON.stringify({
      servers: { foreign: { command: "keep" } },
    });
    const defaultOriginal = JSON.stringify({
      servers: { defaultServer: { command: "untouched" } },
    });
    await mkdir(dirname(config), { recursive: true });
    await mkdir(dirname(defaultConfig), { recursive: true });
    await writeFile(config, original);
    await writeFile(defaultConfig, defaultOriginal);
    const setup = await cli.run({
      arguments: [
        "setup",
        "--client",
        "vscode",
        "--skill=false",
        "--yes",
        "--json",
      ],
      cwd: home,
      environment: {
        HOME: home,
        USERPROFILE: home,
        APPDATA: join(home, "AppData", "Roaming"),
        XDG_CONFIG_HOME: join(home, ".config"),
        VSCODE_APPDATA: selectedData,
        VSCODE_PORTABLE: "",
        ...missingHopperAndGhidraEnvironment(home),
      },
    });
    expect(setup.exitCode, setup.stdout + setup.stderr).toBe(0);
    expect(setup.json).toMatchObject({ status: "ready" });
    expect(JSON.parse(await readFile(config, "utf8"))).toMatchObject({
      servers: {
        foreign: { command: "keep" },
        baa: {
          command: process.execPath,
          args: [resolve("scripts/baa.mjs"), "mcp"],
        },
      },
    });
    expect(await readFile(`${config}.baa.backup`, "utf8")).toBe(original);
    expect(await readFile(defaultConfig, "utf8")).toBe(defaultOriginal);
    await expect(access(`${defaultConfig}.baa.backup`)).rejects.toMatchObject({
      code: "ENOENT",
    });
  },
  120_000,
);
