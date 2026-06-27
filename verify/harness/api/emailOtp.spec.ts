import { expect, test } from '../lib/fixtures';
import { registerAndVerifyEmail, registerEmail, requestEmailOtp, verifyEmailOtp } from '../lib/flows';

test.describe('email OTP (api)', () => {
  test('register -> request OTP -> verify -> session issued', async ({ actor }) => {
    const session = await registerAndVerifyEmail(actor.ctx, actor.email);
    expect(session.token).toBeTruthy();
    expect(session.refreshToken).toBeTruthy();
  });

  test('a wrong OTP code is rejected with 401', async ({ actor }) => {
    const ephemeral = await registerEmail(actor.ctx, actor.email);
    await requestEmailOtp(actor.ctx, ephemeral); // issue a real code we deliberately won't use
    const res = await verifyEmailOtp(actor.ctx, ephemeral, 'ZZZZZZ');
    expect(res.status()).toBe(401);
  });
});
