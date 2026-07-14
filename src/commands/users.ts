import { confirm, isCancel } from "@clack/prompts";
import kleur from "kleur";
import { extractFlag } from "../core/args.js";
import { createAuthClient, type AuthClient } from "../core/authClient.js";
import {
  deleteUser,
  getUserDetail,
  listUsers,
  prepareDeviceReplacement,
  type Json,
} from "../core/admin.js";
import { reportAdminError } from "./adminShared.js";

export async function runUsers(args: string[]): Promise<void> {
  const sub = args[0];
  const { value: profileFlag, rest } = extractFlag(args.slice(1), "profile");

  try {
    const client = await createAuthClient({ profileFlag });
    switch (sub) {
      case "list":
        await usersList(client, rest);
        return;
      case "delete":
        await usersDelete(client, rest);
        return;
      case "credentials":
        await usersCredentials(client, rest);
        return;
      case "prepare-device-replacement":
        await usersPrepareDeviceReplacement(client, rest);
        return;
      default:
        console.error(kleur.red(`Unknown users subcommand: ${sub ?? "(none)"}`));
        console.log(
          "Usage: seamless users <list|delete|credentials|prepare-device-replacement>",
        );
        process.exit(1);
    }
  } catch (err) {
    reportAdminError(err);
  }
}

async function usersList(client: AuthClient, rest: string[]): Promise<void> {
  const json = rest.includes("--json");
  const limitFlag = extractFlag(rest, "limit");
  const offsetFlag = extractFlag(limitFlag.rest, "offset");
  const limit = Number(limitFlag.value ?? "50");
  const offset = Number(offsetFlag.value ?? "0");

  const { users, total } = await listUsers(client);

  if (json) {
    console.log(JSON.stringify(users, null, 2));
    return;
  }

  const page = users.slice(offset, offset + limit);
  if (page.length === 0) {
    console.log(kleur.dim("No users."));
    return;
  }

  for (const user of page) {
    printUserRow(user);
  }
  console.log(
    kleur.dim(
      `Showing ${offset + 1}-${offset + page.length} of ${total} user${
        total === 1 ? "" : "s"
      }.`,
    ),
  );
}

async function usersDelete(client: AuthClient, rest: string[]): Promise<void> {
  const id = rest.find((arg) => !arg.startsWith("--"));
  if (!id) {
    console.error(kleur.red("Usage: seamless users delete <id>"));
    process.exit(1);
  }

  const proceed = await confirm({
    message: `Permanently delete user ${id}? This cannot be undone.`,
    initialValue: false,
  });
  if (isCancel(proceed) || !proceed) {
    console.log("Cancelled.");
    return;
  }

  await deleteUser(client, id);
  console.log(kleur.green(`Deleted user ${id}.`));
}

async function usersCredentials(
  client: AuthClient,
  rest: string[],
): Promise<void> {
  const json = rest.includes("--json");
  const id = rest.find((arg) => !arg.startsWith("--"));
  if (!id) {
    console.error(kleur.red("Usage: seamless users credentials <id>"));
    process.exit(1);
  }

  const { credentials } = await getUserDetail(client, id);

  if (json) {
    console.log(JSON.stringify(credentials, null, 2));
    return;
  }

  console.log(
    `${kleur.bold(String(credentials.length))} credential${
      credentials.length === 1 ? "" : "s"
    } for user ${id}`,
  );
  for (const credential of credentials) {
    const name =
      str(credential, "deviceName") ??
      str(credential, "name") ??
      str(credential, "type") ??
      "credential";
    const id = str(credential, "id") ?? str(credential, "credentialId") ?? "";
    const created = str(credential, "createdAt");
    console.log(
      "  " +
        kleur.bold(name) +
        (id ? kleur.dim(`  ${id}`) : "") +
        (created ? kleur.dim(`  added ${created}`) : ""),
    );
  }
}

async function usersPrepareDeviceReplacement(
  client: AuthClient,
  rest: string[],
): Promise<void> {
  const id = rest.find((arg) => !arg.startsWith("--"));
  if (!id) {
    console.error(
      kleur.red("Usage: seamless users prepare-device-replacement <id>"),
    );
    process.exit(1);
  }

  const opts = {
    revokeSessions: !rest.includes("--keep-sessions"),
    removePasskeys: !rest.includes("--keep-passkeys"),
    disableTotp: !rest.includes("--keep-totp"),
  };

  const actions = [
    opts.revokeSessions ? "revoke all sessions" : null,
    opts.removePasskeys ? "remove passkeys" : null,
    opts.disableTotp ? "disable TOTP" : null,
  ].filter(Boolean);

  const proceed = await confirm({
    message: `Prepare device replacement for ${id}? This will ${actions.join(", ")}.`,
    initialValue: false,
  });
  if (isCancel(proceed) || !proceed) {
    console.log("Cancelled.");
    return;
  }

  const result = await prepareDeviceReplacement(client, id, opts);
  console.log(kleur.green(`Prepared device replacement for ${id}.`));
  console.log(
    kleur.dim(
      `Revoked sessions: ${num(result, "revokedSessions")}, removed credentials: ${num(
        result,
        "removedCredentials",
      )}, disabled TOTP: ${num(result, "disabledTotpCredentials")}`,
    ),
  );
}

function printUserRow(user: Json): void {
  const id = str(user, "id") ?? "(no id)";
  const email = str(user, "email") ?? "(no email)";
  const roles = Array.isArray(user.roles)
    ? (user.roles as unknown[]).filter((r): r is string => typeof r === "string")
    : [];
  const revoked = user.revoked === true ? kleur.red("  revoked") : "";
  console.log(
    kleur.bold(email) +
      kleur.dim(`  ${id}`) +
      (roles.length ? kleur.dim(`  [${roles.join(", ")}]`) : "") +
      revoked,
  );
}

function str(record: Json, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" && value ? value : undefined;
}

function num(record: Json, key: string): number {
  const value = record[key];
  return typeof value === "number" ? value : 0;
}
