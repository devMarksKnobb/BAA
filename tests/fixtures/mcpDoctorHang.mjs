import { writeFile } from "node:fs/promises";

if (process.env.BAA_MCP_DOCTOR_PID_PATH !== undefined)
  await writeFile(process.env.BAA_MCP_DOCTOR_PID_PATH, String(process.pid));
setInterval(() => undefined, 1_000);
