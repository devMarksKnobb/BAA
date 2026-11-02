import { toolFamilyId } from "../contracts/toolFamilies.js";
import { UNTRUSTED_CONTENT_INSTRUCTIONS } from "./toolResultEncoding.js";
import { recoveryInstructions } from "./recoveryInstructions.js";

const TARGET_FREE_INSTRUCTIONS =
  "BAA provides tools to inspect existing software, native binaries, managed code, browser pages, and runtimes, alongside project-generation and verification tools. Use the tool that directly answers the question; discover targets or inspect inventory only when needed. Tool results include inline Evidence and report their coverage and limitations.";

const SESSION_LIFECYCLE_INSTRUCTIONS =
  "An opened target persists across turns. When finished, export needed Evidence and call close_binary; its snapshot_path can retain analysis.";

const ACTIVE_TARGET_INSTRUCTIONS =
  "BAA analyzes the active software target. Use the analysis tool that answers the question directly. Search or list symbols when discovery is needed. Use baa_project_targets, baa_project_analyze, baa_project_generate and baa_project_verify for project creation workflows.";

const FUNCTION_DOSSIER_INSTRUCTIONS =
  "analyze_function provides a function dossier, and focused procedure tools return individual facets.";

const advertisesToolFamily = (
  advertisedToolFamilies: ReadonlySet<string> | undefined,
  tool: string,
): boolean => {
  if (advertisedToolFamilies === undefined) return true;
  const family = toolFamilyId(tool);
  return family !== undefined && advertisedToolFamilies.has(family);
};

export const serverInstructions = (
  hasSession: boolean,
  advertisedToolFamilies: ReadonlySet<string> | undefined,
): string => {
  const guidance = (tool: string, text: string): string =>
    advertisesToolFamily(advertisedToolFamilies, tool) ? ` ${text}` : "";
  const recovery = recoveryInstructions(
    advertisesToolFamily(advertisedToolFamilies, "update_analysis_settings"),
  );
  if (!hasSession)
    return `${ACTIVE_TARGET_INSTRUCTIONS}${guidance("analyze_function", FUNCTION_DOSSIER_INSTRUCTIONS)} ${recovery} ${UNTRUSTED_CONTENT_INSTRUCTIONS}`;
  return `${TARGET_FREE_INSTRUCTIONS}${guidance("close_binary", SESSION_LIFECYCLE_INSTRUCTIONS)} ${recovery} ${UNTRUSTED_CONTENT_INSTRUCTIONS}`;
};
