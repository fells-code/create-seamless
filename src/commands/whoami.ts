import kleur from "kleur";
import { extractFlag } from "../core/args.js";
import {
  createAuthClient,
  createPortalClient,
  ReauthRequiredError,
} from "../core/authClient.js";
import { fetchIdentity, type Identity } from "../core/session.js";
import { getPortalSession, type Profile } from "../core/config.js";
import { errorMessage } from "../core/errors.js";

export async function runWhoami(args: string[]): Promise<void> {
  const { value: profileFlag } = extractFlag(args, "profile");

  try {
    // Without --profile this reports the portal account. An instance profile is
    // still a useful answer when there is no portal session (a local-only or
    // self-hosted developer never signs in to the control plane), so fall back
    // to it rather than reporting nothing.
    const portal = !profileFlag && getPortalSession() !== undefined;
    const client =
      profileFlag || !portal
        ? await createAuthClient({ profileFlag })
        : await createPortalClient();

    const identity = await fetchIdentity(client);
    printIdentity(portal ? "Seamless portal" : client.profile.name, client.profile, identity);
  } catch (err) {
    if (err instanceof ReauthRequiredError) {
      console.log(kleur.yellow(err.message));
      process.exit(1);
    }
    console.error(kleur.red(errorMessage(err)));
    process.exit(1);
  }
}

function printIdentity(
  target: string,
  profile: Profile,
  identity: Identity,
): void {
  const line = (label: string, value: string) =>
    console.log(kleur.dim(`${label}:`.padEnd(11)) + value);

  line("Account", target);
  line("Instance", profile.instanceUrl);
  line("Sub", identity.sub ?? profile.sub ?? "(unknown)");
  line("Email", identity.email ?? profile.email ?? "(unknown)");
  line("Roles", identity.roles.length ? identity.roles.join(", ") : "(none)");
}
