import { expect, test } from '../lib/fixtures';
import { registerAndVerifyEmail } from '../lib/flows';

test.describe('organizations (api)', () => {
  test('create -> list -> switch active', async ({ actor }) => {
    const { token } = await registerAndVerifyEmail(actor.ctx, actor.email);
    const auth = { Authorization: `Bearer ${token}` };

    const created = await actor.ctx.post('/organizations', {
      headers: auth,
      data: { name: 'Acme Inc' },
    });
    expect(created.ok(), `create org -> ${created.status()}`).toBeTruthy();
    const orgId = (await created.json()).organization.id;
    expect(orgId, 'create returns an organization id').toBeTruthy();

    const list = await actor.ctx.get('/organizations', { headers: auth });
    expect(list.ok()).toBeTruthy();
    const orgs = (await list.json()).organizations as Array<{ id: string }>;
    expect(orgs.some((o) => o.id === orgId), 'created org appears in the list').toBeTruthy();

    const switched = await actor.ctx.post(`/organizations/${orgId}/switch`, {
      headers: auth,
      data: {},
    });
    expect(switched.ok(), `switch org -> ${switched.status()}`).toBeTruthy();
  });
});
