import { confirm, select, text } from "@clack/prompts";

type WebFramework = string | null;
type ApiFramework = string | null;
type AuthMode = "local" | "docker";

export async function runProjectSetupPrompts() {
  const web = await confirm({
    message: "Do you want to create a web application?",
  });

  let webFramework: WebFramework = null;

  if (web) {
    const result = await select({
      message: "Which framework?",
      options: [
        { value: "react", label: "React (Vite)" },
        { value: "next", label: "Next.js (coming soon)", disabled: true },
        { value: "vue", label: "Vue (coming soon)", disabled: true },
        { value: "angular", label: "Angular (coming soon)", disabled: true },
      ],
    });

    webFramework = result as WebFramework;
  }

  const api = await confirm({
    message: "Do you want to create an API server?",
  });

  let apiFramework: ApiFramework = null;

  if (api) {
    const result = await select({
      message: "Which backend?",
      options: [
        { value: "express", label: "Express" },
        { value: "next", label: "Next.js (coming soon)", disabled: true },
        { value: "fastify", label: "Fastify (coming soon)", disabled: true },
        { value: "fast-api", label: "FastAPI (coming soon)", disabled: true },
      ],
    });

    apiFramework = result as ApiFramework;
  }

  const authMode = (await select({
    message: "How would you like to run SeamlessAuth?",
    options: [
      {
        value: "local",
        label: "Local development server (npm run dev yourself)",
      },
      {
        value: "docker",
        label: "Docker container (recommended - just run docker compose up)",
      },
    ],
  })) as AuthMode;

  let useDocker = await confirm({
    message: "Do you want to run your stack with Docker?",
  });

  if (authMode === "docker" && !useDocker) {
    console.log(
      "\nAuth server requires Docker — enabling Docker mode automatically.\n",
    );
    useDocker = true;
  }

  return {
    web,
    webFramework,
    api,
    apiFramework,
    authMode,
    useDocker,
  };
}
