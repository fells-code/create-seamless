import { expect, test } from '../lib/fixtures';
import { loginViaMagicLink, registerAndVerifyEmail } from '../lib/adapterFlows';

test.describe('magic link login (adapter, cookies)', () => {
  test('register -> verify -> magic-link request/verify/poll -> session -> /users/me', async ({
    adapterActor,
  }) => {
    await registerAndVerifyEmail(adapterActor.ctx, adapterActor.email);
    await loginViaMagicLink(adapterActor.ctx, adapterActor.email);

    const me = await adapterActor.ctx.get('/auth/users/me');
    expect(me.status(), 'authenticated via magic-link session cookie').toBe(200);
  });
});
