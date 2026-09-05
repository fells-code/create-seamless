import { text, isCancel } from "@clack/prompts";
import kleur from "kleur";

import { completeLogin, type LoginResult } from "./loginFlow.js";
import { requireInteractive } from "./tty.js";

export interface InteractiveLoginOptions {
  instanceUrl: string;
  /** Skips the identifier prompt when already known (a flag, or a saved email). */
  identifier?: string;
  /** Prefills the identifier prompt, typically the last email used here. */
  knownEmail?: string;
  localDelivery?: boolean;
}

// The resolved identifier travels back with the result so callers can name the
// account in their summary line when the instance response omits an email.
export type InteractiveLoginResult = LoginResult & { identifier: string };

// The shared OTP conversation behind `seamless login` (the portal) and
// `seamless profile login` (an auth instance). Both talk to a Seamless Auth
// instance over the same endpoints, so only the target URL differs.
// Returns null when the developer cancels a prompt.
export async function promptLogin(
  opts: InteractiveLoginOptions,
): Promise<InteractiveLoginResult | null> {
  let identifier = opts.identifier?.trim();

  if (!identifier) {
    requireInteractive(
      "Email or phone",
      "Pass the identifier positionally, or with --identifier <email>.",
    );
    const answer = await text({
      message: "Email or phone",
      placeholder: opts.knownEmail ?? "you@example.com",
      initialValue: opts.knownEmail ?? "",
      validate: (value) =>
        value && value.trim() ? undefined : "An identifier is required",
    });
    if (isCancel(answer)) return null;
    identifier = (answer as string).trim();
  }

  const resolved = identifier;

  const result = await completeLogin({
    instanceUrl: opts.instanceUrl,
    identifier: resolved,
    localDelivery: opts.localDelivery ?? false,
    getCode: async ({ resent, channel }) => {
      const email = channel === "email";
      // No flag can answer this one: the code only exists after the request is
      // sent. Failing here is still better than waiting forever on a pipe.
      requireInteractive(
        "Enter the code we sent you",
        "A one-time code cannot be supplied ahead of time, so this step needs a terminal.",
      );
      const answer = await text({
        message: resent ? "Enter the new code" : "Enter the code we sent you",
        // A hint, not a rule: the code format belongs to the instance, so the
        // prompt only refuses an empty answer and lets the server judge the rest.
        // Encoding today's shape here would reject a valid code from an instance
        // that ever issues a different one, with no way to override it.
        placeholder: email ? "ABCDEF" : "123456",
        validate: (value) =>
          (value ?? "").trim() ? undefined : "A code is required",
      });
      if (isCancel(answer)) return null;
      // Sent as typed apart from surrounding whitespace. The instance normalizes
      // case for email codes itself, so uppercasing here would only corrupt a
      // case-sensitive one.
      return (answer as string).trim();
    },
    notify: (event) => {
      switch (event.type) {
        case "code_sent":
          // The instance answers the same way whether or not the identifier has an
          // account, so claiming a code was sent would be stating something this cannot
          // know.
          console.log(
            kleur.dim(`If an account exists for ${resolved}, a code is on its way.`),
          );
          break;
        case "code_resent":
          console.log(
            kleur.dim("Your previous code expired, so we sent a new one."),
          );
          break;
        case "code_autofilled":
          console.log(kleur.dim("Read the code from the instance response."));
          break;
        case "incorrect":
          console.log(
            kleur.yellow(
              `That code was not accepted. ${event.attemptsLeft} attempt${
                event.attemptsLeft === 1 ? "" : "s"
              } left.`,
            ),
          );
          break;
      }
    },
  });

  return result ? { ...result, identifier: resolved } : null;
}
