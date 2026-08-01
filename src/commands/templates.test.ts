import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { openTemplateSource } from "../core/templates.js";
import { runTemplates } from "./templates.js";

// templateFlags is a pure registry lookup, so it comes from the real module and
// only the fetching export is stubbed. templates.ts imports VERSION from
// ../index.js, which runs main() at import time, hence the mock below it.
vi.mock("../core/templates.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../core/templates.js")>()),
  openTemplateSource: vi.fn(),
}));
vi.mock("../index.js", () => ({ VERSION: "0.0.0-test" }));

function registry() {
  return {
    schemaVersion: 1,
    templates: [
      {
        id: "react-vite",
        kind: "web",
        framework: "react",
        label: "React (Vite)",
        alias: "basic",
        status: "stable",
        path: "templates/web/react-vite",
      },
      {
        id: "express",
        kind: "api",
        framework: "express",
        label: "Express",
        status: "stable",
        path: "templates/api/express",
      },
      {
        id: "go-chi",
        kind: "api",
        framework: "go",
        label: "Go",
        alias: "go",
        status: "coming-soon",
        path: "templates/api/go-chi",
      },
    ],
  };
}

let logs: string[];
let errors: string[];

beforeEach(() => {
  vi.clearAllMocks();
  logs = [];
  errors = [];
  vi.spyOn(console, "log").mockImplementation((msg?: unknown) => {
    logs.push(String(msg ?? ""));
  });
  vi.spyOn(console, "error").mockImplementation((msg?: unknown) => {
    errors.push(String(msg ?? ""));
  });
  vi.mocked(openTemplateSource).mockResolvedValue({
    registry: registry(),
  } as never);
});

afterEach(() => {
  vi.restoreAllMocks();
});

const out = () => logs.join("\n");

describe("templates list", () => {
  it("defaults to list when no subcommand is given", async () => {
    await runTemplates([]);
    expect(out()).toContain("react-vite");
    expect(out()).toContain("express");
  });

  it("shows both the alias and the id as init flags", async () => {
    await runTemplates(["list"]);
    expect(out()).toContain("--basic, --react-vite");
  });

  it("shows the id alone for a template with no alias", async () => {
    await runTemplates(["list"]);
    expect(out()).toContain("--express");
    expect(out()).not.toContain("--, --express");
  });

  it("offers no flag for a coming-soon template", async () => {
    await runTemplates(["list"]);
    const row = logs.find((line) => line.startsWith("go-chi"));
    expect(row).toBeDefined();
    expect(row).not.toContain("--go");
    expect(row).toContain("coming-soon");
  });

  it("emits the registry entries with --json", async () => {
    await runTemplates(["list", "--json"]);
    const parsed = JSON.parse(out());
    expect(parsed).toHaveLength(3);
    expect(parsed[0]).toMatchObject({ id: "react-vite", alias: "basic" });
  });

  it("reports an empty registry rather than printing an empty table", async () => {
    vi.mocked(openTemplateSource).mockResolvedValue({
      registry: { schemaVersion: 1, templates: [] },
    } as never);

    await runTemplates(["list"]);
    expect(out()).toContain("registry is empty");
  });

  it("rejects an unknown subcommand", async () => {
    const exit = vi
      .spyOn(process, "exit")
      .mockImplementation(() => undefined as never);

    await runTemplates(["nope"]);

    expect(errors.join("\n")).toContain("Unknown templates subcommand");
    expect(exit).toHaveBeenCalledWith(1);
  });
});
