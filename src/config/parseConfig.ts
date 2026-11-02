import { accessSync, constants, statSync } from "node:fs";

import {
  ConfigurationError,
  type ConfigurationSettingIssue,
} from "../domain/configurationErrors.js";
import { err, ok, type Result } from "../domain/result.js";
import { parseEnvironment } from "./environment.js";
import { providerStartupTimeoutSchema } from "./providerStartupTimeout.js";
import { homeDirectoryFromEnvironment } from "./homeDirectory.js";
import { DEFAULT_BRIDGE_MAX_REQUEST } from "./bridgeMaxRequestBytes.js";
import { hopperCallerScanBudgetFromEnvironment } from "./hopperCallerScanBudget.js";
import { DEFAULT_REGEX_MATCHING_DEADLINE } from "./regexMatchingDeadline.js";
import { DEFAULT_REGEX_WORKER_HEAP_REQUEST } from "./regexWorkerHeapRequest.js";
import type { AppConfig } from "./types.js";
import { hopperLauncherDiscovery } from "../application/HopperLauncherDiscovery.js";
import { localMacHopperRenamedLauncherCandidates } from "../application/MacHopperPaths.js";
const executableAvailable = (path: string): boolean => {
  try {
    accessSync(path, constants.X_OK);
    return statSync(path).isFile();
  } catch {
    return false;
  }
};

export const defaultHopperLauncherPath = (
  platform: NodeJS.Platform,
  homeDirectory: string,
  executable: (path: string) => boolean = executableAvailable,
): string => {
  const discovery = hopperLauncherDiscovery(platform, homeDirectory);
  for (const candidate of discovery.candidates)
    if (executable(candidate)) return candidate;
  if (discovery.probesMacApplicationBundles)
    for (const candidate of localMacHopperRenamedLauncherCandidates(
      homeDirectory,
    ))
      if (executable(candidate)) return candidate;
  return discovery.fallback;
};

/**
 * Environment native analysis admits. JEB validates its own settings during
 * optional provider composition; that setting must not block unrelated
 * CLI/MCP startup. Registration validation still checks it directly.
 */
const nativeAnalysisEnvironment = (
  environment: Readonly<Record<string, string | undefined>>,
): Readonly<Record<string, string | undefined>> => {
  const {
    BAA_JEB_MCP_TIMEOUT_MS: _jebTimeout,
    BAA_JEB_MCP_URL: _jebUrl,
    ...appEnvironment
  } = environment;
  return appEnvironment;
};

/** Native admission issues and an explicitly configured timeout's independent facts. */
export interface NativeAnalysisConfigurationInspection {
  readonly issues: readonly ConfigurationSettingIssue[];
  readonly configuredHopperStartupTimeout?: Result<number, ConfigurationError>;
}

/** Inspect native admission without probing launchers or losing mixed-invalid diagnostics. */
export const inspectNativeAnalysisConfiguration = (
  environment: Readonly<Record<string, string | undefined>>,
): NativeAnalysisConfigurationInspection => {
  const parsed = parseEnvironment(nativeAnalysisEnvironment(environment));
  const issues = parsed.ok ? [] : parsed.error.settings;
  const configuredTimeout = environment.BAA_HOPPER_STARTUP_TIMEOUT_MS;
  if (configuredTimeout === undefined) return { issues };
  if (parsed.ok)
    return {
      issues,
      configuredHopperStartupTimeout: ok(
        parsed.value.BAA_HOPPER_STARTUP_TIMEOUT_MS,
      ),
    };
  // Another setting may reject the aggregate before this supplied timeout's
  // facts are available. Its dedicated diagnostic still uses the same schema.
  const timeout = providerStartupTimeoutSchema.safeParse(configuredTimeout);
  return {
    issues,
    configuredHopperStartupTimeout: timeout.success
      ? ok(timeout.data)
      : err(
          new ConfigurationError("Invalid BAA environment configuration", {
            cause: timeout.error,
            settings: timeout.error.issues.map(({ message }) => ({
              setting: "BAA_HOPPER_STARTUP_TIMEOUT_MS",
              constraint: message,
            })),
          }),
        ),
  };
};

