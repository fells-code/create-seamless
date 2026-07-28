import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  maskDatabaseUrl,
  printManagedSuccessOutput,
  printSuccessOutput,
} from "./output.js";

let logSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  logSpy.mockRestore();
});

function allLogs(): string {
  return logSpy.mock.calls.map((call) => call.join(" ")).join("\n");
}

describe("printSuccessOutput", () => {
  it("prints local-mode output with web + api frameworks, projectName and useDocker", () => {
    printSuccessOutput({
      projectName: "my-app",
      root: "/tmp/my-app",
      webFramework: "react",
      apiFramework: "express",
      authMode: "local",
      useDocker: true,
      adminMode: "image",
      ownerEmail: "dev@example.com",
    });

    const out = allLogs();
    expect(out).toContain("SEAMLESS");
    expect(out).toContain("Project initialized successfully.");
    expect(out).toContain("Project directory: ");
    expect(out).toContain("my-app");
    expect(out).toContain("cd my-app");
    expect(out).toContain("Web application");
    expect(out).toContain("(React)");
    expect(out).toContain("API server");
    expect(out).toContain("(Express)");
    expect(out).toContain("(local source)");
    expect(out).toContain("Admin console");
    expect(out).toContain("1. Start services");
    expect(out).toContain("docker compose up");
    expect(out).toContain("2. Register in the browser with");
    expect(out).toContain("dev@example.com");
    expect(out).toContain("http://localhost:5312");
    expect(out).toContain("http://localhost:3000");
    expect(out).toContain("http://localhost:5173");
    expect(out).toContain("http://localhost:5174");
    expect(out).toContain("Docs: ");
    expect(out).toContain("https://docs.seamlessauth.com");
    expect(out).toContain("Setup complete.");
  });

  it("prints the /console URL for API-served hosting", () => {
    printSuccessOutput({
      projectName: "my-app",
      root: "/tmp/my-app",
      webFramework: "react",
      apiFramework: "express",
      authMode: "docker",
      useDocker: true,
      adminMode: "api",
      ownerEmail: "dev@example.com",
    });

    const out = allLogs();
    expect(out).toContain("Admin console");
    expect(out).toContain("served by API at /console");
    expect(out).toContain("Console: http://localhost:3000/console");
    expect(out).not.toContain("http://localhost:5174");
  });

  it("omits the console line entirely when hosting is none", () => {
    printSuccessOutput({
      projectName: "my-app",
      root: "/tmp/my-app",
      webFramework: "react",
      apiFramework: "express",
      authMode: "docker",
      useDocker: true,
      adminMode: "none",
      ownerEmail: "dev@example.com",
    });

    const out = allLogs();
    expect(out).not.toContain("Admin console");
    expect(out).not.toContain("Console:");
    expect(out).not.toContain("http://localhost:5174");
  });

  it("prints docker authMode label even when useDocker is falsy (symbol edge case not exercised here)", () => {
    printSuccessOutput({
      root: "/tmp/my-app",
      webFramework: null,
      apiFramework: null,
      authMode: "docker",
      useDocker: false,
      adminMode: "image",
      ownerEmail: "dev@example.com",
    });

    const out = allLogs();
    expect(out).toContain("(Docker image)");
    // No project name section when omitted
    expect(out).not.toContain("Project directory: ");
    // No web/api service lines
    expect(out).not.toContain("Web application");
    expect(out).not.toContain("API server");
    // Local (non-docker) branch: no local-mode auth server steps since authMode is "docker"
    expect(out).not.toContain("Requires a local PostgreSQL instance");
    // No API/Web url lines
    expect(out).not.toContain("API:    ");
    expect(out).not.toContain("Web:    ");
    // Non-docker branch has no numbered start-services step to hang it off.
    expect(out).toContain("Register with");
  });

  it("prints local (non-docker) auth server setup steps when authMode is local and useDocker is false", () => {
    printSuccessOutput({
      root: "/tmp/my-app",
      webFramework: "vue",
      apiFramework: "fastapi",
      authMode: "local",
      useDocker: false,
      adminMode: "image",
      ownerEmail: "dev@example.com",
    });

    const out = allLogs();
    expect(out).toContain("# Auth server");
    expect(out).toContain(
      "Requires a local PostgreSQL instance running on localhost:5432",
    );
    expect(out).toContain("cd auth");
    expect(out).toContain("npm install");
    expect(out).toContain("# Initialize database");
    expect(out).toContain("npm run db:create");
    expect(out).toContain("npm run db:migrate");
    expect(out).toContain("# Start auth server");
    expect(out).toContain("npm run dev");
    expect(out).toContain("# API server");
    expect(out).toContain("cd api && npm install && npm run dev");
    expect(out).toContain("# Web app");
    expect(out).toContain("cd web && npm install && npm run dev");
    expect(out).toContain("(FastAPI)");
    expect(out).toContain("(Vue)");
  });

  it("handles an unknown framework name by passing it through unchanged", () => {
    printSuccessOutput({
      root: "/tmp/my-app",
      webFramework: "svelte",
      apiFramework: "django",
      authMode: "docker",
      useDocker: true,
      adminMode: "image",
      ownerEmail: "dev@example.com",
    });

    const out = allLogs();
    expect(out).toContain("(svelte)");
    expect(out).toContain("(django)");
  });

  it("covers useDocker as a symbol (truthy, non-boolean) taking the docker branch", () => {
    printSuccessOutput({
      root: "/tmp/my-app",
      webFramework: null,
      apiFramework: null,
      authMode: "docker",
      useDocker: Symbol("cancel"),
      adminMode: "none",
      ownerEmail: "dev@example.com",
    });

    const out = allLogs();
    expect(out).toContain("1. Start services");
    expect(out).toContain("docker compose up");
  });
});

