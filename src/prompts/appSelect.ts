import { select, isCancel, cancel } from "@clack/prompts";

import type { PortalApp } from "../core/portal.js";

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
// picks. Returns null only when an interactive selection is cancelled.
export async function selectApplication(
  apps: PortalApp[],
  preselectId?: string,
): Promise<PortalApp | null> {
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
    console.log(`Managed application: ${apps[0].name} (${apps[0].domain})`);
    return apps[0];
  }

  const choice = await select({
    message: "Which managed application should this project connect to?",
    options: apps.map((a) => ({
      value: a.id,
      label: a.name,
      hint: a.domain,
    })),
  });

  if (isCancel(choice)) {
    cancel("Cancelled.");
    return null;
  }

  return apps.find((a) => a.id === choice) ?? null;
}
