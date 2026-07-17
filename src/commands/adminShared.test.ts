import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ReauthRequiredError } from "../core/authClient.js";
import { AdminApiError, PermissionError } from "../core/admin.js";
import { parseList, reportAdminError } from "./adminShared.js";

describe("reportAdminError", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation(((code?: number) => {
        throw new Error(`exit:${code}`);
      }) as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logs a yellow message and exits 1 on a reauth error", () => {
    const err = new ReauthRequiredError("Run: seamless login.");
    expect(() => reportAdminError(err)).toThrow("exit:1");
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Run: seamless login."));
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("logs a red error and exits 1 on a permission error", () => {
    const err = new PermissionError();
    expect(() => reportAdminError(err)).toThrow("exit:1");
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("requires an admin role"),
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("logs a red error and exits 1 on an admin api error", () => {
    const err = new AdminApiError("Could not list users (500).");
    expect(() => reportAdminError(err)).toThrow("exit:1");
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Could not list users (500)."),
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("rethrows unrecognized errors", () => {
    const err = new Error("boom");
    expect(() => reportAdminError(err)).toThrow("boom");
    expect(exitSpy).not.toHaveBeenCalled();
  });
});

describe("parseList", () => {
  it("returns undefined when no value is given", () => {
    expect(parseList(undefined)).toBeUndefined();
  });

  it("splits, trims, and drops empty entries", () => {
    expect(parseList("a, b ,c")).toEqual(["a", "b", "c"]);
  });

  it("returns an empty array for a blank string", () => {
    expect(parseList("")).toEqual([]);
    expect(parseList(" , , ")).toEqual([]);
  });
});
