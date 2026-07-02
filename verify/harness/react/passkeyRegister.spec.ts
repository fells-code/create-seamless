import { expect, test } from '../lib/fixtures';
import { addVirtualAuthenticator, registerWithPasskey } from '../lib/reactFlows';

test.describe('passkey registration (react, browser)', { tag: '@login' }, () => {
  test('register, then enroll a passkey via a virtual authenticator -> signed in', async ({
    page,
    context,
    actor,
  }) => {
    await addVirtualAuthenticator(context, page);

    await registerWithPasskey(page, actor.email);
    await expect(page.getByText('You are signed in')).toBeVisible();
  });
});
