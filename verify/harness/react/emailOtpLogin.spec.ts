import { expect, test } from '../lib/fixtures';
import { registerAndVerifyEmail } from '../lib/flows';
import { enterOtp, gotoSignIn, readCapturedCode } from '../lib/reactFlows';

test.describe('email OTP login (react, browser)', () => {
  test('sign in with an email one-time code -> authenticated home', async ({ page, actor }) => {
    // Seed a verified user via the API, then sign in through the browser UI.
    await registerAndVerifyEmail(actor.ctx, actor.email);

    await gotoSignIn(page);
    await page.locator('#identifier').fill(actor.email);
    await page.getByRole('button', { name: 'Login', exact: true }).click();

    await page.getByRole('button', { name: /Email Code/ }).click();
    await expect(page.getByRole('heading', { name: 'Verify Your Email' })).toBeVisible();

    const code = await readCapturedCode(actor.email);
    await enterOtp(page, code);
    await page.getByRole('button', { name: /Verify & Continue/ }).click();

    await expect(page.getByText('You are signed in')).toBeVisible();
  });
});
