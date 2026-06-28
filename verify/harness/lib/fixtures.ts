import { test as base } from '@playwright/test';

import { Actor, newAdapterActor, newApiActor } from './client';

// `actor` drives the API directly (Bearer + service token); `adapterActor` drives
// the adopter backend over cookies. Both are auto-created and disposed per test.
export const test = base.extend<{ actor: Actor; adapterActor: Actor }>({
  actor: async ({}, use) => {
    const actor = await newApiActor();
    await use(actor);
    await actor.dispose();
  },
  adapterActor: async ({}, use) => {
    const actor = await newAdapterActor();
    await use(actor);
    await actor.dispose();
  },
});

export { expect } from '@playwright/test';
