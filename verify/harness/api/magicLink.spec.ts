import { expect, test } from '../lib/fixtures';
import {
  login,
  pollMagicLink,
  registerAndVerifyEmail,
  requestMagicLink,
  verifyMagicLink,
} from '../lib/flows';

test.describe('magic link (api)', () => {
  test('request -> poll(waiting) -> verify -> poll issues a session', async ({ actor }) => {
    await registerAndVerifyEmail(actor.ctx, actor.email); // user must exist + be verified
    const ephemeral = await login(actor.ctx, actor.email);

    const { token } = await requestMagicLink(actor.ctx, ephemeral);

    // Polling before the link is verified must return 204 (still waiting) — never 500.
    // This is the exact regression that created the otp-sanatization branch.
    const pending = await pollMagicLink(actor.ctx, ephemeral);
    expect(pending.status(), 'poll before verify is 204, not 500').toBe(204);

    const verified = await verifyMagicLink(actor.ctx, token);
    expect(verified.ok(), `verify -> ${verified.status()}`).toBeTruthy();

    const completed = await pollMagicLink(actor.ctx, ephemeral);
    expect(completed.status(), 'poll after verify issues a session').toBe(200);
    const body = await completed.json();
    expect(body.token, 'session access token').toBeTruthy();
    expect(body.refreshToken, 'session refresh token').toBeTruthy();
  });

  test('an invalid magic-link token is rejected', async ({ actor }) => {
    const res = await verifyMagicLink(actor.ctx, 'not-a-real-token');
    expect(res.status()).toBe(400);
  });
});
