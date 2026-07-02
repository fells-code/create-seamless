import { multiselect, password, text } from "@clack/prompts";

import {
  OAUTH_PROVIDER_CATALOG,
  type CollectedOAuthProvider,
} from "../core/oauthProviders.js";

// Runs when the selected web template opts into OAuth setup. Lets the user pick
// providers and paste each one's client id and secret, so the scaffolded auth
// server has OAuth working right after `docker compose up`. Blank credentials are
// allowed (the provider is scaffolded disabled for the user to fill in later).
export async function runOAuthSetupPrompts(): Promise<CollectedOAuthProvider[]> {
  const chosen = (await multiselect({
    message: "Which OAuth providers do you want to enable? (space to select)",
    options: OAUTH_PROVIDER_CATALOG.map((p) => ({ value: p.id, label: p.label })),
    required: false,
  })) as string[];

  if (!Array.isArray(chosen) || chosen.length === 0) {
    return [];
  }

  const collected: CollectedOAuthProvider[] = [];

  for (const id of chosen) {
    const catalog = OAUTH_PROVIDER_CATALOG.find((p) => p.id === id);
    if (!catalog) continue;

    const clientId = (await text({
      message: `${catalog.label} client ID`,
      placeholder: "leave blank to configure later",
    })) as string;

    const clientSecret = (await password({
      message: `${catalog.label} client secret`,
    })) as string;

    collected.push({
      catalog,
      clientId: (clientId ?? "").trim(),
      clientSecret: (clientSecret ?? "").trim(),
    });
  }

  return collected;
}
