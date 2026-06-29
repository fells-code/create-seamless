import { expect, test } from '../lib/fixtures';
import { oauthLogin } from '../lib/flows';

test.describe('OAuth login (adapter, cookies)', () => {
  test('oauth callback sets a session cookie -> /users/me', async ({ adapterActor }) => {
    await oauthLogin(adapterActor.ctx, 'mock', '/auth');

    const me = await adapterActor.ctx.get('/auth/users/me');
    expect(me.status(), 'authenticated via the oauth session cookie').toBe(200);
  });
});