/** Parse provider configuration and runtime prerequisites at the composition root. */
export const parseConfig = (
  environment: Readonly<Record<string, string | undefined>>,
): Result<AppConfig, ConfigurationError> => {
  const parsed = parseEnvironment(nativeAnalysisEnvironment(environment));
  if (!parsed.ok) return parsed;
  const env = parsed.value;
  return ok({
    ...(env.BAA_MCP_TOOL_FAMILIES === undefined
      ? {}
      : { mcpToolFamilies: env.BAA_MCP_TOOL_FAMILIES }),
    ...(env.BAA_MCP_MAX_RESPONSE_BYTES === undefined
      ? {}
      : { mcpMaxResponseBytes: env.BAA_MCP_MAX_RESPONSE_BYTES }),
    ...(env.BAA_MCP_MAX_INPUT_ELEMENTS === undefined
      ? {}
      : { mcpMaxInputElements: env.BAA_MCP_MAX_INPUT_ELEMENTS }),
    ...(env.BAA_MCP_INPUT_SCHEMA_PROFILE === undefined
      ? {}
      : { mcpInputSchemaProfile: env.BAA_MCP_INPUT_SCHEMA_PROFILE }),
    ...(env.BAA_MCP_OUTPUT_SCHEMA_PROFILE === undefined
      ? {}
      : { mcpOutputSchemaProfile: env.BAA_MCP_OUTPUT_SCHEMA_PROFILE }),
    analysisProvider: env.BAA_ANALYSIS_PROVIDER,
    ...(env.BAA_IDA_MCP_CONFIG === undefined
      ? {}
      : { idaMcpConfigPath: env.BAA_IDA_MCP_CONFIG }),
    ...(env.BAA_GHIDRA_PROJECT_PATH === undefined
      ? {}
      : {
          ghidraExistingProject: {
            path: env.BAA_GHIDRA_PROJECT_PATH,
            ...(env.BAA_GHIDRA_PROGRAM_NAME === undefined
              ? {}
              : { programName: env.BAA_GHIDRA_PROGRAM_NAME }),
          },
        }),
    ghidraInstallDir: env.GHIDRA_INSTALL_DIR,
    ghidraJavaHome: env.JAVA_HOME,
    ghidraStartupTimeoutMs: env.BAA_GHIDRA_STARTUP_TIMEOUT_MS,
    ...(env.BAA_GHIDRA_DECOMPILE_TIMEOUT_SECONDS === undefined
      ? {}
      : {
          ghidraDecompileTimeoutSeconds:
            env.BAA_GHIDRA_DECOMPILE_TIMEOUT_SECONDS,
        }),
    ...(env.BAA_GHIDRA_LANGUAGE_ID === undefined
      ? {}
      : {
          ghidraLanguageOverride: {
            languageId: env.BAA_GHIDRA_LANGUAGE_ID,
            ...(env.BAA_GHIDRA_COMPILER_SPEC_ID === undefined
              ? {}
              : { compilerSpecId: env.BAA_GHIDRA_COMPILER_SPEC_ID }),
          },
        }),
    ...(env.BAA_GHIDRA_SEED_FILE === undefined
      ? {}
      : { ghidraSeedFile: env.BAA_GHIDRA_SEED_FILE }),
    ...(env.BAA_GHIDRA_DISABLED_ANALYZERS === undefined
      ? {}
      : { ghidraDisabledAnalyzers: env.BAA_GHIDRA_DISABLED_ANALYZERS }),
    ...(env.BAA_GHIDRA_NATIVEAOT_JAR === undefined
      ? {}
      : { ghidraNativeAotJar: env.BAA_GHIDRA_NATIVEAOT_JAR }),
    ilspyCmdPath: env.BAA_ILSPY_CMD_PATH,
    hopperLauncherPath:
      env.HOPPER_LAUNCHER_PATH ??
      defaultHopperLauncherPath(
        process.platform,
        homeDirectoryFromEnvironment(environment, process.platform),
      ),
    hopperStartupTimeoutMs: env.BAA_HOPPER_STARTUP_TIMEOUT_MS,
    hopperCallerScanBudget: hopperCallerScanBudgetFromEnvironment(
      environment.BAA_HOPPER_CALLER_SCAN_BUDGET_MS,
      env.BAA_HOPPER_CALLER_SCAN_BUDGET_MS,
    ),
    hopperTargetPath: env.HOPPER_TARGET_PATH,
    hopperTargetKind: env.HOPPER_TARGET_KIND,
    hopperLoaderArgs: env.loaderArgs,
    logLevel: env.BAA_LOG_LEVEL,
    referenceSourcePolicy: {
      secretPatterns: env.referenceSecretPatterns,
    },
    bridgeMaxRequestBytes:
      env.BAA_BRIDGE_MAX_REQUEST_BYTES === undefined
        ? DEFAULT_BRIDGE_MAX_REQUEST
        : {
            maximumBytes: env.BAA_BRIDGE_MAX_REQUEST_BYTES,
            source: "setting",
          },
    regexMatchingDeadline:
      env.BAA_REGEX_MATCHING_DEADLINE_MS === undefined
        ? DEFAULT_REGEX_MATCHING_DEADLINE
        : {
            deadlineMs: env.BAA_REGEX_MATCHING_DEADLINE_MS,
            source: "setting",
          },
    regexWorkerHeapRequest:
      env.BAA_REGEX_WORKER_HEAP_REQUEST_MIB === undefined
        ? DEFAULT_REGEX_WORKER_HEAP_REQUEST
        : {
            heapMiB: env.BAA_REGEX_WORKER_HEAP_REQUEST_MIB,
            source: "setting",
          },
  });
};
