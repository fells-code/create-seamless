import path from "path";
import { describe, expect, it } from "vitest";
import { PROJECT_ROOT, TEMPLATE_ROOT } from "./paths.js";

describe("paths", () => {
  it("resolves PROJECT_ROOT as an absolute directory", () => {
    expect(path.isAbsolute(PROJECT_ROOT)).toBe(true);
  });

  it("derives TEMPLATE_ROOT from PROJECT_ROOT", () => {
    expect(TEMPLATE_ROOT).toBe(path.join(PROJECT_ROOT, "templates"));
  });
});
