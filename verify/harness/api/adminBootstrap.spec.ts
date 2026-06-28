import { expect, test } from '../lib/fixtures';
import {
  createBootstrapInvite,
  pollMagicLink,
  registerWithBootstrapToken,
  requestMagicLink,
  verifyMagicLink,
} from '../lib/flows';

test.describe('admin bootstrap (api)', () => {
  // The first-admin invite is single-use per DB (the API returns 410 once an
  // admin exists), so this relies on the fresh DB `seamless verify` provisions.
  test('invite -> register -> magic-link completion promotes the user to admin', async ({
    actor,
  }) => {
    const inviteToken = await createBootstrapInvite(actor.ctx, actor.email);
    const ephemeral = await registerWithBootstrapToken(actor.ctx, actor.email, inviteToken);

    const { token } = await requestMagicLink(actor.ctx, ephemeral);
    const verified = await verifyMagicLink(actor.ctx, token);
    expect(verified.ok(), `verify -> ${verified.status()}`).toBeTruthy();

    const completed = await pollMagicLink(actor.ctx, ephemeral);
    expect(completed.status(), 'poll after verify issues a session').toBe(200);

    const body = await completed.json();
    expect(body.token, 'session access token').toBeTruthy();
    const roles = (body.roles ?? []) as string[];
    expect(
      roles.includes('admin'),
      `bootstrap promotion grants the admin role (got ${JSON.stringify(roles)})`,
    ).toBeTruthy();
  });
});
