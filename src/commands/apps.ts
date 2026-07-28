import kleur from "kleur";

import { createPortalClient, ReauthRequiredError } from "../core/authClient.js";
import {
  getApplication,
  listApplications,
  PortalError,
  resolveAppInstanceUrl,
  type PortalApp,
} from "../core/portal.js";

export async function runApps(args: string[]): Promise<void> {
  const sub = args[0];
  const rest = args.slice(1);

  try {
    switch (sub) {
      case undefined:
      case "list":
        await appsList(rest);
        return;
      case "get":
        await appsGet(rest);
        return;
      default:
        console.error(kleur.red(`Unknown apps subcommand: ${sub}`));
        console.log("Usage: seamless apps <list|get>");
        process.exit(1);
    }
  } catch (err) {
    reportPortalError(err);
  }
}

function reportPortalError(err: unknown): never {
  if (err instanceof ReauthRequiredError || err instanceof PortalError) {
    console.error(kleur.red((err as Error).message));
    process.exit(1);
  }
  throw err;
}

// Shown where an instance URL belongs for an application the control plane has
// not finished provisioning, so an empty column never reads as a bug.
const NOT_PROVISIONED = "(provisioning)";

async function appsList(rest: string[]): Promise<void> {
  const json = rest.includes("--json");
  const client = await createPortalClient();
  const apps = await listApplications(client);

  if (json) {
    console.log(JSON.stringify(apps, null, 2));
    return;
  }

  if (apps.length === 0) {
    console.log(kleur.dim("No managed applications."));
    console.log(
      kleur.dim("Create one at ") +
        kleur.cyan("https://dashboard.seamlessauth.com"),
    );
    return;
  }

  const rows = apps.map((app) => [
    app.name,
    app.servicePlan ?? "-",
    app.status ?? "-",
    resolveAppInstanceUrl(app) ?? NOT_PROVISIONED,
  ]);

  printTable(["NAME", "PLAN", "STATUS", "INSTANCE"], rows);
  console.log(
    kleur.dim(
      `\n${apps.length} application${apps.length === 1 ? "" : "s"}. Inspect one with: seamless apps get <id>`,
    ),
  );
}

async function appsGet(rest: string[]): Promise<void> {
  const json = rest.includes("--json");
  const id = rest.find((arg) => !arg.startsWith("--"));
  if (!id) {
    console.error(kleur.red("Usage: seamless apps get <id>"));
    process.exit(1);
  }

  const client = await createPortalClient();
  const app = await getApplication(client, id);

  if (json) {
    console.log(JSON.stringify(app, null, 2));
    return;
  }

  printApp(app);
}

function printApp(app: PortalApp): void {
  const line = (label: string, value: string) =>
    console.log(kleur.dim(`${label}:`.padEnd(12)) + value);

  line("Name", kleur.bold(app.name));
  line("Id", app.id);
  if (app.infraId) line("Infra id", app.infraId);
  line("Plan", app.servicePlan ?? "-");
  line("Status", app.status ?? "-");
  if (app.hostedRegion) line("Region", app.hostedRegion);
  if (app.devMode !== undefined) line("Dev mode", app.devMode ? "on" : "off");

  line("Instance", resolveAppInstanceUrl(app) ?? kleur.dim(NOT_PROVISIONED));
  if (app.consoleUrl) line("Console", app.consoleUrl);
  if (app.frontendUrl) line("Frontend", app.frontendUrl);

  if (app.ownerEmails.length) line("Owners", app.ownerEmails.join(", "));
  if (app.trialExpiresAt) line("Trial ends", app.trialExpiresAt);
  if (app.createdAt) line("Created", app.createdAt);

  // Metadata only. A raw service token exists just once, at rotation time.
  if (app.hasServiceToken) {
    const masked = app.serviceToken?.maskedToken ?? "(issued)";
    const issued = app.serviceToken?.createdAt;
    line("Token", masked + (issued ? kleur.dim(`  issued ${issued}`) : ""));
  } else {
    line("Token", kleur.dim("none issued"));
  }
}

function printTable(headers: string[], rows: string[][]): void {
  const widths = headers.map((header, i) =>
    Math.max(header.length, ...rows.map((row) => row[i].length)),
  );

  const render = (cells: string[]) =>
    cells
      .map((cell, i) => (i === cells.length - 1 ? cell : cell.padEnd(widths[i])))
      .join("  ");

  console.log(kleur.dim(render(headers)));
  for (const row of rows) {
    console.log(render(row));
  }
}
