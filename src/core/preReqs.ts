import { commandExists } from "./exec.js";

export async function ensureRequiredCommands(): Promise<void> {
  const required = ["aws", "docker", "terraform"];
  const missing: string[] = [];

  for (const command of required) {
    const exists = await commandExists(command);
    if (!exists) missing.push(command);
  }

  if (missing.length > 0) {
    throw new Error(`Missing required commands: ${missing.join(", ")}`);
  }
}
