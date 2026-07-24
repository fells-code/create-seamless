import kleur from "kleur";

export function printSuccessOutput(config: {
  projectName?: string;
  root: string;
  webFramework: string | null;
  apiFramework: string | null;
  authMode: "local" | "docker";
  useDocker: boolean | symbol;
  adminMode: "api" | "image" | "source" | "none";
}) {
  const { projectName, webFramework, apiFramework, authMode, useDocker, adminMode } =
    config;

  // Where the admin console lives: proxied by the app API at /console, or a
  // standalone container on 5174. "none" scaffolds no console at all.
  const consoleUrl =
    adminMode === "api"
      ? "http://localhost:3000/console"
      : adminMode === "none"
        ? null
        : "http://localhost:5174";

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
      kleur.dim(authMode === "local" ? " (local source)" : " (Docker image)"),
  );

  if (consoleUrl) {
    console.log(
      "  • " +
        kleur.white("Admin console") +
        kleur.dim(
          adminMode === "api" ? " (served by API at /console)" : " (management UI)",
        ),
    );
  }

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
    if (authMode === "local") {
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

  if (consoleUrl) {
    console.log("  Console:" + kleur.cyan(` ${consoleUrl}`));
  }

  console.log("");

  console.log(kleur.bold("Notes:\n"));

  console.log(kleur.dim("  • Web connects to API automatically"));
  console.log(kleur.dim("  • API connects to Auth automatically"));
  if (consoleUrl) {
    console.log(
      kleur.dim(
        adminMode === "api"
          ? "  • Admin console is served by the API at /console"
          : "  • Admin console uses the same auth system",
      ),
    );
  }
  console.log(
    kleur.dim("  • Bootstrap command provisions the first admin user"),
  );
  console.log(kleur.dim("  • All secrets and keys are pre-configured\n"));

  console.log(
    kleur.dim("Docs: ") + kleur.cyan("https://docs.seamlessauth.com\n"),
  );

  console.log(kleur.bold().green("Setup complete.\n"));
}

export function printManagedSuccessOutput(config: {
  projectName?: string;
  webFramework: string | null;
  apiFramework: string | null;
  authServerUrl: string;
  appName: string;
}) {
  const { projectName, webFramework, apiFramework, authServerUrl, appName } =
    config;

  const title = kleur.bold().cyan("SEAMLESS");

  console.log(`
╔════════════════════════════════════════╗
║          ${title}                      ║
╚════════════════════════════════════════╝
`);

  console.log(kleur.green("Project connected to a managed instance.\n"));

  console.log(kleur.dim("Managed application: ") + kleur.bold(appName));
  console.log(kleur.dim("Auth server:         ") + kleur.cyan(authServerUrl));
  console.log("");

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
    "  • " + kleur.white("Auth server") + kleur.dim(" (managed instance)"),
  );
  console.log("");

  console.log(kleur.bold("Next steps:\n"));
  if (apiFramework) {
    console.log(kleur.dim("  # API server"));
    console.log("  cd api && npm install && npm run dev\n");
  }
  if (webFramework) {
    console.log(kleur.dim("  # Web app"));
    console.log("  cd web && npm install && npm run dev\n");
  }
  console.log("  Sign in from the web app to confirm the session resolves.\n");

  console.log(kleur.bold("Notes:\n"));
  console.log(
    kleur.dim(
      "  • The API service token was written to api/.env. Keep it out of version control.",
    ),
  );
  console.log(
    kleur.dim(
      "  • Auth, users, and OAuth providers are managed from the dashboard, not locally.",
    ),
  );
  console.log(
    kleur.dim("  • Rotate the service token anytime with the dashboard.\n"),
  );

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
