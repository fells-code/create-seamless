import { describe, expect, it } from "vitest";
import { errorMessage } from "./errors.js";

describe("errorMessage", () => {
  it("uses an Error's message", () => {
    expect(errorMessage(new Error("boom"))).toBe("boom");
  });

  it("falls back to the name when an Error carries no message", () => {
    expect(errorMessage(new TypeError())).toBe("TypeError");
  });

  it("returns a thrown string as it is", () => {
    expect(errorMessage("just a string")).toBe("just a string");
  });

  it("reads a message field off a thrown object", () => {
    expect(errorMessage({ message: "from an object" })).toBe("from an object");
  });

  // "[object Object]" says even less than the shape does. A system error would not
  // reach this branch, since those are Error instances; a parsed response body does.
  it("shows the shape of an object with no message", () => {
    expect(errorMessage({ status: 502, upstream: "auth" })).toBe(
      '{"status":502,"upstream":"auth"}',
    );
  });

  // A thrown object reaches here from a rejected request as often as from our code.
  it("scrubs tokens out of a thrown object", () => {
    const rendered = errorMessage({ code: "EAUTH", refreshToken: "rt_live_secret" });
    expect(rendered).not.toContain("rt_live_secret");
    expect(rendered).toContain("[redacted]");
  });

  it("survives a circular object", () => {
    const circular: Record<string, unknown> = { code: "E" };
    circular.self = circular;
    expect(() => errorMessage(circular)).not.toThrow();
  });

  // The case that printed "Error: undefined".
  it.each([
    [undefined, "Unexpected error: undefined"],
    [null, "Unexpected error: null"],
    [42, "Unexpected error: 42"],
    [false, "Unexpected error: false"],
  ])("names %s as unexpected rather than printing nothing", (thrown, expected) => {
    expect(errorMessage(thrown)).toBe(expected);
  });
});
