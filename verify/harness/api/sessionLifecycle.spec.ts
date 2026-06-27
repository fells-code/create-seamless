import { expect, test } from '../lib/fixtures';
import { listSessions, logout, refresh, registerAndVerifyEmail } from '../lib/flows';

test.describe('session lifecycle (api)', () => {
  test('refresh issues a new access token', async ({ actor }) => {
    const { refreshToken } = await registerAndVerifyEmail(actor.ctx, actor.email);
    const res = await refresh(actor.ctx, refreshToken);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.token, 'refresh returns a new access token').toBeTruthy();
  });

  test('sessions list shows the active session; logout revokes it', async ({ actor }) => {
    const { token } = await registerAndVerifyEmail(actor.ctx, actor.email);

    const list = await listSessions(actor.ctx, token);
    expect(list.status()).toBe(200);
    expect((await list.json()).total).toBeGreaterThanOrEqual(1);

    const out = await logout(actor.ctx, token);
    expect(out.ok(), `logout -> ${out.status()}`).toBeTruthy();

    const after = await listSessions(actor.ctx, token);
    expect(after.status(), 'access token rejected after logout').toBe(401);
  });
});
