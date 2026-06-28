import { expect, test } from '../lib/fixtures';
import { enterOtp, readCapturedCode } from '../lib/reactFlows';

test.describe('registration (react, browser)', () => {
  test('register with just an email -> verify email OTP -> signed in', async ({ page, actor }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Create Account' })).toBeVisible();

    await page.locator('#email').fill(actor.email);
    await page.getByRole('button', { name: 'Register', exact: true }).click();

    await expect(page.getByRole('heading', { name: 'Verify Your Email' })).toBeVisible();
    await enterOtp(page, await readCapturedCode(actor.email));
    await page.getByRole('button', { name: /Verify & Continue/ }).click();

    await expect(page.getByText('You are signed in')).toBeVisible();
  });
});
