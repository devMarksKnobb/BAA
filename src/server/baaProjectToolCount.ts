/** Public BAA MCP tools exposed by the project-only profile. */
export const BAA_PROJECT_TOOL_NAMES = [
  "baa_project_targets",
  "baa_project_analyze",
  "baa_project_generate",
  "baa_project_verify",
] as const;

export const BAA_PROJECT_TOOL_COUNT = BAA_PROJECT_TOOL_NAMES.length;
