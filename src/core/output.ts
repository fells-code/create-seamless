import kleur from "kleur";

export function printSuccessOutput(config: {
  projectName?: string;
  root: string;
  webFramework: string | null;
  apiFramework: string | null;
  authMode: "local" | "docker";
  useDocker: boolean | symbol;
}) {
  const { projectName, webFramework, apiFramework, authMode, useDocker } =
    config;

  const title = kleur.bold().cyan("SEAMLESS");

  console.log(`
╔════════════════════════════════════════╗
║          ${title}                      ║
╚════════════════════════════════════════╝
`);

  console.log(kleur.green("✔ Your SeamlessAuth project is ready.\n"));

  if (projectName) {
    console.log(kleur.dim("Project created in: ") + kleur.bold(projectName));
    console.log(kleur.cyan(`cd ${projectName}\n`));
  }

  console.log(kleur.bold("Project includes:\n"));

  if (webFramework) {
    console.log(
      "  • " +
        kleur.white("Web app") +
        kleur.dim(` (${formatFramework(webFramework)})`),
    );
  }

  if (apiFramework) {
    console.log(
      "  • " +
        kleur.white("API server") +
        kleur.dim(` (${formatFramework(apiFramework)})`),
    );
  }

  console.log(
    "  • " +
      kleur.white("Auth server") +
      kleur.dim(authMode === "local" ? " (local source)" : " (Docker image)"),
  );

  console.log("");

  console.log(kleur.bold("Getting started:\n"));

  if (useDocker) {
    console.log(kleur.cyan("  docker compose up\n"));
  } else {
    if (authMode === "local") {
      console.log(kleur.dim("# Auth server"));
      console.log("  cd auth && npm install && npm run dev\n");
    }

    if (apiFramework) {
      console.log(kleur.dim("# API server"));
      console.log("  cd api && npm install && npm run dev\n");
    }

    if (webFramework) {
      console.log(kleur.dim("# Web app"));
      console.log("  cd web && npm install && npm run dev\n");
    }
  }

  console.log(kleur.bold("Available services:\n"));

  console.log("  Auth: " + kleur.cyan("http://localhost:5312"));

  if (apiFramework) {
    console.log("  API:  " + kleur.cyan("http://localhost:3000"));
  }

  if (webFramework) {
    console.log("  Web:  " + kleur.cyan("http://localhost:5173"));
  }

  console.log("");

  console.log(kleur.bold("Notes:\n"));

  console.log(kleur.dim("  • Web connects to API automatically"));
  console.log(kleur.dim("  • API connects to Auth automatically"));
  console.log(kleur.dim("  • All secrets and keys are pre-configured\n"));

  console.log(
    kleur.dim("Docs: ") + kleur.cyan("https://docs.seamlessauth.com\n"),
  );

  console.log(kleur.bold().green("Happy hacking. 🚀\n"));
}

function formatFramework(name: string) {
  const map: Record<string, string> = {
    react: "React",
    express: "Express",
    angular: "Angular",
    next: "Next.js",
    fastapi: "FastAPI",
    fastify: "Fastify",
    vue: "Vue",
  };

  return map[name] || name;
}
