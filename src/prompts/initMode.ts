import { confirm, select } from "@clack/prompts";

import { CancelledError, orCancel } from "../core/cancel.js";

export type ExistingDirectoryAction = "integrate" | "scaffold";

// A directory with files in it used to force the integrate path, which left a
// logged-out developer with no way to scaffold anywhere except a completely
// empty directory. Templates are copied over whatever is already there, so
// scaffolding into one is offered but never assumed.
export async function chooseExistingDirectoryAction(
  canIntegrate: boolean,
): Promise<ExistingDirectoryAction> {
  if (!canIntegrate) {
    await confirmOverwrite();
    return "scaffold";
  }

  const action = orCancel(
    await select({
      message: "This directory is not empty. What would you like to do?",
      options: [
        {
          value: "integrate",
          label: "Connect it to a managed application",
          hint: "writes api/.env, leaves your source alone",
        },
        {
          value: "scaffold",
          label: "Scaffold a new project here",
          hint: "starter files overwrite anything with the same name",
        },
      ],
    }),
  ) as ExistingDirectoryAction;

  // The hint on the option is not consent. Writing over a directory a developer
  // already has work in gets its own confirmation, on every route that reaches
  // it, so the destructive choice is never one keystroke away.
  if (action === "scaffold") {
    await confirmOverwrite();
  }

  return action;
}

async function confirmOverwrite(): Promise<void> {
  const proceed = orCancel(
    await confirm({
      message:
        "This directory is not empty. Scaffold a project here anyway? Starter files overwrite anything with the same name.",
      initialValue: false,
    }),
  );
  if (!proceed) {
    throw new CancelledError("Nothing was written.");
  }
}

export type ScaffoldTarget = "managed" | "local";

// Being logged in signals intent, so managed leads, but it is a question rather
// than a default: a portal session is a poor reason to assume this particular
// project is not a local experiment.
export async function chooseScaffoldTarget(
  appCount: number,
): Promise<ScaffoldTarget> {
  return orCancel(
    await select({
      message: "How should this project get its auth?",
      options: [
        {
          value: "managed",
          label: "Connect to a managed application",
          hint: `${appCount} available`,
        },
        {
          value: "local",
          label: "Scaffold a local stack",
          hint: "Docker Compose, runs entirely on your machine",
        },
      ],
      initialValue: "managed",
    }),
  ) as ScaffoldTarget;
}

// Reaching the control plane is the one failure that used to degrade silently:
// a developer who meant to connect managed got a full local Docker stack with
// only a warning.
export async function confirmLocalFallback(): Promise<void> {
  const proceed = orCancel(
    await confirm({
      message:
        "Could not reach the Seamless control plane. Scaffold a local stack instead?",
      initialValue: true,
    }),
  );
  if (!proceed) {
    throw new CancelledError("Nothing was written.");
  }
}
