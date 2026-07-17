import { describe, expect, it } from "vitest";
import { extractFlag } from "./args.js";

describe("extractFlag", () => {
  it("extracts a --flag value pair and removes both from rest", () => {
    const result = extractFlag(["--name", "acme", "positional"], "name");
    expect(result).toEqual({ value: "acme", rest: ["positional"] });
  });

  it("extracts a --flag=value form", () => {
    const result = extractFlag(["--name=acme", "positional"], "name");
    expect(result).toEqual({ value: "acme", rest: ["positional"] });
  });

  it("returns undefined value when the flag is missing", () => {
    const result = extractFlag(["positional"], "name");
    expect(result).toEqual({ value: undefined, rest: ["positional"] });
  });

  it("keeps the last occurrence when the flag is repeated", () => {
    const result = extractFlag(["--name", "first", "--name", "second"], "name");
    expect(result).toEqual({ value: "second", rest: [] });
  });

  it("does not confuse a similarly prefixed flag with the target flag", () => {
    const result = extractFlag(["--nameOther", "x", "--name", "y"], "name");
    expect(result).toEqual({ value: "y", rest: ["--nameOther", "x"] });
  });

  it("returns an empty rest and undefined value for an empty args list", () => {
    const result = extractFlag([], "name");
    expect(result).toEqual({ value: undefined, rest: [] });
  });
});
