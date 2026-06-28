import { expect, test } from '../lib/fixtures';
import { registerAndVerifyEmail } from '../lib/adapterFlows';

test.describe('registration (adapter, cookies)', () => {
  test('register + verify email OTP issues a session cookie', async ({ adapterActor }) => {
    await registerAndVerifyEmail(adapterActor.ctx, adapterActor.email);

    const me = await adapterActor.ctx.get('/auth/users/me');
    expect(me.status(), 'authenticated via the registration session cookie').toBe(200);
  });
});
