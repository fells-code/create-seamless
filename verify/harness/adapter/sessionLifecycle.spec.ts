import { expect, test } from '../lib/fixtures';
import { loginViaMagicLink, registerAndVerifyEmail } from '../lib/adapterFlows';

test.describe('session lifecycle (adapter, cookies)', () => {
  test('logout clears the session', async ({ adapterActor }) => {
    // Establish the session via magic-link login: it sets the session cookie and
    // uses the magic-link rate limiter, keeping this spec off the OTP limiter so
    // the adapter project's aggregate OTP traffic stays under the per-IP cap.
    await registerAndVerifyEmail(adapterActor.ctx, adapterActor.email);
    await loginViaMagicLink(adapterActor.ctx, adapterActor.email);

    expect((await adapterActor.ctx.get('/auth/users/me')).status(), 'authenticated').toBe(200);

    const out = await adapterActor.ctx.delete('/auth/logout');
    expect(out.status(), 'logout returns 204').toBe(204);

    const me = await adapterActor.ctx.get('/auth/users/me');
    expect(me.status(), 'session rejected after logout').not.toBe(200);
  });
});
