import kleur from "kleur";
import { extractFlag } from "../core/args.js";
import { createAuthClient, ReauthRequiredError } from "../core/authClient.js";
import { fetchIdentity, type Identity } from "../core/session.js";
import type { Profile } from "../core/config.js";

export async function runWhoami(args: string[]): Promise<void> {
  const { value: profileFlag } = extractFlag(args, "profile");

  try {
    const client = await createAuthClient({ profileFlag });
    const identity = await fetchIdentity(client);
    printIdentity(client.profile, identity);
  } catch (err) {
    if (err instanceof ReauthRequiredError) {
      console.log(kleur.yellow(err.message));
      process.exit(1);
    }
    console.error(kleur.red((err as Error).message));
    process.exit(1);
  }
}

function printIdentity(profile: Profile, identity: Identity): void {
  const line = (label: string, value: string) =>
    console.log(kleur.dim(`${label}:`.padEnd(11)) + value);

  line("Profile", profile.name);
  line("Instance", profile.instanceUrl);
  line("Sub", identity.sub ?? profile.sub ?? "(unknown)");
  line("Email", identity.email ?? profile.email ?? "(unknown)");
  line("Roles", identity.roles.length ? identity.roles.join(", ") : "(none)");
}
