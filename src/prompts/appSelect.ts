import { select } from "@clack/prompts";

import { orCancel } from "../core/cancel.js";
import { requireInteractive } from "../core/tty.js";
import { resolveAppInstanceUrl, type PortalApp } from "../core/portal.js";

export class NoApplicationsError extends Error {
  constructor() {
    super(
      "No managed applications are available for this account. Create one at https://dashboard.seamlessauth.com, then run init again.",
    );
    this.name = "NoApplicationsError";
  }
}

// Resolves which managed application the scaffold connects to. `--app` matches an
// id or infra id; a single application is auto-selected; otherwise the developer
// picks. Cancelling throws CancelledError, so init can unwind what it created.
// Generic over the app type so a caller that has already narrowed to applications
// with a resolvable instance URL keeps that guarantee on the selected one.
export async function selectApplication<T extends PortalApp>(
  apps: T[],
  preselectId?: string,
): Promise<T> {
  if (apps.length === 0) {
    throw new NoApplicationsError();
  }

  if (preselectId) {
    const found = apps.find(
      (a) => a.id === preselectId || a.infraId === preselectId,
    );
    if (!found) {
      const available = apps.map((a) => a.id).join(", ");
      throw new Error(
        `No managed application matches --app "${preselectId}". Available: ${available}.`,
      );
    }
    return found;
  }

  if (apps.length === 1) {
    console.log(
      `Managed application: ${apps[0].name} (${resolveAppInstanceUrl(apps[0])})`,
    );
    return apps[0];
  }

  requireInteractive(
    "Which managed application should this project connect to?",
    "Pass --app <id> to name one (see `seamless apps list`).",
  );

  const choice = orCancel(
    await select({
      message: "Which managed application should this project connect to?",
      options: apps.map((a) => ({
        value: a.id,
        label: a.name,
        hint: resolveAppInstanceUrl(a),
      })),
    }),
  );

  const chosen = apps.find((a) => a.id === choice);
  if (!chosen) {
    throw new Error(`Selected application "${String(choice)}" is no longer available.`);
  }
  return chosen;
}
