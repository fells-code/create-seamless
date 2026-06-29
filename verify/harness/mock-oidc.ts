import { createHash, randomUUID } from 'crypto';
import { createServer, IncomingMessage, Server, ServerResponse } from 'http';

// Minimal OIDC identity provider for the OAuth conformance flow. The API only uses
// the authorization code, the token exchange (PKCE), and userinfo — it does not
// validate id_token signatures — so /authorize, /token, /userinfo is all we need.

interface PendingCode {
  codeChallenge?: string;
  redirectUri: string;
  profile: { sub: string; email: string };
}

const sha256Base64Url = (value: string): string =>
  createHash('sha256').update(value).digest('base64url');

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => resolve(data));
  });
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

export function startMockOidc(port: number): Server {
  const codes = new Map<string, PendingCode>();
  const tokens = new Map<string, { sub: string; email: string }>();

  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', `http://localhost:${port}`);

    // Authorization endpoint: mint a code bound to the PKCE challenge + a fresh
    // user, then redirect back to the app's redirect_uri with code + state.
    if (req.method === 'GET' && url.pathname === '/authorize') {
      const redirectUri = url.searchParams.get('redirect_uri');
      if (!redirectUri) {
        sendJson(res, 400, { error: 'invalid_request', error_description: 'missing redirect_uri' });
        return;
      }
      const code = randomUUID();
      codes.set(code, {
        codeChallenge: url.searchParams.get('code_challenge') ?? undefined,
        redirectUri,
        profile: {
          sub: `mock-${randomUUID()}`,
          email: `oauth.${randomUUID().slice(0, 12)}@example.test`,
        },
      });
      const location = new URL(redirectUri);
      location.searchParams.set('code', code);
      location.searchParams.set('state', url.searchParams.get('state') ?? '');
      res.writeHead(302, { Location: location.toString() });
      res.end();
      return;
    }

    // Token endpoint: validate PKCE (S256), consume the code, issue an opaque token.
    if (req.method === 'POST' && url.pathname === '/token') {
      void readBody(req).then((raw) => {
        const params = new URLSearchParams(raw);
        const code = params.get('code') ?? '';
        const pending = codes.get(code);
        if (!pending) {
          sendJson(res, 400, { error: 'invalid_grant' });
          return;
        }
        codes.delete(code);
        if (
          pending.codeChallenge &&
          sha256Base64Url(params.get('code_verifier') ?? '') !== pending.codeChallenge
        ) {
          sendJson(res, 400, { error: 'invalid_grant', error_description: 'PKCE mismatch' });
          return;
        }
        const accessToken = randomUUID();
        tokens.set(accessToken, pending.profile);
        sendJson(res, 200, { access_token: accessToken, token_type: 'Bearer', expires_in: 3600 });
      });
      return;
    }

    // Userinfo endpoint: return the profile for the bearer access token.
    if (req.method === 'GET' && url.pathname === '/userinfo') {
      const token = (req.headers.authorization ?? '').replace(/^Bearer /, '');
      const profile = tokens.get(token);
      if (!profile) {
        sendJson(res, 401, { error: 'invalid_token' });
        return;
      }
      sendJson(res, 200, {
        sub: profile.sub,
        email: profile.email,
        email_verified: true,
        name: 'OAuth User',
      });
      return;
    }

    sendJson(res, 404, { error: 'not_found' });
  });

  // Bind on all interfaces so the API container can reach it via host.docker.internal;
  // unref so it never keeps the Playwright process alive after the run.
  server.listen(port, '0.0.0.0');
  server.unref();
  return server;
}
