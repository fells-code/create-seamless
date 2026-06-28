import { expect, test } from '../lib/fixtures';

test.describe('JWKS (api)', () => {
  test('publishes the active signing key as a JWK', async ({ actor }) => {
    const res = await actor.ctx.get('/.well-known/jwks.json');
    expect(res.status(), 'JWKS endpoint is available').toBe(200);

    const body = await res.json();
    expect(Array.isArray(body.keys), 'has a keys array').toBeTruthy();

    const key = body.keys.find((k: { kid?: string }) => k.kid === 'dev-main');
    expect(key, 'publishes the dev-main signing key').toBeTruthy();
    expect(key.kty).toBe('RSA');
    expect(key.use).toBe('sig');
    expect(key.alg).toBe('RS256');
  });
});
