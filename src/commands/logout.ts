import kleur from "kleur";
import { extractFlag } from "../core/args.js";
import { createAuthClient, ReauthRequiredError } from "../core/authClient.js";
import { getActiveProfile } from "../core/config.js";
import { clearLocalSession, revokeSession } from "../core/session.js";

export async function runLogout(args: string[]): Promise<void> {
  const all = args.includes("--all");
  const { value: profileFlag } = extractFlag(
    args.filter((a) => a !== "--all"),
    "profile",
  );

  const profile = getActiveProfile({ profileFlag });
  if (!profile) {
    console.log(kleur.yellow("No active profile. Nothing to log out of."));
    return;
  }

  let client;
  try {
    client = await createAuthClient({ profileFlag });
  } catch (err) {
    if (err instanceof ReauthRequiredError) {
      await clearLocalSession(profile);
      console.log(kleur.green("You are already logged out."));
      return;
    }
    throw err;
  }

  let revoked = false;
  try {
    revoked = await revokeSession(client, { all });
  } catch (err) {
    if (!(err instanceof ReauthRequiredError)) throw err;
    revoked = true;
  }

  await clearLocalSession(profile);

  if (revoked) {
    console.log(
      kleur.green(all ? "Logged out of all sessions." : "Logged out."),
    );
  } else {
    console.log(
      kleur.yellow(
        "Cleared the local session. The instance reported a problem revoking the session.",
      ),
    );
  }
}
