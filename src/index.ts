#!/usr/bin/env node

import { runCLI } from "./commands/init.js";
import { extractFlag } from "./core/args.js";
import { runCheck } from "./commands/check.js";
import { printHelp } from "./commands/help.js";
import pkg from "../package.json" with { type: "json" };
import { runBootstrapAdmin } from "./commands/bootstrapAdmin.js";
import { runVerify } from "./commands/verify.js";
import { runProfile } from "./commands/profile.js";
import { runLogin } from "./commands/login.js";
import { runWhoami } from "./commands/whoami.js";
import { runLogout } from "./commands/logout.js";
import { runSessions } from "./commands/sessions.js";
import { runConfig } from "./commands/config.js";
import { runUsers } from "./commands/users.js";
import { runOrg } from "./commands/org.js";
import { runApps } from "./commands/apps.js";
import { isCancelled } from "./core/cancel.js";
import kleur from "kleur";

export const VERSION = pkg.version;

const COMMANDS = [
  "init",
  "check",
  "bootstrap-admin",
  "verify",
  "profile",
  "login",
  "apps",
  "whoami",
  "logout",
  "sessions",
  "config",
  "users",
  "org",
];

const args = process.argv.slice(2);

const command = args[0];

async function main() {
  if (!command) {
    printHelp();
    return;
  }

  if (command === "-h" || command === "--help") {
    printHelp();
    return;
  }

  if (command === "-v" || command === "--version") {
    console.log(VERSION);
    return;
  }

  if (command === "init") {
    const profileFlag = extractFlag(args.slice(1), "profile");
    const appFlag = extractFlag(profileFlag.rest, "app");
    const rest = appFlag.rest;

    const local = rest.includes("--local");
    const aliases = rest
      .filter((a) => a.startsWith("--") && a !== "--local")
      .map((a) => a.replace(/^--+/, ""));
    const projectName = rest.find((a) => !a.startsWith("--"));

    await runCLI(projectName, aliases, {
      profileFlag: profileFlag.value,
      appId: appFlag.value,
      local,
    });
    return;
  }

  if (command === "check") {
    await runCheck();
    return;
  }

  if (command === "bootstrap-admin") {
    await runBootstrapAdmin(args.slice(1));
    return;
  }

  if (command === "verify") {
    await runVerify(args.slice(1));
    return;
  }

  if (command === "profile") {
    await runProfile(args.slice(1));
    return;
  }

  if (command === "login") {
    await runLogin(args.slice(1));
    return;
  }

  if (command === "whoami") {
    await runWhoami(args.slice(1));
    return;
  }

  if (command === "logout") {
    await runLogout(args.slice(1));
    return;
  }

  if (command === "sessions") {
    await runSessions(args.slice(1));
    return;
  }

  if (command === "config") {
    await runConfig(args.slice(1));
    return;
  }

  if (command === "users") {
    await runUsers(args.slice(1));
    return;
  }

  if (command === "org") {
    await runOrg(args.slice(1));
    return;
  }

  if (command === "apps") {
    await runApps(args.slice(1));
    return;
  }

  // An unrecognized command used to be treated as a project name and scaffolded,
  // which made every typo create a directory with no indication the command was
  // not understood. Scaffolding is `init` and nothing else.
  console.error(kleur.red(`Unknown command "${command}".`));
  if (!command.startsWith("-")) {
    console.error(
      kleur.dim("To scaffold a project, run: ") +
        kleur.cyan(`seamless init ${command}`),
    );
  }
  console.error(kleur.dim(`Commands: ${COMMANDS.join(", ")}`));
  console.error(kleur.dim("Run seamless --help for details."));
  process.exit(1);
}

main().catch((err) => {
  if (isCancelled(err)) {
    console.log(err.message);
    // 130 is the conventional exit status for a command ended by Ctrl-C.
    process.exit(130);
  }
  console.error("Error:", err.message);
  process.exit(1);
});
