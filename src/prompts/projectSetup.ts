import { confirm, select } from "@clack/prompts";

type WebFramework = "react";
type ApiFramework = "express";
type AuthMode = "local" | "docker";
type AdminMode = "image" | "source";

export async function runProjectSetupPrompts() {
  const webFramework = (await select({
    message: "Web framework",
    options: [
      { value: "react", label: "React (Vite)" },
      { value: "next", label: "Next.js (coming soon)", disabled: true },
    ],
  })) as WebFramework;

  const apiFramework = (await select({
    message: "Backend framework",
    options: [
      { value: "express", label: "Express" },
      { value: "fastify", label: "Fastify (coming soon)", disabled: true },
      { value: "fastAPI", label: "FastAPI (coming soon)", disabled: true },
      { value: "axum", label: "Rust Axum (coming soon)", disabled: true },
    ],
  })) as ApiFramework;

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

  let useDocker = true;

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
    webFramework,

    api: true,
    apiFramework,

    authMode,
    useDocker: true,

    includeAdmin,
    adminMode,
  };
}
