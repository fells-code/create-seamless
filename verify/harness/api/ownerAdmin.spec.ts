import { OWNER_EMAIL } from '../lib/env';
import { expect, test } from '../lib/fixtures';
import { registerEmail, requestEmailOtp, verifyEmailOtp } from '../lib/flows';

test.describe('owner admin (api)', () => {
  // The owner address is fixed in the stack's OWNER_EMAIL before boot, so this
  // spec registers that exact email rather than the actor fixture's random one.
  test('registering the owner email grants the admin role at signup', async ({ actor }) => {
    const ephemeral = await registerEmail(actor.ctx, OWNER_EMAIL);
    const code = await requestEmailOtp(actor.ctx, ephemeral);

    const res = await verifyEmailOtp(actor.ctx, ephemeral, code);
    expect(res.ok(), `verify-email-otp -> ${res.status()} ${await res.text()}`).toBeTruthy();

    const body = await res.json();
    expect(body.token, 'session access token').toBeTruthy();

    const roles = (body.roles ?? []) as string[];
    expect(
      roles.includes('admin'),
      `owner signup grants the admin role (got ${JSON.stringify(roles)})`,
    ).toBeTruthy();
  });
});
