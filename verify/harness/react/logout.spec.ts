import { expect, test } from '../lib/fixtures';
import { registerAndVerifyEmail } from '../lib/flows';
import { signInWithEmailOtp } from '../lib/reactFlows';

test.describe('logout (react, browser)', { tag: '@login' }, () => {
  test('signing out from the account menu clears the session', async ({ page, actor }) => {
    await registerAndVerifyEmail(actor.ctx, actor.email);
    await signInWithEmailOtp(page, actor.email);

    await page.getByRole('button', { name: 'Open account menu' }).click();
    await page.getByRole('button', { name: 'Logout' }).click();

    // Session cleared: authenticated home is gone and the auth form reappears.
    await expect(page.getByText('You are signed in')).toBeHidden();
    await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible();
  });
});
