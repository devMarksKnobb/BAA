import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { z } from "zod";

import type { EvidenceMcpServer } from "./EvidenceMcpServer.js";
import { BAA_PROJECT_TOOL_NAMES } from "./baaProjectToolCount.js";

const execFile = promisify(execFileCallback);
const helperPath = fileURLToPath(new URL("../../scripts/baa-project.mjs", import.meta.url));

const runHelper = async (arguments_: readonly string[]) => {
  try {
    const result = await execFile(
      process.execPath,
      [helperPath, ...arguments_],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        timeout: 120_000,
        maxBuffer: 16 * 1024 * 1024,
        windowsHide: true,
      },
    );
    return {
      content: [{ type: "text" as const, text: result.stdout.trim() }],
    };
  } catch (cause) {
    const error = cause as Error & {
      readonly stdout?: string;
      readonly stderr?: string;
    };
    const details = [error.message, error.stderr, error.stdout]
      .filter((value): value is string => Boolean(value))
      .join("\n");
    return {
      isError: true,
      content: [{ type: "text" as const, text: details }],
    };
  }
};

/** Register the BAA project-building tool surface used by the public MCP server. */
export const registerBaaProjectTools = (server: EvidenceMcpServer): void => {
  server.registerTool(
    BAA_PROJECT_TOOL_NAMES[0],
    {
      title: "List BAA project targets",
      description:
        "List the application platforms for which BAA can generate starter projects.",
      inputSchema: z.object({}),
    },
    async () => runHelper(["targets"]),
  );

  server.registerTool(
    BAA_PROJECT_TOOL_NAMES[1],
    {
      title: "Analyze a project",
      description:
        "Inventory a local project, hash included files, and extract framework, route, component and design-token candidates. This is bounded static analysis; it does not execute the project or infer runtime-only behavior.",
      inputSchema: z.object({
        source_directory: z.string().min(1),
        output_file: z.string().min(1).optional(),
      }),
    },
    async ({ source_directory, output_file }) =>
      runHelper([
        "analyze",
        source_directory,
        ...(output_file === undefined ? [] : ["--out", output_file]),
      ]),
  );

  server.registerTool(
    BAA_PROJECT_TOOL_NAMES[2],
    {
      title: "Generate a project",
      description:
        "Generate a target-specific starter project from a brief and optional local source analysis. Existing files are never overwritten.",
      inputSchema: z.object({
        target: z.enum([
          "react",
          "next",
          "vue",
          "flutter",
          "react-native",
          "swiftui",
          "compose",
          "electron",
          "tauri",
          "unity",
          "unreal",
          "roblox",
        ]),
        output_directory: z.string().min(1),
        name: z.string().min(1).optional(),
        brief: z.string().max(20_000).optional(),
        source_directory: z.string().min(1).optional(),
      }),
    },
    async ({ target, output_directory, name, brief, source_directory }) =>
      runHelper([
        "generate",
        "--target",
        target,
        "--out",
        output_directory,
        ...(name === undefined ? [] : ["--name", name]),
        ...(brief === undefined ? [] : ["--brief", brief]),
        ...(source_directory === undefined
          ? []
          : ["--source", source_directory]),
      ]),
  );

  server.registerTool(
    BAA_PROJECT_TOOL_NAMES[3],
    {
      title: "Verify a generated project",
      description:
        "Run BAA's structural checks against a generated project manifest and target entry files. This does not compile, launch, audit accessibility or compare screenshots.",
      inputSchema: z.object({
        project_directory: z.string().min(1),
      }),
    },
    async ({ project_directory }) =>
      runHelper(["verify", project_directory]),
  );
};
