import type { DoctorProviderInspection } from "./Doctor.js";
import { compareUnicodeCodePoints } from "../domain/unicodeCodePointOrder.js";

const SELECTED_REGISTRATION_SETTINGS = [
  "GHIDRA_INSTALL_DIR",
  "GHIDRA_HEADLESS_MAXMEM",
  "GHIDRA_MAXMEM",
  "JAVA_HOME",
  "HOPPER_LAUNCHER_PATH",
  "HOPPER_LOADER_ARGS_JSON",
  "BAA_ILSPY_CMD_PATH",
  "BAA_ADB_PATH",
  "BAA_APKTOOL_COMMAND",
  "BAA_TSHARK_COMMAND",
  "BAA_CAPINFOS_COMMAND",
  "BAA_TSHARK_PRLIMIT_COMMAND",
  "BAA_OBJDUMP_COMMAND",
  "BAA_GDB_COMMAND",
  "BAA_RIZIN_COMMAND",
  "BAA_CUTTER_BRIDGE_DIR",
  "BAA_WABT_BIN_DIRECTORY",
  "BAA_WAKARU_COMMAND",
  "BAA_JAVASCRIPT_PRLIMIT_COMMAND",
  "BAA_BINWALK_COMMAND",
  "BAA_UNBLOB_COMMAND",
  "BAA_FIRMWARE_PRLIMIT_COMMAND",
  "BAA_EVM_PRLIMIT_COMMAND",
  "BAA_SIGROK_COMMAND",
  "BAA_SIGROK_PRLIMIT_COMMAND",
  "BAA_MITMDUMP_COMMAND",
  "BAA_BROWSER_EXECUTABLE",
  "BAA_BROWSER_NO_SANDBOX",
  "BAA_PWNTOOLS_PYTHON",
  "BAA_PWNTOOLS_MAX_INPUT_BYTES",
  "BAA_PWNDBG_GDB",
  "BAA_PWNDBG_GDBINIT",
  "BAA_PWNDBG_VENV_PATH",
  "BAA_DARWIN_SWIFTC_PATH",
  "BAA_DARWIN_MODULE_CACHE_PATH",
  "SDKROOT",
  "BAA_SWIFTC_COMPILE_TIMEOUT_MS",
  "BAA_LOG_LEVEL",
  "BAA_REFERENCE_SECRET_PATTERNS_JSON",
  "BAA_IDA_MCP_CONFIG",
  "BAA_JADX_MCP_JAR",
  "BAA_JADX_HEAP_MIB",
  "BAA_JADX_ACTIVE_PROCESSOR_COUNT",
  "BAA_JADX_OPERATION_TIMEOUT_MS",
  "BAA_KUNA_COMMAND",
  "BAA_KUNA_CACHE_DIR",
  "BAA_KUNA_CACHE_MAX_BYTES",
  "BAA_KUNA_PROJECT_TIMEOUT_MS",
  "BAA_KUNA_TIMEOUT_MS",
  "BAA_KUNA_JOBS",
  "BAA_ANALYSIS_PROVIDER",
  "BAA_ASAR_MAX_HEADER_BYTES",
  "BAA_BRIDGE_MAX_REQUEST_BYTES",
  "BAA_CAPTURE_DECODER_OLD_GENERATION_MIB",
  "BAA_GHIDRA_DECOMPILE_TIMEOUT_SECONDS",
  "BAA_GHIDRA_STARTUP_TIMEOUT_MS",
  "BAA_GHIDRA_LANGUAGE_ID",
  "BAA_GHIDRA_COMPILER_SPEC_ID",
  "BAA_GHIDRA_DISABLED_ANALYZERS",
  "BAA_GHIDRA_SEED_FILE",
  "BAA_GHIDRA_PROJECT_PATH",
  "BAA_GHIDRA_PROGRAM_NAME",
  "BAA_GHIDRA_NATIVEAOT_JAR",
  "BAA_HOPPER_CALLER_SCAN_BUDGET_MS",
  "BAA_HOPPER_STARTUP_TIMEOUT_MS",
  "BAA_JEB_MCP_URL",
  "BAA_JEB_MCP_TIMEOUT_MS",
  "BAA_MCP_INPUT_SCHEMA_PROFILE",
  "BAA_MCP_TOOL_FAMILIES",
  "BAA_MCP_OUTPUT_SCHEMA_PROFILE",
  "BAA_MCP_MAX_RESPONSE_BYTES",
  "BAA_MCP_MAX_INPUT_ELEMENTS",
  "BAA_NATIVE_MATCHING_REPRESENTATION_BYTES",
  "BAA_REGEX_MATCHING_DEADLINE_MS",
  "BAA_REGEX_WORKER_HEAP_REQUEST_MIB",
  "BAA_MCP_INITIALIZE_BUDGET_MS",
  "BAA_MCP_TOOLS_LIST_BUDGET_MS",
  "BAA_MCP_FIRST_CATALOG_BUDGET_MS",
  "BAA_MCP_DOCTOR_DEADLINE_MS",
] as const;

/** Explicit selections override discovered defaults even when a provider is unavailable.
 * This is a registration policy, not a prefix match against the ambient environment.
 */
export const explicitSetupRegistrationEnvironment = (
  environment: Readonly<Record<string, string | undefined>>,
): Readonly<Record<string, string>> =>
  Object.fromEntries(
    SELECTED_REGISTRATION_SETTINGS.flatMap((key) => {
      const value = environment[key];
      return value === undefined ? [] : [[key, value]];
    }),
  );

/** Discovered provider defaults; explicit selections are applied separately. */
export const providerRegistrationEnvironment = (
  inspections: readonly DoctorProviderInspection[],
): Readonly<Record<string, string>> =>
  Object.fromEntries(
    inspections
      .flatMap(({ registrationEnvironment }) =>
        Object.entries(registrationEnvironment),
      )
      .sort(([left], [right]) => compareUnicodeCodePoints(left, right)),
  );

/** Spell selected settings as setup records them: an explicit selection wins. */
export const registrationSpelledSettings = (
  settings: Readonly<Record<string, string>>,
  environment: Readonly<Record<string, string | undefined>>,
): Readonly<Record<string, string>> => {
  const explicit = explicitSetupRegistrationEnvironment(environment);
  return Object.fromEntries(
    Object.entries(settings).map(([key, value]) => [
      key,
      explicit[key] ?? value,
    ]),
  );
};
