export const LARGE_FIXTURE_COUNT: number;
export const HOPPER_C_ORACLE: Readonly<{
  mainProcedure: "main";
  entryProcedure: "baa_entry";
  branchProcedure: "baa_branch";
  leafProcedure: "baa_leaf";
  entryString: "BAA_C_ENTRY";
  leafString: "BAA_C_LEAF";
  globalName: "baa_c_global";
}>;
export function sha256(value: string | Uint8Array): string;
export function generateLargeFixture(): string;
export function sourceDigest(
  sources: readonly { readonly path: string; readonly content: string }[],
): string;

export function resolveConformanceFixturePath(
  root: string,
  declaredPath: unknown,
): Promise<string>;
export function bindConformanceFixtureArtifact(
  path: string,
  fixture: unknown,
): Promise<{ readonly path: string; readonly sha256: string }>;
