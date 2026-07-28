import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@clack/prompts", () => {
  const CANCEL = Symbol("cancel");
  return {
    CANCEL,
    select: vi.fn(),
    confirm: vi.fn(),
    isCancel: (value: unknown) => value === CANCEL,
  };
});

import { CANCEL, confirm, select } from "@clack/prompts";
import { CancelledError } from "../core/cancel.js";
import {
  chooseExistingDirectoryAction,
  chooseScaffoldTarget,
  confirmLocalFallback,
} from "./initMode.js";

interface PromptArgs {
  message: string;
  options?: Array<{ value: string; label: string; hint?: string }>;
  initialValue?: unknown;
}

function lastCall(mock: { mock: { calls: unknown[][] } }): PromptArgs {
  return mock.mock.calls[mock.mock.calls.length - 1][0] as PromptArgs;
}

beforeEach(() => {
  vi.mocked(select).mockReset();
  vi.mocked(confirm).mockReset();
});

describe("chooseExistingDirectoryAction", () => {
  it("offers integrate and scaffold when there is something to connect", async () => {
    vi.mocked(select).mockResolvedValue("integrate" as never);

    await expect(chooseExistingDirectoryAction(true)).resolves.toBe("integrate");

    const args = lastCall(vi.mocked(select));
    expect(args.options?.map((o) => o.value)).toEqual(["integrate", "scaffold"]);
    // Scaffolding copies starter files over whatever is already there, so the
    // consequence has to be on screen before the choice is made.
    expect(args.options?.[1].hint).toMatch(/overwrite/);
    expect(confirm).not.toHaveBeenCalled();
  });

  // Picking "scaffold here" off a list is not consent to write over existing
  // files; the hint on the option is easy to skim past.
  it("confirms the overwrite after the scaffold choice is picked", async () => {
    vi.mocked(select).mockResolvedValue("scaffold" as never);
    vi.mocked(confirm).mockResolvedValue(true as never);

    await expect(chooseExistingDirectoryAction(true)).resolves.toBe("scaffold");

    expect(confirm).toHaveBeenCalledTimes(1);
    const args = lastCall(vi.mocked(confirm));
    expect(args.message).toMatch(/overwrite/);
    expect(args.initialValue).toBe(false);
  });

  it("cancels when the overwrite confirmation after the list is declined", async () => {
    vi.mocked(select).mockResolvedValue("scaffold" as never);
    vi.mocked(confirm).mockResolvedValue(false as never);

    await expect(chooseExistingDirectoryAction(true)).rejects.toBeInstanceOf(
      CancelledError,
    );
  });

  it("does not confirm anything when integrating", async () => {
    vi.mocked(select).mockResolvedValue("integrate" as never);

    await expect(chooseExistingDirectoryAction(true)).resolves.toBe("integrate");

    expect(confirm).not.toHaveBeenCalled();
  });

  it("asks for confirmation instead when integrating is not possible", async () => {
    vi.mocked(confirm).mockResolvedValue(true as never);

    await expect(chooseExistingDirectoryAction(false)).resolves.toBe("scaffold");

    expect(select).not.toHaveBeenCalled();
    const args = lastCall(vi.mocked(confirm));
    expect(args.message).toMatch(/not empty/);
    expect(args.message).toMatch(/overwrite/);
    // Writing over a directory that already has files is not the safe default.
    expect(args.initialValue).toBe(false);
  });

  it("cancels when the confirmation is declined", async () => {
    vi.mocked(confirm).mockResolvedValue(false as never);

    await expect(chooseExistingDirectoryAction(false)).rejects.toBeInstanceOf(
      CancelledError,
    );
  });

  it("cancels when either prompt is interrupted", async () => {
    vi.mocked(select).mockResolvedValue(CANCEL as never);
    await expect(chooseExistingDirectoryAction(true)).rejects.toBeInstanceOf(
      CancelledError,
    );

    vi.mocked(confirm).mockResolvedValue(CANCEL as never);
    await expect(chooseExistingDirectoryAction(false)).rejects.toBeInstanceOf(
      CancelledError,
    );
  });
});

describe("chooseScaffoldTarget", () => {
  it("leads with managed and reports how many applications are available", async () => {
    vi.mocked(select).mockResolvedValue("managed" as never);

    await expect(chooseScaffoldTarget(3)).resolves.toBe("managed");

    const args = lastCall(vi.mocked(select));
    expect(args.initialValue).toBe("managed");
    expect(args.options?.[0].hint).toContain("3");
    expect(args.options?.map((o) => o.value)).toEqual(["managed", "local"]);
  });

  it("returns the local choice", async () => {
    vi.mocked(select).mockResolvedValue("local" as never);
    await expect(chooseScaffoldTarget(1)).resolves.toBe("local");
  });

  it("cancels when interrupted", async () => {
    vi.mocked(select).mockResolvedValue(CANCEL as never);
    await expect(chooseScaffoldTarget(1)).rejects.toBeInstanceOf(CancelledError);
  });
});

describe("confirmLocalFallback", () => {
  it("resolves when the developer accepts the local stack", async () => {
    vi.mocked(confirm).mockResolvedValue(true as never);

    await expect(confirmLocalFallback()).resolves.toBeUndefined();

    expect(lastCall(vi.mocked(confirm)).initialValue).toBe(true);
  });

  it("cancels rather than scaffolding a stack the developer did not want", async () => {
    vi.mocked(confirm).mockResolvedValue(false as never);
    await expect(confirmLocalFallback()).rejects.toBeInstanceOf(CancelledError);
  });

  it("cancels when interrupted", async () => {
    vi.mocked(confirm).mockResolvedValue(CANCEL as never);
    await expect(confirmLocalFallback()).rejects.toBeInstanceOf(CancelledError);
  });
});
