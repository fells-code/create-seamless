import { afterEach, describe, expect, it, vi } from "vitest";
import {
  apiRequest,
  isRateLimited,
  joinUrl,
  jsonBody,
  safeJson,
} from "./http.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("joinUrl", () => {
  it.each([
    ["https://auth.example.com", "/whoami", "https://auth.example.com/whoami"],
    ["https://auth.example.com", "whoami", "https://auth.example.com/whoami"],
    ["https://auth.example.com/base", "/x", "https://auth.example.com/base/x"],
  ])("joins %s with %s", (base, path, expected) => {
    expect(joinUrl(base, path)).toBe(expected);
  });

  // The portal client refreshes against its own auth host while calling the control
  // plane, so an absolute path has to survive being "joined" to a different base.
  it.each([
    "https://api.seamlessauth.com/applications",
    "http://localhost:4000/applications",
    "HTTPS://Api.Example.com/x",
  ])("passes %s through untouched", (absolute) => {
    expect(joinUrl("https://auth.example.com", absolute)).toBe(absolute);
  });
});

describe("safeJson", () => {
  it("parses a JSON body", async () => {
    expect(await safeJson(new Response('{"a":1}'))).toEqual({ a: 1 });
  });

  it("returns null for an empty body", async () => {
    expect(await safeJson(new Response(""))).toBeNull();
  });

  // A 502 from a proxy commonly answers HTML. Callers branch on status, so this has
  // to be null rather than a thrown SyntaxError.
  it("returns null rather than throwing on a non-JSON body", async () => {
    expect(await safeJson(new Response("<html>502</html>"))).toBeNull();
  });

  it("parses a non-object JSON body", async () => {
    expect(await safeJson(new Response('"just a string"'))).toBe("just a string");
  });
});

describe("apiRequest", () => {
  it("reports ok, status, data, and headers", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response('{"message":"ok"}', {
            status: 200,
            headers: { "content-type": "application/json", "x-trace": "abc" },
          }),
      ),
    );

    const res = await apiRequest<{ message: string }>("https://x.example.com/y");

    expect(res.ok).toBe(true);
    expect(res.status).toBe(200);
    expect(res.data).toEqual({ message: "ok" });
    expect(res.headers.get("x-trace")).toBe("abc");
  });

  it("reports a failure status with a null body rather than throwing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 500 })),
    );

    const res = await apiRequest("https://x.example.com/y");

    expect(res.ok).toBe(false);
    expect(res.status).toBe(500);
    expect(res.data).toBeNull();
  });

  it("passes the init through to fetch", async () => {
    const fetchMock = vi.fn(async () => new Response("{}"));
    vi.stubGlobal("fetch", fetchMock);

    const init = jsonBody("POST", { name: "x" });
    await apiRequest("https://x.example.com/y", init);

    expect(fetchMock).toHaveBeenCalledWith("https://x.example.com/y", init);
  });

  // fetch rejects on a connection failure rather than resolving. Callers catch that
  // themselves to name the unreachable host, so it must not be swallowed here.
  it("lets a network rejection propagate", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      }),
    );

    await expect(apiRequest("https://x.example.com/y")).rejects.toThrow(
      /fetch failed/,
    );
  });
});

describe("isRateLimited", () => {
  it.each([
    [429, true],
    [200, false],
    [403, false],
    [503, false],
  ])("reports %i as %s", (status, expected) => {
    expect(isRateLimited({ status })).toBe(expected);
  });
});

describe("jsonBody", () => {
  it("sets the content type and serializes the body", () => {
    const init = jsonBody("POST", { a: 1 });
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ "Content-Type": "application/json" });
    expect(init.body).toBe('{"a":1}');
  });

  it("omits the body and content type when there is no body", () => {
    const init = jsonBody("GET");
    expect(init.body).toBeUndefined();
    expect(init.headers).toEqual({});
  });

  it("keeps caller headers alongside the content type", () => {
    const init = jsonBody("POST", { a: 1 }, { Authorization: "Bearer t" });
    expect(init.headers).toEqual({
      Authorization: "Bearer t",
      "Content-Type": "application/json",
    });
  });

  // The caller's object must not gain a Content-Type as a side effect, since the
  // same headers object is reused across the retry in authClient.
  it("does not mutate the headers it was given", () => {
    const headers = { Authorization: "Bearer t" };
    jsonBody("POST", { a: 1 }, headers);
    expect(headers).toEqual({ Authorization: "Bearer t" });
  });

  it("serializes an explicit null body", () => {
    expect(jsonBody("POST", null).body).toBe("null");
  });
});
