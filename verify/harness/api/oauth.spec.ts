import { expect, test } from '../lib/fixtures';
import { oauthLogin } from '../lib/flows';

test.describe('OAuth (api)', () => {
  test('start -> authorize -> callback issues a session', async ({ actor }) => {
    const session = await oauthLogin(actor.ctx);

    expect(session.token, 'oauth issues an access token').toBeTruthy();
    expect(session.refreshToken, 'oauth issues a refresh token').toBeTruthy();
    expect(session.sub, 'oauth resolves a user').toBeTruthy();
  });
});
