import { describe, expect, it } from "vitest";
import { generateSecret } from "./secrets.js";

describe("generateSecret", () => {
  it("generates a 32-byte hex string by default (64 hex chars)", () => {
    const secret = generateSecret();
    expect(secret).toMatch(/^[0-9a-f]{64}$/);
  });

  it("honors a custom byte length", () => {
    const secret = generateSecret(8);
    expect(secret).toMatch(/^[0-9a-f]{16}$/);
  });

  it("generates distinct values across calls", () => {
    expect(generateSecret()).not.toBe(generateSecret());
  });
});
