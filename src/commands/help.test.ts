import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// index.ts and help.ts import each other (help.ts reads VERSION from index.ts).
// Loading index.ts first here avoids a circular-import TDZ error that occurs
// when help.ts is the first module to pull index.ts in.
import "../index.js";
import { printHelp } from "./help.js";

describe("printHelp", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it("prints usage information", () => {
    printHelp();

    expect(logSpy).toHaveBeenCalledTimes(1);
    const [output] = logSpy.mock.calls[0];
    expect(output).toContain("seamless v");
    expect(output).toContain("USAGE");
    expect(output).toContain("seamless login");
    expect(output).toContain("https://docs.seamlessauth.com");
  });
});
