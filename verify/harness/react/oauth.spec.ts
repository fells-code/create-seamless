import { expect, test } from '../lib/fixtures';

test.describe('OAuth login (react, browser)', () => {
  test('continue with a provider -> IdP redirect -> signed in', async ({ page }) => {
    await page.goto('/login');

    // The provider button redirects to the (mock) IdP, which redirects back to
    // /oauth/callback; the callback finishes the login and lands on the app.
    await page.getByRole('button', { name: /Continue with Mock OIDC/ }).click();

    await expect(page.getByText('You are signed in')).toBeVisible();
  });
});
