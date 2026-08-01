import { confirm, isCancel } from "@clack/prompts";

import { requireInteractive } from "./tty.js";

// `--force` is the standing spelling for "take the destructive step without
// asking", matching what `seamless init` means by it: `--yes` answers ordinary
// questions, `--force` answers the ones that destroy something. `--yes` and `-y`
// stay accepted here because `config oauth-providers remove --yes` shipped with
// them, and because it is the flag most people reach for first.
export function hasForceFlag(args: string[]): boolean {
  return (
    args.includes("--force") || args.includes("--yes") || args.includes("-y")
  );
}

export const FORCE_FLAGS = ["--force", "--yes", "-y"];

export interface ConfirmDestructiveOptions {
  message: string;
  force: boolean;
  // What to tell someone running without a terminal. Defaults to naming --force,
  // which is the answer for every destructive confirmation.
  remedy?: string;
}

// Asks a destructive question unless --force already answered it. Without a
// terminal it fails naming the flag rather than rendering a prompt nobody can
// answer, which used to hang the command until its job timed out.
//
// Cancelling reads as declining rather than throwing, because every caller here
// treats a Ctrl-C at the confirmation as "do not do it" and reports it the same
// way as a No.
export async function confirmDestructive({
  message,
  force,
  remedy,
}: ConfirmDestructiveOptions): Promise<boolean> {
  if (force) return true;

  requireInteractive(
    message,
    remedy ?? "Pass --force to take this action without confirming.",
  );

  const answer = await confirm({ message, initialValue: false });
  return !isCancel(answer) && answer === true;
}
