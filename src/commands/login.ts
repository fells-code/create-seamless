import { intro, outro, text, isCancel, cancel } from "@clack/prompts";
import kleur from "kleur";
import { extractFlag } from "../core/args.js";
import { getActiveProfile, upsertProfile, type Profile } from "../core/config.js";
import { KeychainUnavailableError, saveTokens } from "../core/keychain.js";
import { completeLogin, LoginError, type LoginResult } from "../core/loginFlow.js";

export async function runLogin(args: string[]): Promise<void> {
  const profileFlag = extractFlag(args, "profile");
  const idFlag = extractFlag(profileFlag.rest, "identifier");

  const profile = getActiveProfile({ profileFlag: profileFlag.value });
  if (!profile) {
    console.error(kleur.red("No active profile is configured."));
    console.log(
      "Add one with: " +
        kleur.cyan("seamless profile add <name> --instance-url <url>"),
    );
    process.exit(1);
  }

  intro(`Log in to ${kleur.bold(profile.name)} (${profile.instanceUrl})`);

  let identifier = (idFlag.value ?? idFlag.rest[0])?.trim();
  if (!identifier) {
    const answer = await text({
      message: "Email or phone",
      placeholder: profile.email ?? "you@example.com",
      initialValue: profile.email ?? "",
      validate: (value) =>
        value && value.trim() ? undefined : "An identifier is required",
    });
    if (isCancel(answer)) {
      cancel("Cancelled.");
      return;
    }
    identifier = (answer as string).trim();
  }

  try {
    const result = await completeLogin({
      instanceUrl: profile.instanceUrl,
      identifier,
      getCode: async ({ resent }) => {
        const answer = await text({
          message: resent ? "Enter the new code" : "Enter the code we sent you",
          placeholder: "123456",
          validate: (value) =>
            /^\d{4,8}$/.test((value ?? "").trim())
              ? undefined
              : "Enter the numeric code from the message",
        });
        if (isCancel(answer)) return null;
        return (answer as string).trim();
      },
      notify: (event) => {
        switch (event.type) {
          case "code_sent":
            console.log(kleur.dim(`A code was sent to ${identifier}.`));
            break;
          case "code_resent":
            console.log(
              kleur.dim("Your previous code expired, so we sent a new one."),
            );
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

    if (!result) {
      cancel("Cancelled.");
      return;
    }

    await persistSession(profile, result);
    outro(kleur.green(`Logged in as ${result.identity.email ?? identifier}.`));
  } catch (err) {
    if (err instanceof LoginError || err instanceof KeychainUnavailableError) {
      outro(kleur.red(err.message));
      process.exit(1);
    }
    throw err;
  }
}

async function persistSession(
  profile: Profile,
  result: LoginResult,
): Promise<void> {
  await saveTokens(profile, result.tokens);
  upsertProfile({
    ...profile,
    sub: result.identity.sub ?? profile.sub,
    email: result.identity.email ?? profile.email,
    identifierType: result.identity.identifierType,
  });
}
