import { describe, expect, it } from "vitest";

import type { PortalApp } from "../core/portal.js";
import { NoApplicationsError, selectApplication } from "./appSelect.js";

function app(over: Partial<PortalApp> = {}): PortalApp {
  return {
    id: "app-1",
    name: "Acme",
    domain: "https://acme.seamlessauth.com",
    hasServiceToken: false,
    ...over,
  };
}

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
});
