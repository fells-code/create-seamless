import kleur from "kleur";
import { ReauthRequiredError } from "../core/authClient.js";
import { AdminApiError, PermissionError } from "../core/admin.js";

export function reportAdminError(err: unknown): never {
  if (err instanceof ReauthRequiredError) {
    console.log(kleur.yellow(err.message));
    process.exit(1);
  }
  if (err instanceof PermissionError || err instanceof AdminApiError) {
    console.error(kleur.red(err.message));
    process.exit(1);
  }
  throw err;
}

export function parseList(value?: string): string[] | undefined {
  if (value === undefined) return undefined;
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}
