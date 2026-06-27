import { createHmac } from 'crypto';

function b64url(value: string): string {
  return Buffer.from(value).toString('base64url');
}

// Mint an internal service token (HS256) the API trusts for client-IP
// attribution — the same M2M mechanism the real server adapter uses.
// Claims must be iss=seamless-portal-api, aud=seamless-auth (see the API's
// authenticateServiceToken / trustedClientIp middleware).
export function mintServiceToken(secret: string, sub = 'seamless-verify'): string {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const payload = b64url(
    JSON.stringify({
      sub,
      iss: 'seamless-portal-api',
      aud: 'seamless-auth',
      iat: now,
      exp: now + 3600,
    }),
  );
  const data = `${header}.${payload}`;
  const sig = createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${sig}`;
}
