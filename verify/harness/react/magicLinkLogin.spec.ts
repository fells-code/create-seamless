import { expect, test } from '../lib/fixtures';
import { registerAndVerifyEmail } from '../lib/flows';
import { gotoSignIn, readCapturedCode } from '../lib/reactFlows';

test.describe('magic link login (react, browser)', { tag: '@login' }, () => {
  test('request a magic link, open it in a second tab -> original tab authenticates', async ({
    page,
    context,
    actor,
  }) => {
    await registerAndVerifyEmail(actor.ctx, actor.email);

    await gotoSignIn(page);
    await page.locator('#identifier').fill(actor.email);
    await page.getByRole('button', { name: 'Login', exact: true }).click();

    await page.getByRole('button', { name: /Email Magic Link/ }).click();
    await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();

    // "Click" the emailed link in a second tab; the original tab completes via
    // BroadcastChannel + polling (same device binding — same browser/adapter).
    const token = await readCapturedCode(actor.email);
    const linkTab = await context.newPage();
    await linkTab.goto(`/verify-magiclink?token=${encodeURIComponent(token)}`);

    await expect(page.getByText('You are signed in')).toBeVisible({ timeout: 15_000 });
    await linkTab.close();
  });
});
