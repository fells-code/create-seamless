import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { isInteractive, requireInteractive, warnOnUnusableWidth } from "./tty.js";

const ORIGINAL_TTY = process.stdin.isTTY;
const ORIGINAL_COLUMNS = process.stdout.columns;

beforeEach(() => {
  process.stdin.isTTY = true;
  process.stdout.columns = 120;
});

afterEach(() => {
  process.stdin.isTTY = ORIGINAL_TTY;
  process.stdout.columns = ORIGINAL_COLUMNS;
  vi.restoreAllMocks();
});

describe("isInteractive", () => {
  it("is true only for a TTY stdin", () => {
    expect(isInteractive()).toBe(true);
    process.stdin.isTTY = false;
    expect(isInteractive()).toBe(false);
  });
});

describe("requireInteractive", () => {
  it("allows a question when a terminal is attached", () => {
    expect(() => requireInteractive("Pick one?", "Pass --yes.")).not.toThrow();
  });

  it("names the question and the way around it when there is no terminal", () => {
    process.stdin.isTTY = false;

    expect(() => requireInteractive("Pick one?", "Pass --yes.")).toThrow(
      /"Pick one\?" needs an interactive terminal.*Pass --yes\./s,
    );
  });
});

describe("warnOnUnusableWidth", () => {
  it("says nothing at a normal width", () => {
    const warn = vi.fn();
    warnOnUnusableWidth(warn);
    expect(warn).not.toHaveBeenCalled();
  });

  // A pty allocated without a size reports one column and renders the prompts
  // one character per line, which reads as a broken CLI rather than a bad size.
  it("warns when the terminal is too narrow to render a prompt", () => {
    process.stdout.columns = 1;
    const warn = vi.fn();

    warnOnUnusableWidth(warn);

    expect(warn).toHaveBeenCalledWith(expect.stringContaining("1 columns"));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("--yes"));
  });

  it("says nothing when there is no terminal at all", () => {
    process.stdin.isTTY = false;
    process.stdout.columns = 1;
    const warn = vi.fn();

    warnOnUnusableWidth(warn);

    // requireInteractive has the actionable error for that case; a width
    // warning on top of it would only be noise.
    expect(warn).not.toHaveBeenCalled();
  });

  it("says nothing when the width is unknown", () => {
    process.stdout.columns = undefined as never;
    const warn = vi.fn();

    warnOnUnusableWidth(warn);

    expect(warn).not.toHaveBeenCalled();
  });
});
