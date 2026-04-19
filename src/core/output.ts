import kleur from "kleur";

export function printSuccessOutput(config: {
  projectName?: string;
  root: string;
  webFramework: string | null;
  apiFramework: string | null;
  authMode: "image" | "source";
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

  console.log(kleur.green("Project initialized successfully.\n"));

  if (projectName) {
    console.log(kleur.dim("Project directory: ") + kleur.bold(projectName));
    console.log(kleur.cyan(`cd ${projectName}\n`));
  }

  console.log(kleur.bold("Included services:\n"));

  if (webFramework) {
    console.log(
      "  • " +
        kleur.white("Web application") +
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
      kleur.dim(authMode === "source" ? " (source)" : " (image)"),
  );

  console.log(
    "  • " + kleur.white("Admin dashboard") + kleur.dim(" (management UI)"),
  );

  console.log("");

  console.log(kleur.bold("Next steps:\n"));

  if (useDocker) {
    console.log("  1. Start services");
    console.log(kleur.cyan("     docker compose up\n"));

    console.log("  2. Create your first admin user");
    console.log(kleur.cyan("     seamless bootstrap-admin\n"));

    console.log("  3. Complete registration in the browser");
    console.log(kleur.dim("     This grants admin access to the system\n"));
  } else {
    if (authMode === "source") {
      console.log(kleur.dim("  # Auth server"));

      console.log(
        kleur.yellow(
          "  Requires a local PostgreSQL instance running on localhost:5432\n",
        ),
      );

      console.log("  cd auth");
      console.log("  npm install\n");

      console.log(kleur.dim("  # Initialize database"));
      console.log("  npm run db:create");
      console.log("  npm run db:migrate\n");

      console.log(kleur.dim("  # Start auth server"));
      console.log("  npm run dev\n");
    }

    if (apiFramework) {
      console.log(kleur.dim("  # API server"));
      console.log("  cd api && npm install && npm run dev\n");
    }

    if (webFramework) {
      console.log(kleur.dim("  # Web app"));
      console.log("  cd web && npm install && npm run dev\n");
    }

    console.log("  2. Create your first admin user");
    console.log(kleur.cyan("     seamless bootstrap-admin\n"));
  }

  console.log(kleur.bold("Available services:\n"));

  console.log("  Auth:   " + kleur.cyan("http://localhost:5312"));

  if (apiFramework) {
    console.log("  API:    " + kleur.cyan("http://localhost:3000"));
  }

  if (webFramework) {
    console.log("  Web:    " + kleur.cyan("http://localhost:5173"));
  }

  console.log("  Admin:  " + kleur.cyan("http://localhost:5174"));

  console.log("");

  console.log(kleur.bold("Notes:\n"));

  console.log(kleur.dim("  • Web connects to API automatically"));
  console.log(kleur.dim("  • API connects to Auth automatically"));
  console.log(kleur.dim("  • Admin dashboard uses the same auth system"));
  console.log(
    kleur.dim("  • Bootstrap command provisions the first admin user"),
  );
  console.log(kleur.dim("  • All secrets and keys are pre-configured\n"));

  console.log(
    kleur.dim("Docs: ") + kleur.cyan("https://docs.seamlessauth.com\n"),
  );

  console.log(kleur.bold().green("Setup complete.\n"));
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
