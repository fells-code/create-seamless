import { expect, test } from '../lib/fixtures';
import {
  addVirtualAuthenticator,
  loginWithPasskey,
  registerWithPasskey,
} from '../lib/reactFlows';

test.describe('passkey login (react, browser)', { tag: '@login' }, () => {
  test('a registered passkey signs the user back in', async ({ page, context, actor }) => {
    await addVirtualAuthenticator(context, page);

    // Enroll a passkey, then sign out.
    await registerWithPasskey(page, actor.email);
    await expect(page.getByText('You are signed in')).toBeVisible();

    await page.getByRole('button', { name: 'Open account menu' }).click();
    await page.getByRole('button', { name: 'Logout' }).click();
    await expect(page.getByText('You are signed in')).toBeHidden();

    // Sign in with only the passkey (identifier -> the ceremony runs automatically).
    await loginWithPasskey(page, actor.email);
    await expect(page.getByText('You are signed in')).toBeVisible();
  });
});
