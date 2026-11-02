import { z } from "zod";

import { ConfigurationError } from "../domain/configurationErrors.js";
import { err, ok, type Result } from "../domain/result.js";

/** Settings rejected before CLI commands and MCP startup, required in every Doctor scope. */
export const processStartConfigurationSchema = z.object({
  BAA_LOG_LEVEL: z
    .enum(["trace", "debug", "info", "warn", "error", "fatal", "silent"])
    .default("info"),
});

/** Supported structured log levels at the process boundary. */
export type LogLevel = z.infer<
  typeof processStartConfigurationSchema
>["BAA_LOG_LEVEL"];

/** True when `setting` prevents the BAA process from starting. */
export const blocksProcessStart = (setting: string): boolean =>
  Object.hasOwn(processStartConfigurationSchema.shape, setting);

/** Parse the optional BAA_LOG_LEVEL environment variable. */
export const parseLogLevel = (
  value: unknown,
): Result<LogLevel, ConfigurationError> => {
  const parsed =
    processStartConfigurationSchema.shape.BAA_LOG_LEVEL.safeParse(value);
  if (parsed.success) return ok(parsed.data);
  return err(
    new ConfigurationError("Invalid BAA environment configuration", {
      cause: parsed.error,
      settings: parsed.error.issues.map(({ message }) => ({
        setting: "BAA_LOG_LEVEL",
        constraint: message,
      })),
    }),
  );
};
