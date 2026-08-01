import kleur from "kleur";

import {
  openTemplateSource,
  templateFlags,
  type RegistryEntry,
} from "../core/templates.js";

export async function runTemplates(args: string[]): Promise<void> {
  const sub = args[0];
  const rest = args.slice(1);

  switch (sub) {
    case undefined:
    case "list":
      await templatesList(rest);
      return;
    default:
      console.error(kleur.red(`Unknown templates subcommand: ${sub}`));
      console.log("Usage: seamless templates list [--json]");
      process.exit(1);
  }
}

async function templatesList(rest: string[]): Promise<void> {
  const json = rest.includes("--json");
  const { registry } = await openTemplateSource();
  const templates = registry.templates;

  if (json) {
    console.log(JSON.stringify(templates, null, 2));
    return;
  }

  if (templates.length === 0) {
    console.log(kleur.dim("The template registry is empty."));
    return;
  }

  const rows = templates.map((template) => [
    template.id,
    template.kind,
    template.framework,
    flagsFor(template),
    template.status,
  ]);

  printTable(["ID", "KIND", "FRAMEWORK", "FLAGS", "STATUS"], rows);
  console.log(
    kleur.dim(
      "\nPass a flag to seamless init to skip that layer's prompt, e.g. seamless init --oauth",
    ),
  );
}

// Both spellings a template answers to on the command line. The alias is the
// short form and the id always works, so listing both is what makes the pairing
// discoverable without opening registry.json. A coming-soon template cannot be
// selected at all, so offering it a flag would only produce an error later.
function flagsFor(template: RegistryEntry): string {
  if (template.status === "coming-soon") return "-";
  return templateFlags(template).join(", ");
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
