import { confirm, select } from "@clack/prompts";

import type { RegistryEntry, TemplateKind } from "../core/templates.js";

type AuthMode = "local" | "docker";
type AdminMode = "image" | "source";

interface Option {
  value: string;
  label: string;
  disabled?: boolean;
}

// Builds the framework choices for one layer (web or api) from the registry, so
// adding a template is a registry edit, not a code change here. coming-soon
// templates show as disabled; beta templates are selectable but labelled.
function toOptions(templates: RegistryEntry[], kind: TemplateKind): Option[] {
  const forKind = templates.filter((t) => t.kind === kind);
  if (forKind.length === 0) {
    throw new Error(`The template registry has no ${kind} templates.`);
  }
  return forKind.map((t) => ({
    value: t.id,
    label:
      t.status === "coming-soon"
        ? `${t.label} (coming soon)`
        : t.status === "beta"
          ? `${t.label} (beta)`
          : t.label,
    disabled: t.status === "coming-soon",
  }));
}

export async function runProjectSetupPrompts(templates: RegistryEntry[]) {
  const webTemplateId = (await select({
    message: "Web framework",
    options: toOptions(templates, "web"),
  })) as string;

  const apiTemplateId = (await select({
    message: "Backend framework",
    options: toOptions(templates, "api"),
  })) as string;

  const authMode = (await select({
    message: "How would you like to run SeamlessAuth?",
    options: [
      {
        value: "docker",
        label: "Docker container (recommended)",
      },
      {
        value: "local",
        label: "Local dev server (advanced)",
      },
    ],
  })) as AuthMode;

  const includeAdmin = await confirm({
    message: "Include Admin Dashboard?",
    initialValue: true,
  });

  let adminMode: AdminMode = "image";

  if (includeAdmin) {
    adminMode = (await select({
      message: "Admin dashboard source",
      options: [
        {
          value: "image",
          label: "Use official Docker image (recommended)",
        },
        {
          value: "source",
          label: "Clone repo for modification",
        },
      ],
    })) as AdminMode;
  }

  if (authMode === "local") {
    const confirmDocker = await confirm({
      message:
        "Auth server still requires Docker for full stack. Enable Docker?",
      initialValue: true,
    });

    if (!confirmDocker) {
      console.log(
        "\nDocker is required for full seamless stack. Enabling automatically.\n",
      );
    }
  }

  return {
    web: true,
    webTemplateId,

    api: true,
    apiTemplateId,

    authMode,
    useDocker: true,

    includeAdmin,
    adminMode,
  };
}
