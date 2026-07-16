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

export const VERSION = pkg.version;
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
    const email = args[1];
    await runBootstrapAdmin(email);
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

  await runCLI(command);
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
