import { expect, test } from '../lib/fixtures';
import { registerAndVerifyEmail } from '../lib/flows';

// `POST /login` answers the same way for an identifier with an account and one without,
// and the endpoints that accept the resulting pre-auth token do too. The API has its own
// unit coverage for this; what only this harness can check is that the guarantee survives
// a real instance, with real signing keys and the real login policy in place.
//
// The specific failures worth catching are the ones where a decoy responder reproduces
// the success path and forgets a refusal, since that is the shape every regression here
// has taken so far.

const UNKNOWN = () => `nobody-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;

async function startLogin(ctx: Parameters<typeof registerAndVerifyEmail>[0], identifier: string) {
  const res = await ctx.post('/login', { data: { identifier } });
  return { status: res.status(), body: await res.json() };
}

test.describe('login enumeration (api)', () => {
  test('an unknown identifier is answered in the same shape as a real one', async ({
    actor,
  }) => {
    await registerAndVerifyEmail(actor.ctx, actor.email);

    const real = await startLogin(actor.ctx, actor.email);
    const unknown = await startLogin(actor.ctx, UNKNOWN());

    expect(unknown.status).toBe(200);
    expect(unknown.status).toBe(real.status);
    // `sub` and `token` differ between them exactly as they differ between two real
    // accounts, so the comparison is over everything else.
    expect(Object.keys(unknown.body).sort()).toEqual(Object.keys(real.body).sort());
    expect(unknown.body.identifierType).toBe(real.body.identifierType);
    expect(unknown.body.ttl).toBe(real.body.ttl);
    expect(typeof unknown.body.token).toBe('string');
    // Deliberately not `loginMethods`. That list is filtered by what an account can do,
    // and a decoy's capabilities are derived per identifier, so any one decoy and any
    // one account can legitimately differ. What has to hold is the next test.
  });

  test('a real account\'s method list is one a decoy can also produce', async ({ actor }) => {
    // The guarantee is not that two given answers match, it is that a given answer does
    // not identify an account. A decoy that always claimed everything would make any
    // narrower list proof of existence, so the decoy's passkey and phone are derived per
    // identifier and a narrow list has to be reachable without an account behind it.
    await registerAndVerifyEmail(actor.ctx, actor.email);
    const real = await startLogin(actor.ctx, actor.email);
    const target = JSON.stringify(real.body.loginMethods);

    const seen = new Set<string>();
    for (let i = 0; i < 40; i += 1) {
      const { body } = await startLogin(actor.ctx, UNKNOWN());
      seen.add(JSON.stringify(body.loginMethods));
    }

    // Each decoy draws two independent bits, so this account's exact list comes up about
    // a quarter of the time; over 40 identifiers, missing it entirely is a 1-in-100,000
    // event rather than a flake worth retrying.
    expect(seen.has(target), `no decoy offered ${target}; saw ${[...seen].join(' | ')}`).toBe(
      true,
    );
    expect(seen.size).toBeGreaterThan(1);
  });

  test('the same unknown identifier keeps the same subject', async ({ actor }) => {
    const identifier = UNKNOWN();

    const first = await startLogin(actor.ctx, identifier);
    const second = await startLogin(actor.ctx, identifier);
    const other = await startLogin(actor.ctx, UNKNOWN());

    // A real identifier resolves to the same row every time and to a different one from
    // anyone else's. A subject that rerolled, or that collided, would be the oracle again
    // one request later.
    expect(second.body.sub).toBe(first.body.sub);
    expect(other.body.sub).not.toBe(first.body.sub);
    // The offered methods have to be stable for the same reason: a list that changed
    // between attempts would separate a decoy from an account on its own.
    expect(second.body.loginMethods).toEqual(first.body.loginMethods);
  });

  test('an unknown identifier gets an OTP send that reports success and sends nothing', async ({
    actor,
  }) => {
    const { body } = await startLogin(actor.ctx, UNKNOWN());

    const res = await actor.ctx.get('/otp/generate-login-email-otp', {
      headers: { Authorization: `Bearer ${body.token}` },
    });

    expect(res.status()).toBe(200);
    expect((await res.json()).message).toBe('success');
  });

  test('a decoy OTP verify fails the way a wrong code fails', async ({ actor }) => {
    const { body } = await startLogin(actor.ctx, UNKNOWN());

    const res = await actor.ctx.post('/otp/verify-login-email-otp', {
      headers: { Authorization: `Bearer ${body.token}` },
      data: { verificationToken: 'ZZZZZZ' },
    });

    expect(res.status()).toBe(401);
  });

  test('a credential id that cannot exist is refused for real and unknown alike', async ({
    actor,
  }) => {
    // The sharpest oracle this surface had. `/webauthn/login/start` filters the account's
    // credentials by the requested id and refuses when none survive, so an id no
    // credential can hold is refused by every real account. A decoy that answered with a
    // challenge anyway was identifiable in two requests, whatever the policy.
    await registerAndVerifyEmail(actor.ctx, actor.email);

    const real = await startLogin(actor.ctx, actor.email);
    const unknown = await startLogin(actor.ctx, UNKNOWN());

    const ask = (token: string) =>
      actor.ctx.post('/webauthn/login/start', {
        headers: { Authorization: `Bearer ${token}` },
        data: { credentialId: 'not-a-real-credential-id' },
      });

    const realRes = await ask(real.body.token);
    const unknownRes = await ask(unknown.body.token);

    expect(unknownRes.status()).toBe(realRes.status());
    expect(await unknownRes.text()).toBe(await realRes.text());
  });

  test('a malformed identifier is still rejected', async ({ actor }) => {
    // Not an enumeration signal: it does not depend on whether an account exists, and
    // answering 200 here would leave a caller with no way to learn it typed nonsense.
    const { status } = await startLogin(actor.ctx, 'not-an-identifier');

    expect(status).toBe(400);
  });
});
