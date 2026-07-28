import kleur from "kleur";
import { extractFlag } from "../core/args.js";
import {
  createAuthClient,
  createPortalClient,
  ReauthRequiredError,
} from "../core/authClient.js";
import {
  clearPortalSession,
  getActiveProfile,
  getPortalSession,
  type Profile,
} from "../core/config.js";
import { clearLocalSession, revokeSession } from "../core/session.js";

export async function runLogout(args: string[]): Promise<void> {
  const all = args.includes("--all");
  const { value: profileFlag } = extractFlag(
    args.filter((a) => a !== "--all"),
    "profile",
  );

  // Mirrors whoami: the portal is the default target, an instance profile is the
  // fallback for developers who never sign in to the control plane.
  const portal = !profileFlag ? getPortalSession() : undefined;
  const target = portal ?? getActiveProfile({ profileFlag });

  if (!target) {
    console.log(kleur.yellow("No session to log out of."));
    return;
  }

  let client;
  try {
    client = portal
      ? await createPortalClient()
      : await createAuthClient({ profileFlag });
  } catch (err) {
    if (err instanceof ReauthRequiredError) {
      await forget(target, portal !== undefined);
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

  await forget(target, portal !== undefined);

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

async function forget(target: Profile, portal: boolean): Promise<void> {
  await clearLocalSession(target);
  if (portal) clearPortalSession();
}
