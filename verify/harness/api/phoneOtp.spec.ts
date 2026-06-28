import { expect, test } from '../lib/fixtures';
import { uniquePhone } from '../lib/env';
import { registerWithPhone, requestPhoneOtp, verifyPhoneOtp } from '../lib/flows';

test.describe('phone OTP (api)', () => {
  test('register with phone -> request OTP -> verify', async ({ actor }) => {
    const ephemeral = await registerWithPhone(actor.ctx, actor.email, uniquePhone());
    const code = await requestPhoneOtp(actor.ctx, ephemeral);
    const res = await verifyPhoneOtp(actor.ctx, ephemeral, code);
    expect(res.ok(), `verify-phone-otp -> ${res.status()}`).toBeTruthy();
  });

  test('a wrong phone OTP code is rejected with 401', async ({ actor }) => {
    const ephemeral = await registerWithPhone(actor.ctx, actor.email, uniquePhone());
    await requestPhoneOtp(actor.ctx, ephemeral); // issue a real code we deliberately won't use
    const res = await verifyPhoneOtp(actor.ctx, ephemeral, '000000');
    expect(res.status()).toBe(401);
  });
});
