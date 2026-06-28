import { expect, test } from '../lib/fixtures';
import { registerAndVerifyEmail } from '../lib/flows';
import { totp } from '../lib/totp';

test.describe('TOTP (api)', () => {
  test('enroll -> verify enrollment with a computed code -> status enabled', async ({ actor }) => {
    const { token } = await registerAndVerifyEmail(actor.ctx, actor.email);
    const auth = { Authorization: `Bearer ${token}` };

    const start = await actor.ctx.post('/totp/enroll/start', { headers: auth, data: {} });
    expect(start.ok(), `enroll/start -> ${start.status()}`).toBeTruthy();
    const { secret } = await start.json();
    expect(secret, 'enroll/start returns a base32 secret').toBeTruthy();

    const verify = await actor.ctx.post('/totp/enroll/verify', {
      headers: auth,
      data: { code: totp(secret) },
    });
    expect(verify.ok(), `enroll/verify -> ${verify.status()}`).toBeTruthy();

    const status = await actor.ctx.get('/totp/status', { headers: auth });
    expect((await status.json()).enabled, 'TOTP is enabled after enrollment').toBe(true);
  });
});
