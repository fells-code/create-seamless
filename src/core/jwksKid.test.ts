import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchActiveJwksKid } from "./jwksKid.js";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchActiveJwksKid", () => {
  it("reads the kid from the instance's JWKS", async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        calls.push(url);
        return json({ keys: [{ kid: "paidkey1", alg: "RS256", use: "sig" }] });
      }),
    );

    expect(await fetchActiveJwksKid("https://auth.example.com")).toBe("paidkey1");
    expect(calls).toEqual([
      "https://auth.example.com/.well-known/jwks.json",
    ]);
  });

  // A set carrying a retired key alongside the active one lists the active first.
  it("takes the first signing key when several are published", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        json({
          keys: [
            { kid: "trialkey1", alg: "RS256", use: "sig" },
            { kid: "oldkey", alg: "RS256", use: "sig" },
          ],
        }),
      ),
    );

    expect(await fetchActiveJwksKid("https://auth.example.com")).toBe("trialkey1");
  });

  it("skips a key that is not for signing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        json({
          keys: [
            { kid: "enckey", alg: "RSA-OAEP", use: "enc" },
            { kid: "signing", alg: "RS256", use: "sig" },
          ],
        }),
      ),
    );

    expect(await fetchActiveJwksKid("https://auth.example.com")).toBe("signing");
  });

  it("accepts a key that omits the optional use and alg hints", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ keys: [{ kid: "bare" }] })));
    expect(await fetchActiveJwksKid("https://auth.example.com")).toBe("bare");
  });

  // The kid is cosmetic today, so an instance that is slow to come up must not
  // fail the scaffold over it.
  it.each([
    ["a non-ok response", () => json({ error: "nope" }, 503)],
    ["a body with no keys", () => json({})],
    ["an empty key set", () => json({ keys: [] })],
    ["keys that is not an array", () => json({ keys: "nope" })],
    ["keys with no usable kid", () => json({ keys: [{ alg: "RS256" }, null, 42] })],
    ["a non-JSON body", () => new Response("<html>502</html>", { status: 200 })],
  ])("returns undefined for %s", async (_label, responder) => {
    vi.stubGlobal("fetch", vi.fn(async () => responder()));
    expect(await fetchActiveJwksKid("https://auth.example.com")).toBeUndefined();
  });

  it("returns undefined when the instance is unreachable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      }),
    );

    expect(await fetchActiveJwksKid("https://auth.example.com")).toBeUndefined();
  });
});
