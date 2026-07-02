import { expect, test } from '../lib/fixtures';
import { registerAndVerifyEmail } from '../lib/flows';
import { signInWithEmailOtp } from '../lib/reactFlows';

test.describe('email OTP login (react, browser)', { tag: '@login' }, () => {
  test('sign in with an email one-time code -> authenticated home', async ({ page, actor }) => {
    // Seed a verified user via the API, then sign in through the browser UI.
    await registerAndVerifyEmail(actor.ctx, actor.email);

    await signInWithEmailOtp(page, actor.email);
    await expect(page.getByText('You are signed in')).toBeVisible();
  });
});
