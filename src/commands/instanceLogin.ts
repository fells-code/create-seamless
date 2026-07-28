import { intro, outro, cancel } from "@clack/prompts";
import kleur from "kleur";

import {
  getActiveProfile,
  isLocalInstanceUrl,
  upsertProfile,
} from "../core/config.js";
import { KeychainUnavailableError, saveTokens } from "../core/keychain.js";
import { promptLogin } from "../core/interactiveLogin.js";
import { LoginError } from "../core/loginFlow.js";

export interface InstanceLoginOptions {
  profileName?: string;
  identifier?: string;
  local?: boolean;
}

// Signs in to an auth instance a developer administers, which is what authorizes
// the /admin routes behind `users`, `config`, `org`, and `sessions`. Distinct
// from the portal session: that account lives on the control plane, this one
// lives in the instance's own user pool.
export async function loginToInstance(
  opts: InstanceLoginOptions = {},
): Promise<void> {
  const profile = getActiveProfile({ profileFlag: opts.profileName });
  if (!profile) {
    console.error(kleur.red("No active profile is configured."));
    console.log(
      "Add one with: " +
        kleur.cyan("seamless profile add <name> --instance-url <url>"),
    );
    process.exit(1);
  }

  if (opts.local && !isLocalInstanceUrl(profile.instanceUrl)) {
    console.error(
      kleur.red(
        `--local only works against a local instance, not ${profile.instanceUrl}.`,
      ),
    );
    process.exit(1);
  }

  intro(`Log in to ${kleur.bold(profile.name)} (${profile.instanceUrl})`);
  if (opts.local) {
    console.log(
      kleur.dim("Local delivery on: reading the OTP from the instance response."),
    );
  }

  try {
    const result = await promptLogin({
      instanceUrl: profile.instanceUrl,
      identifier: opts.identifier,
      knownEmail: profile.email,
      localDelivery: opts.local,
    });

    if (!result) {
      cancel("Cancelled.");
      return;
    }

    await saveTokens(profile, result.tokens);
    upsertProfile({
      ...profile,
      sub: result.identity.sub ?? profile.sub,
      email: result.identity.email ?? profile.email,
      identifierType: result.identity.identifierType,
    });

    outro(
      kleur.green(
        `Logged in to ${profile.name} as ${result.identity.email ?? result.identifier}.`,
      ),
    );
  } catch (err) {
    if (err instanceof LoginError || err instanceof KeychainUnavailableError) {
      outro(kleur.red(err.message));
      process.exit(1);
    }
    throw err;
  }
}