describe("printManagedSuccessOutput", () => {
  it("prints managed output with web + api frameworks and projectName", () => {
    printManagedSuccessOutput({
      projectName: "my-app",
      webFramework: "next",
      apiFramework: "fastify",
      authServerUrl: "https://auth.example.com",
      appName: "Acme App",
      databaseUrl:
        "postgres://USER:PASSWORD@db.example.com:5432/tenant?sslmode=require",
    });

    const out = allLogs();
    expect(out).toContain("SEAMLESS");
    expect(out).toContain("Project connected to a managed instance.");
    expect(out).toContain("Managed application: ");
    expect(out).toContain("Acme App");
    expect(out).toContain("Auth server:         ");
    expect(out).toContain("https://auth.example.com");
    expect(out).toContain("Project directory: ");
    expect(out).toContain("my-app");
    expect(out).toContain("cd my-app");
    expect(out).toContain("Web application");
    expect(out).toContain("(Next.js)");
    expect(out).toContain("API server");
    expect(out).toContain("(Fastify)");
    expect(out).toContain("(managed instance)");
    expect(out).toContain("# API server");
    expect(out).toContain("cd api && npm install && npm run dev");
    expect(out).toContain("# Web app");
    expect(out).toContain("cd web && npm install && npm run dev");
    expect(out).toContain(
      "Sign in from the web app to confirm the session resolves.",
    );
    expect(out).toContain(
      "The API service token was written to api/.env. Keep it out of version control.",
    );
    expect(out).toContain(
      "Auth, users, and OAuth providers are managed from the dashboard, not locally.",
    );
    expect(out).toContain(
      "Rotate the service token anytime with the dashboard.",
    );
    expect(out).toContain("Docs: ");
    expect(out).toContain("https://docs.seamlessauth.com");
    expect(out).toContain("Setup complete.");
  });

  it("omits project directory and web/api service lines when unset", () => {
    printManagedSuccessOutput({
      webFramework: null,
      apiFramework: null,
      authServerUrl: "https://auth.example.com",
      appName: "Acme App",
    });

    const out = allLogs();
    expect(out).not.toContain("Project directory: ");
    expect(out).not.toContain("Web application");
    expect(out).not.toContain("API server");
    expect(out).not.toContain("# API server");
    expect(out).not.toContain("# Web app");
    expect(out).toContain(
      "Sign in from the web app to confirm the session resolves.",
    );
  });
});

describe("maskDatabaseUrl", () => {
  it("masks userinfo in anything printed as a connection string", () => {
    expect(
      maskDatabaseUrl("postgres://real:s3cret@db.example.com:5432/tenant"),
    ).toBe("postgres://****:****@db.example.com:5432/tenant");
  });

  it("leaves a URL without userinfo alone", () => {
    expect(maskDatabaseUrl("postgres://db.example.com:5432/tenant")).toBe(
      "postgres://db.example.com:5432/tenant",
    );
  });
});
