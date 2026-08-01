import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { select, isCancel, cancel } from "@clack/prompts";
import { CancelledError } from "../core/cancel.js";
import type { PortalApp } from "../core/portal.js";
import { NoApplicationsError, selectApplication } from "./appSelect.js";

vi.mock("@clack/prompts", () => ({
  select: vi.fn(),
  isCancel: vi.fn(),
  cancel: vi.fn(),
}));

function app(over: Partial<PortalApp> = {}): PortalApp {
  return {
    id: "app-1",
    name: "Acme",
    domain: "https://acme.seamlessauth.com",
    hasServiceToken: false,
    ...over,
  };
}

// Captured before any test flips it, so a suite run leaves the process as it
// found it.
const ORIGINAL_TTY = process.stdin.isTTY;

beforeEach(() => {
  // The prompt path refuses to run without a terminal, and vitest has none.
  process.stdin.isTTY = true;
});

afterEach(() => {
  process.stdin.isTTY = ORIGINAL_TTY;
});

describe("selectApplication", () => {
  it("throws when there are no applications", async () => {
    await expect(selectApplication([])).rejects.toBeInstanceOf(
      NoApplicationsError,
    );
  });

  it("auto-selects the only application", async () => {
    const only = app();
    await expect(selectApplication([only])).resolves.toBe(only);
  });

  it("matches --app by id", async () => {
    const a = app({ id: "app-1" });
    const b = app({ id: "app-2", name: "Beta" });
    await expect(selectApplication([a, b], "app-2")).resolves.toBe(b);
  });

  it("matches --app by infra id", async () => {
    const a = app({ id: "app-1", infraId: "acme" });
    const b = app({ id: "app-2", infraId: "beta" });
    await expect(selectApplication([a, b], "beta")).resolves.toBe(b);
  });

  it("rejects an unknown --app value", async () => {
    await expect(
      selectApplication([app(), app({ id: "app-2" })], "nope"),
    ).rejects.toThrow(/No managed application matches/);
  });

  it("prompts to choose among multiple applications and returns the match", async () => {
    const a = app({ id: "app-1", name: "Acme" });
    const b = app({ id: "app-2", name: "Beta" });
    vi.mocked(select).mockResolvedValue("app-2" as never);
    vi.mocked(isCancel).mockReturnValue(false);

    const result = await selectApplication([a, b]);

    expect(select).toHaveBeenCalledWith({
      message: "Which managed application should this project connect to?",
      options: [
        { value: "app-1", label: "Acme", hint: a.domain },
        { value: "app-2", label: "Beta", hint: b.domain },
      ],
    });
    expect(result).toBe(b);
    expect(cancel).not.toHaveBeenCalled();
  });

  it("cancels when the interactive prompt is cancelled", async () => {
    const a = app({ id: "app-1" });
    const b = app({ id: "app-2" });
    const cancelSymbol = Symbol("cancel");
    vi.mocked(select).mockResolvedValue(cancelSymbol as never);
    vi.mocked(isCancel).mockReturnValue(true);

    // Throwing rather than returning null is what lets init unwind the project
    // directory it created.
    await expect(selectApplication([a, b])).rejects.toBeInstanceOf(
      CancelledError,
    );
  });

  it("errors when the selected value no longer matches any application", async () => {
    const a = app({ id: "app-1" });
    const b = app({ id: "app-2" });
    vi.mocked(select).mockResolvedValue("app-3" as never);
    vi.mocked(isCancel).mockReturnValue(false);

    await expect(selectApplication([a, b])).rejects.toThrow(
      /no longer available/,
    );
  });
});
