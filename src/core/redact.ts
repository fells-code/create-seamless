/**
 * Masking for anything the CLI is about to print. Every caller is a log path, not
 * a credential path: these helpers never touch what is stored or sent, only what
 * is shown, so over-masking costs legibility rather than correctness.
 *
 * Deliberately not applied to `--json` output. That is a machine-readable contract
 * meant to be piped into `jq`, and rewriting values there would break scripts and
 * hide data the caller explicitly asked for.
 */

export function redactToken(value?: string | null): string {
  return value ? "[redacted]" : "(none)";
}

const REDACTED = "[redacted]";

// Matched against the lowercased key with separators stripped, so `clientSecret`,
// `client_secret`, and `CLIENT-SECRET` are one entry rather than three.
const SECRET_KEYS = new Set([
  "token",
  "accesstoken",
  "refreshtoken",
  "verificationtoken",
  "authorization",
  "secret",
  "clientsecret",
  "password",
  "apikey",
  "otp",
  "code",
]);

// A JWT: three dot-separated base64url runs, the first opening `eyJ` because every
// JOSE header starts `{"`. Long enough a run that ordinary prose cannot trip it.
const JWT = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+/g;

const BEARER = /\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gi;

function isSecretKey(key: string): boolean {
  return SECRET_KEYS.has(key.toLowerCase().replace(/[-_\s]/g, ""));
}

/**
 * Masks secrets in a value about to be logged, by key name and by shape.
 *
 * Key matching alone is not enough: a server's validation error commonly quotes the
 * offending value back inside a message string, where it has no key of its own. So
 * strings are scanned for JWT and `Bearer ...` shapes wherever they appear,
 * including a bare string body.
 */
export function scrubTokens<T>(value: T): T {
  return scrub(value, false) as T;
}

function scrub(value: unknown, keyed: boolean): unknown {
  if (typeof value === "string") {
    return keyed ? redactToken(value) : scrubString(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => scrub(item, keyed));
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      out[key] = scrub(val, keyed || isSecretKey(key));
    }
    return out;
  }
  // A secret-keyed non-string still reveals nothing useful once masked, and leaving
  // it would let `{ token: 123 }` through.
  return keyed && value !== null && value !== undefined ? REDACTED : value;
}

function scrubString(value: string): string {
  return value.replace(JWT, REDACTED).replace(BEARER, `Bearer ${REDACTED}`);
}
