import fs from "fs";
import path from "path";
import { intro, outro, text, confirm, spinner } from "@clack/prompts";
import kleur from "kleur";
import { resolveBootstrapSecret } from "../core/bootstrapSecret.js";

type SeamlessConfig = {
  services: {
    auth: {
      mode: "local" | "docker";
    };
  };
};

function loadConfig(): SeamlessConfig {
  const configPath = path.join(process.cwd(), "seamless.config.json");

  if (!fs.existsSync(configPath)) {
    throw new Error("No seamless.config.json found. Run init first.");
  }

  return JSON.parse(fs.readFileSync(configPath, "utf-8"));
}

export async function runBootstrapAdmin(emailArg?: string) {
  intro("Seamless Auth Bootstrap");

  const config = loadConfig();

  let email = emailArg;

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

  let apiUrl = process.env.SEAMLESS_API_URL;

  if (!apiUrl) {
    apiUrl = "http://localhost:3000";
  }

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
