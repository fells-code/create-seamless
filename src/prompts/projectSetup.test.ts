import { confirm, select } from "@clack/prompts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { RegistryEntry } from "../core/templates.js";
import {
  runManagedTemplatePrompts,
  runProjectSetupPrompts,
} from "./projectSetup.js";

vi.mock("@clack/prompts", () => ({
  select: vi.fn(),
  confirm: vi.fn(),
}));

interface SelectArgs {
  message: string;
  options: Array<{ value: string; label: string; disabled?: boolean }>;
}

// Answers select() by matching the prompt message, and records every call's
// options so tests can assert on label/disabled derivation.
function mockSelect(responses: Record<string, string>): SelectArgs[] {
  const calls: SelectArgs[] = [];
  vi.mocked(select).mockImplementation(async (args: unknown) => {
    const a = args as SelectArgs;
    calls.push(a);
    if (!(a.message in responses)) {
      throw new Error(`unexpected select prompt: ${a.message}`);
    }
    return responses[a.message];
  });
  return calls;
}

function mockConfirm(responses: Record<string, boolean>) {
  vi.mocked(confirm).mockImplementation(async (args: unknown) => {
    const a = args as { message: string };
    if (!(a.message in responses)) {
      throw new Error(`unexpected confirm prompt: ${a.message}`);
    }
    return responses[a.message];
  });
}

function entry(over: Partial<RegistryEntry> = {}): RegistryEntry {
  return {
    id: "web-a",
    kind: "web",
    framework: "react",
    label: "React",
    status: "stable",
    path: "web-a",
    ...over,
  };
}

function fullRegistry(): RegistryEntry[] {
  return [
    entry({ id: "web-a", kind: "web", label: "React", status: "stable", path: "web-a" }),
    entry({ id: "web-b", kind: "web", label: "Vue", status: "beta", path: "web-b" }),
    entry({ id: "web-c", kind: "web", label: "Svelte", status: "coming-soon", path: "web-c" }),
    entry({ id: "api-a", kind: "api", label: "Express", status: "stable", path: "api-a" }),
  ];
}

let logs: string[];

beforeEach(() => {
  logs = [];
  vi.spyOn(console, "log").mockImplementation((msg?: unknown) => {
    logs.push(String(msg ?? ""));
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

function out(): string {
  return logs.join("\n");
}

describe("runManagedTemplatePrompts", () => {
  it("throws when the registry has no templates of the requested kind", async () => {
    const onlyApi = fullRegistry().filter((t) => t.kind === "api");
    await expect(runManagedTemplatePrompts(onlyApi)).rejects.toThrow(
      /no web templates/,
    );
  });

  it("throws when there is no api template, after web is resolved", async () => {
    const onlyWeb = fullRegistry().filter((t) => t.kind === "web");
    await expect(
      runManagedTemplatePrompts(onlyWeb, { webTemplateId: "web-a" }),
    ).rejects.toThrow(/no api templates/);
  });

  it("prompts for both web and api when nothing is preselected", async () => {
    const calls = mockSelect({
      "Web example": "web-b",
      "Backend framework": "api-a",
    });

    const result = await runManagedTemplatePrompts(fullRegistry());

    expect(result).toEqual({ webTemplateId: "web-b", apiTemplateId: "api-a" });

    const webCall = calls.find((c) => c.message === "Web example")!;
    expect(webCall.options).toEqual([
      { value: "web-a", label: "React", disabled: false },
      { value: "web-b", label: "Vue (beta)", disabled: false },
      { value: "web-c", label: "Svelte (coming soon)", disabled: true },
    ]);
  });

  it("skips both prompts and logs the preselected labels", async () => {
    const result = await runManagedTemplatePrompts(fullRegistry(), {
      webTemplateId: "web-a",
      apiTemplateId: "api-a",
    });

    expect(result).toEqual({ webTemplateId: "web-a", apiTemplateId: "api-a" });
    expect(select).not.toHaveBeenCalled();
    expect(out()).toContain("Web example: React");
    expect(out()).toContain("Backend: Express");
  });

  it("falls back to the raw id when a preselected id is not in the registry", async () => {
    await runManagedTemplatePrompts(fullRegistry(), {
      webTemplateId: "unknown-id",
      apiTemplateId: "api-a",
    });

    expect(out()).toContain("Web example: unknown-id");
  });
});

describe("runProjectSetupPrompts", () => {
  it("runs the full docker + API-served console flow with no preselection", async () => {
    mockSelect({
      "Web example": "web-a",
      "Backend framework": "api-a",
      "How would you like to run SeamlessAuth?": "docker",
      "How would you like to host the admin console?": "api",
    });

    const result = await runProjectSetupPrompts(fullRegistry());

    expect(result).toEqual({
      web: true,
      webTemplateId: "web-a",
      api: true,
      apiTemplateId: "api-a",
      authMode: "docker",
      useDocker: true,
      adminMode: "api",
    });
    expect(confirm).not.toHaveBeenCalled();
  });

  it("uses preselected template ids and logs them instead of prompting", async () => {
    mockSelect({
      "How would you like to run SeamlessAuth?": "docker",
      "How would you like to host the admin console?": "none",
    });

    const result = await runProjectSetupPrompts(fullRegistry(), {
      webTemplateId: "web-b",
      apiTemplateId: "api-a",
    });

    expect(result.webTemplateId).toBe("web-b");
    expect(result.apiTemplateId).toBe("api-a");
    expect(out()).toContain("Web example: Vue");
    expect(out()).toContain("Backend: Express");
  });

  it("returns the chosen console hosting mode", async () => {
    const calls = mockSelect({
      "Web example": "web-a",
      "Backend framework": "api-a",
      "How would you like to run SeamlessAuth?": "docker",
      "How would you like to host the admin console?": "source",
    });

    const result = await runProjectSetupPrompts(fullRegistry());

    expect(result.adminMode).toBe("source");

    // The console prompt offers all four hosting options, defaulting to api.
    const consoleCall = calls.find(
      (c) => c.message === "How would you like to host the admin console?",
    )!;
    expect(consoleCall.options.map((o) => o.value)).toEqual([
      "api",
      "image",
      "source",
      "none",
    ]);
  });

  it("selects the standalone image console mode when chosen", async () => {
    mockSelect({
      "Web example": "web-a",
      "Backend framework": "api-a",
      "How would you like to run SeamlessAuth?": "docker",
      "How would you like to host the admin console?": "image",
    });

    const result = await runProjectSetupPrompts(fullRegistry());

    expect(result.adminMode).toBe("image");
  });

  it("confirms docker is required when local auth mode is chosen and accepted", async () => {
    mockSelect({
      "Web example": "web-a",
      "Backend framework": "api-a",
      "How would you like to run SeamlessAuth?": "local",
      "How would you like to host the admin console?": "api",
    });
    mockConfirm({
      "Auth server still requires Docker for full stack. Enable Docker?": true,
    });

    const result = await runProjectSetupPrompts(fullRegistry());

    expect(result.authMode).toBe("local");
    expect(result.useDocker).toBe(true);
    expect(out()).not.toContain("Enabling automatically");
  });

  it("logs the auto-enable notice when the local docker confirmation is declined", async () => {
    mockSelect({
      "Web example": "web-a",
      "Backend framework": "api-a",
      "How would you like to run SeamlessAuth?": "local",
      "How would you like to host the admin console?": "api",
    });
    mockConfirm({
      "Auth server still requires Docker for full stack. Enable Docker?": false,
    });

    const result = await runProjectSetupPrompts(fullRegistry());

    expect(result.useDocker).toBe(true);
    expect(out()).toContain("Enabling automatically");
  });
});
