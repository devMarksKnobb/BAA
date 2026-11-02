import { execFile } from "node:child_process";
import { chmod, mkdir, readFile, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

import { createTestTempDirectory } from "../../fixtures/temporaryDirectory.js";

const execFileAsync = promisify(execFile);
const installer = join(process.cwd(), "install.sh");

interface Fixture {
  readonly home: string;
  readonly bin: string;
  readonly npmLog: string;
  readonly source: string;
}

const executable = async (path: string, content: string): Promise<void> => {
  await writeFile(path, content);
  await chmod(path, 0o755);
};

const createFixture = async (): Promise<Fixture> => {
  const root = await createTestTempDirectory("baa-install-test-");
  const home = join(root, "home");
  const bin = join(root, "bin");
  const npmLog = join(root, "npm.log");
  const source = join(root, "baa-source");
  await Promise.all([mkdir(home), mkdir(bin)]);
  await Promise.all([
    executable(
      join(bin, "uname"),
      '#!/bin/sh\n[ "$1" = "-m" ] && echo x86_64 || echo Linux\n',
    ),
    executable(
      join(bin, "node"),
      `#!/bin/sh\nif [ "$1" = "-p" ]; then printf '%s\\n' "\${FAKE_NODE_VERSION:-24.22.1}"; else exec ${JSON.stringify(process.execPath)} "$@"; fi\n`,
    ),
    executable(
      join(bin, "npm"),
      `#!/bin/sh
if [ "$1" = "view" ]; then
  [ "\${FAKE_NPM_VIEW_FAIL:-}" = "1" ] && exit 1
  printf '%s\\n' "\${FAKE_NPM_VIEW_VERSION:-0.3.0}"
  exit 0
fi
printf '%s\\n' "$*" >> "$FAKE_NPM_LOG"
[ "\${FAKE_NPM_FAIL:-}" = "1" ] && exit 1
prefix="$HOME/.local"
while [ "$#" -gt 0 ]; do
  if [ "$1" = "--prefix" ]; then shift; prefix="$1"; fi
  shift
done
mkdir -p "$prefix/bin"
cp "$FAKE_BAA_SOURCE" "$prefix/bin/baa"
chmod +x "$prefix/bin/baa"
`,
    ),
    executable(
      source,
      `#!/bin/sh\n[ "$1" = "--version" ] && printf '%s\\n' "\${FAKE_BAA_VERSION:-0.3.0}"\nexit 0\n`,
    ),
    ...["bash", "chmod", "cp", "mkdir", "tr"].map((command) =>
      symlink(`/usr/bin/${command}`, join(bin, command)),
    ),
  ]);
  return { home, bin, npmLog, source };
};

const runInstaller = async (
  fixture: Fixture,
  arguments_: readonly string[] = [],
  extra: Record<string, string> = {},
): Promise<{ stdout: string; stderr: string }> =>
  execFileAsync("bash", [installer, ...arguments_], {
    encoding: "utf8",
    timeout: 10_000,
    env: {
      ...process.env,
      HOME: fixture.home,
      PATH: `${fixture.bin}:/usr/bin:/bin`,
      FAKE_NODE_VERSION: "24.22.1",
      FAKE_NPM_LOG: fixture.npmLog,
      FAKE_BAA_SOURCE: fixture.source,
      FAKE_BAA_VERSION: "0.3.0",
      ...extra,
    },
  });

describe("BAA installer", () => {
  it("checks Node.js compatibility before resolving or installing a package", async () => {
    const fixture = await createFixture();
    await expect(
      runInstaller(fixture, ["--version", "0.3.0"], {
        FAKE_NODE_VERSION: "22.23.3",
      }),
    ).rejects.toMatchObject({
      stderr: expect.stringContaining("Node.js 22.23.3 is unsupported"),
    });
    await expect(readFile(fixture.npmLog, "utf8")).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("resolves the latest package version from npm for a dry run", async () => {
    const fixture = await createFixture();
    const result = await runInstaller(fixture, ["--dry-run", "--no-setup"], {
      FAKE_NPM_VIEW_VERSION: "1.2.3",
    });
    expect(result.stdout).toContain("Version: 1.2.3");
    expect(result.stdout).toContain("Dry run complete");
    expect(await readFile(fixture.npmLog, "utf8").catch(() => "")).toBe("");
  });

  it("installs a pinned BAA package and verifies the installed CLI version", async () => {
    const fixture = await createFixture();
    const result = await runInstaller(fixture, ["--version", "0.3.0", "--no-setup"]);
    expect(result.stdout).toContain("BAA 0.3.0 is installed");
    expect(await readFile(fixture.npmLog, "utf8")).toContain(
      "install --global --prefix",
    );
    expect(await readFile(fixture.npmLog, "utf8")).toContain(
      "build-anything-agents@0.3.0",
    );
  });

  it("rejects an invalid version returned by npm", async () => {
    const fixture = await createFixture();
    await expect(
      runInstaller(fixture, [], { FAKE_NPM_VIEW_VERSION: "latest" }),
    ).rejects.toMatchObject({
      stderr: expect.stringContaining("npm registry returned an invalid BAA version"),
    });
    await expect(readFile(fixture.npmLog, "utf8")).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("rejects npm build metadata before invoking installation", async () => {
    const fixture = await createFixture();
    await expect(
      runInstaller(fixture, ["--version", "1.2.3+build.01"]),
    ).rejects.toMatchObject({
      stderr: expect.stringContaining("npm cannot install an exact version with build metadata"),
    });
    await expect(readFile(fixture.npmLog, "utf8")).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("does not require curl", async () => {
    const fixture = await createFixture();
    const result = await runInstaller(fixture, ["--version", "0.3.0", "--dry-run"], {
      PATH: fixture.bin,
    });
    expect(result.stdout).toContain("Dry run complete");
  });
});
