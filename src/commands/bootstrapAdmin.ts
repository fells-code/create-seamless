import { intro, outro, text, confirm, spinner } from "@clack/prompts";
import kleur from "kleur";
import { extractFlag } from "../core/args.js";
import { getActiveProfile } from "../core/config.js";
import { resolveBootstrapSecret } from "../core/bootstrapSecret.js";

const DEFAULT_API_URL = "http://localhost:3000";

// Bootstrap authenticates with the shared bootstrap secret (not a user
// session), so the profile is only used to target the right instance. The
// SEAMLESS_API_URL env override wins for backward compatibility; otherwise fall
// back to the local dev default when no profile is configured.
function resolveApiUrl(profileFlag?: string): string {
  const override = process.env.SEAMLESS_API_URL?.trim();
  if (override) return override;

  const profile = getActiveProfile({ profileFlag });
  if (profile) return profile.instanceUrl;

  return DEFAULT_API_URL;
}

export async function runBootstrapAdmin(args: string[] = []) {
  intro("Seamless Auth Bootstrap");

  const { value: profileFlag, rest } = extractFlag(args, "profile");
  let email = rest.find((a) => !a.startsWith("-"));

  if (!email) {
    email = (await text({
      message: "Admin email address",
      placeholder: "admin@example.com",
      validate: (value) => {
        if (!value || !value.includes("@")) {
          return "Enter a valid email address";
        }
      },
    })) as string;
  }

  const proceed = await confirm({
    message: "Create bootstrap admin invite?",
    initialValue: true,
  });

  if (!proceed) {
    outro("Cancelled.");
    return;
  }

  const apiUrl = resolveApiUrl(profileFlag);

  let secret = resolveBootstrapSecret();

  if (secret) {
    console.log(kleur.gray("Using bootstrap secret from local environment"));
  } else {
    console.log("");
    console.log(kleur.yellow("No bootstrap secret detected automatically."));
    console.log(
      "This may happen if the project is not initialized locally or running in production.",
    );

    secret = (await text({
      message: "Bootstrap secret",
      placeholder: "Enter your bootstrap secret",
      validate: (value) => {
        if (!value) return "Bootstrap secret is required";
      },
    })) as string;
  }

  const s = spinner();
  s.start("Creating bootstrap invite...");

  try {
    const res = await fetch(`${apiUrl}/auth/internal/bootstrap/admin-invite`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({ email }),
    });

    const data = await res.json();

    if (!res.ok) {
      s.stop("Failed");

      console.error(kleur.red("Error creating bootstrap invite"));
      console.error(data);

      process.exit(1);
    }

    s.stop("Done");

    console.log("");

    if (data?.data?.url) {
      console.log(kleur.bold("Registration URL"));
      console.log(kleur.cyan(data.data.url));
    } else {
      console.log(kleur.green(`Invite sent to ${email}`));
    }

    console.log("");
    console.log("Next step:");
    console.log(
      "The invited user must complete registration to receive admin access.",
    );

    outro("Bootstrap complete.");
  } catch (err: any) {
    s.stop("Failed");

    console.error(kleur.red("Unexpected error"));
    console.error(err.message);

    process.exit(1);
  }
}
