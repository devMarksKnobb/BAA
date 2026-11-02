/** Required packaged sources, selected by their runtime role rather than order. */
export const GHIDRA_BRIDGE_SOURCES = Object.freeze({
  bridge: "BaaGhidraBridge.java",
  bundleActivator: "BaaGhidraBundleActivator.java",
  extensions: "BaaGhidraExtensions.java",
  prepareCom: "BaaGhidraPrepareCom.java",
  prepareRaw: "BaaGhidraPrepareRaw.java",
  prepareDol: "BaaGhidraPrepareDol.java",
  applySeeds: "BaaGhidraApplySeeds.java",
  analysisOptions: "BaaGhidraAnalysisOptions.java",
  noReturnFix: "BaaGhidraNoReturnFix.java",
  mipsSoftFloat: "BaaGhidraMipsSoftFloat.java",
  riscvCallingConvention: "BaaGhidraRiscvCallingConvention.java",
} as const);
