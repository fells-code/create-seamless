import { confirm, select } from "@clack/prompts";

import type { RegistryEntry, TemplateKind } from "../core/templates.js";

type AuthMode = "local" | "docker";
type AdminMode = "api" | "image" | "source" | "none";

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

interface Preselect {
  webTemplateId?: string;
  apiTemplateId?: string;
}

function labelFor(templates: RegistryEntry[], id: string): string {
  return templates.find((t) => t.id === id)?.label ?? id;
}

// Managed connect only needs the web and api templates: the auth server is the
// developer's managed instance, so the auth-mode, Docker, and admin-dashboard
// questions (all local-stack concerns) do not apply.
export async function runManagedTemplatePrompts(
  templates: RegistryEntry[],
  preselect: Preselect = {},
) {
  let webTemplateId = preselect.webTemplateId;
  if (webTemplateId) {
    console.log(`Web example: ${labelFor(templates, webTemplateId)}`);
  } else {
    webTemplateId = (await select({
      message: "Web example",
      options: toOptions(templates, "web"),
    })) as string;
  }

  let apiTemplateId = preselect.apiTemplateId;
  if (apiTemplateId) {
    console.log(`Backend: ${labelFor(templates, apiTemplateId)}`);
  } else {
    apiTemplateId = (await select({
      message: "Backend framework",
      options: toOptions(templates, "api"),
    })) as string;
  }

  return { webTemplateId, apiTemplateId };
}

export async function runProjectSetupPrompts(
  templates: RegistryEntry[],
  preselect: Preselect = {},
) {
  let webTemplateId = preselect.webTemplateId;
  if (webTemplateId) {
    console.log(`Web example: ${labelFor(templates, webTemplateId)}`);
  } else {
    webTemplateId = (await select({
      message: "Web example",
      options: toOptions(templates, "web"),
    })) as string;
  }

  let apiTemplateId = preselect.apiTemplateId;
  if (apiTemplateId) {
    console.log(`Backend: ${labelFor(templates, apiTemplateId)}`);
  } else {
    apiTemplateId = (await select({
      message: "Backend framework",
      options: toOptions(templates, "api"),
    })) as string;
  }

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

  const adminMode = (await select({
    message: "How would you like to host the admin console?",
    options: [
      {
        value: "api",
        label: "Served by your API at /console (recommended)",
      },
      {
        value: "image",
        label: "Separate container — official Docker image",
      },
      {
        value: "source",
        label: "Separate container — clone repo for modification",
      },
      {
        value: "none",
        label: "Don't include the admin console",
      },
    ],
    initialValue: "api",
  })) as AdminMode;

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

    adminMode,
  };
}
