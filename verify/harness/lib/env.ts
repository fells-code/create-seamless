// Shared config + helpers for the conformance harness.

export const API_URL = process.env.SEAMLESS_API_URL ?? 'http://localhost:5312';
export const ADAPTER_URL = process.env.SEAMLESS_ADAPTER_URL ?? 'http://localhost:3000';
export const REACT_URL = process.env.SEAMLESS_REACT_URL ?? 'http://localhost:5173';

// Must match the API's API_SERVICE_TOKEN so the harness can mint M2M tokens.
export const API_SERVICE_TOKEN =
  process.env.SEAMLESS_API_SERVICE_TOKEN ?? 'verify-dev-service-token';

// Must match the API's SEAMLESS_BOOTSTRAP_SECRET so the harness can mint the
// first admin invite (bootstrap-promotion flow).
export const BOOTSTRAP_SECRET =
  process.env.SEAMLESS_BOOTSTRAP_SECRET ?? 'verify-dev-bootstrap-secret';

// Non-production seam: makes the API return OTP / magic-link tokens in the
// response `delivery` object instead of sending real email/SMS.
export const EXTERNAL_DELIVERY = {
  'x-seamless-auth-delivery-mode': 'external',
} as const;

const runId = process.env.SEAMLESS_RUN_ID ?? String(Date.now());

let emailCounter = 0;
export function uniqueEmail(prefix = 'verify'): string {
  emailCounter += 1;
  return `${prefix}.${runId}.${emailCounter}@example.test`;
}

// Distinct client IP per actor so the API's per-IP rate limiters see separate
// buckets (honored only alongside a valid service token — see client.ts).
let ipCounter = 0;
export function uniqueClientIp(): string {
  ipCounter += 1;
  const n = ipCounter;
  return `10.${(n >> 16) & 255}.${(n >> 8) & 255}.${n & 255}`;
}

// Valid-format US numbers, seeded by runId so they don't collide across runs.
const phoneSeed = Number(runId) || 1_000_000;
let phoneCounter = 0;
export function uniquePhone(): string {
  phoneCounter += 1;
  const subscriber = 2_000_000 + ((phoneSeed + phoneCounter) % 7_000_000);
  return `+1415${subscriber}`;
}
