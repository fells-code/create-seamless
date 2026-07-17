import { afterEach, describe, expect, it, vi } from "vitest";
import { SEAMLESS_AUTH_API_VERSION } from "./images.js";
import { fetchEnvExample } from "./fetch.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchEnvExample", () => {
  it("fetches the pinned env.example from the auth API repo", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      text: async () => "FOO=bar\n",
    }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchEnvExample();

    expect(result).toBe("FOO=bar\n");
    expect(fetchMock).toHaveBeenCalledWith(
      `https://raw.githubusercontent.com/fells-code/seamless-auth-api/${SEAMLESS_AUTH_API_VERSION}/.env.example`,
    );
  });

  it("throws when the response is not ok", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, text: async () => "" })),
    );

    await expect(fetchEnvExample()).rejects.toThrow(
      "Failed to fetch auth env.example",
    );
  });

  it("propagates a network failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );

    await expect(fetchEnvExample()).rejects.toThrow("network down");
  });
});
