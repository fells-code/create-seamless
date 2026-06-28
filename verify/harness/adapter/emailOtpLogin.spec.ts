import { expect, test } from '../lib/fixtures';
import { loginViaEmailOtp, registerAndVerifyEmail } from '../lib/adapterFlows';

test.describe('email OTP login (adapter, cookies)', () => {
  test('register -> verify -> login OTP -> session cookie -> /users/me', async ({ adapterActor }) => {
    await registerAndVerifyEmail(adapterActor.ctx, adapterActor.email);
    await loginViaEmailOtp(adapterActor.ctx, adapterActor.email);

    const me = await adapterActor.ctx.get('/auth/users/me');
    expect(me.status(), 'authenticated via session cookie').toBe(200);
  });
});
