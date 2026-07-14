export interface ApiResponse<T = unknown> {
  ok: boolean;
  status: number;
  data: T | null;
  headers: Headers;
}

export function joinUrl(base: string, path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${base}${path.startsWith("/") ? "" : "/"}${path}`;
}

export async function safeJson<T = unknown>(res: Response): Promise<T | null> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export async function apiRequest<T = unknown>(
  url: string,
  init: RequestInit = {},
): Promise<ApiResponse<T>> {
  const res = await fetch(url, init);
  const data = await safeJson<T>(res);
  return { ok: res.ok, status: res.status, data, headers: res.headers };
}

export function isRateLimited(res: Pick<ApiResponse, "status">): boolean {
  return res.status === 429;
}

export function jsonBody(
  method: string,
  body?: unknown,
  headers: Record<string, string> = {},
): RequestInit {
  const init: RequestInit = { method, headers: { ...headers } };
  if (body !== undefined) {
    (init.headers as Record<string, string>)["Content-Type"] =
      "application/json";
    init.body = JSON.stringify(body);
  }
  return init;
}
