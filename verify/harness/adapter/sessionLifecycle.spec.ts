import { expect, test } from '../lib/fixtures';
import { loginViaEmailOtp, registerAndVerifyEmail } from '../lib/adapterFlows';

test.describe('session lifecycle (adapter, cookies)', () => {
  test('logout clears the session', async ({ adapterActor }) => {
    await registerAndVerifyEmail(adapterActor.ctx, adapterActor.email);
    await loginViaEmailOtp(adapterActor.ctx, adapterActor.email);

    expect((await adapterActor.ctx.get('/auth/users/me')).status(), 'authenticated').toBe(200);

    const out = await adapterActor.ctx.delete('/auth/logout');
    expect(out.status(), 'logout returns 204').toBe(204);

    const me = await adapterActor.ctx.get('/auth/users/me');
    expect(me.status(), 'session rejected after logout').not.toBe(200);
  });
});
