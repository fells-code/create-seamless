import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { confirm, isCancel } from "@clack/prompts";
import { confirmDestructive, hasForceFlag } from "./confirmAction.js";

vi.mock("@clack/prompts", () => {
  const CANCEL = Symbol("cancel");
  return {
    CANCEL,
    confirm: vi.fn(),
    isCancel: (value: unknown) => value === CANCEL,
  };
});

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("hasForceFlag", () => {
  it.each(["--force", "--yes", "-y"])("accepts %s", (flag) => {
    expect(hasForceFlag([flag])).toBe(true);
  });

  it("is false without one", () => {
    expect(hasForceFlag(["--json", "some-id"])).toBe(false);
  });

  // --yes predates the --force convention (config oauth-providers remove
  // shipped with it), so dropping it would break a documented command.
  it("keeps accepting the flag that shipped first", () => {
    expect(hasForceFlag(["provider-id", "--yes"])).toBe(true);
  });
});

describe("confirmDestructive", () => {
  it("does not ask when --force answered it", async () => {
    await expect(
      confirmDestructive({ message: "Delete it?", force: true }),
    ).resolves.toBe(true);
    expect(confirm).not.toHaveBeenCalled();
  });

  it("asks, and returns the answer", async () => {
    vi.mocked(confirm).mockResolvedValue(true as never);

    await expect(
      confirmDestructive({ message: "Delete it?", force: false }),
    ).resolves.toBe(true);
    expect(confirm).toHaveBeenCalledWith({
      message: "Delete it?",
      initialValue: false,
    });
  });

  it("declines by default", async () => {
    vi.mocked(confirm).mockResolvedValue(false as never);

    await expect(
      confirmDestructive({ message: "Delete it?", force: false }),
    ).resolves.toBe(false);
  });

  // Ctrl-C at a destructive confirmation means "do not do it", which is the
  // same outcome as answering No.
  it("treats a cancel as a decline", async () => {
    const { CANCEL } = (await import("@clack/prompts")) as unknown as {
      CANCEL: symbol;
    };
    vi.mocked(confirm).mockResolvedValue(CANCEL as never);
    expect(isCancel(CANCEL)).toBe(true);

    await expect(
      confirmDestructive({ message: "Delete it?", force: false }),
    ).resolves.toBe(false);
  });

  it("refuses to ask without a terminal, naming --force", async () => {
    process.stdin.isTTY = false;

    await expect(
      confirmDestructive({ message: "Delete it?", force: false }),
    ).rejects.toThrow(/"Delete it\?" needs an interactive terminal.*--force/s);
    expect(confirm).not.toHaveBeenCalled();
  });

  it("uses a caller's remedy in the no-terminal error", async () => {
    process.stdin.isTTY = false;

    await expect(
      confirmDestructive({
        message: "Delete it?",
        force: false,
        remedy: "Pass --force to delete without confirming.",
      }),
    ).rejects.toThrow(/Pass --force to delete without confirming\./);
  });

  it("runs to completion without a terminal when --force answered it", async () => {
    process.stdin.isTTY = false;

    await expect(
      confirmDestructive({ message: "Delete it?", force: true }),
    ).resolves.toBe(true);
  });
});
