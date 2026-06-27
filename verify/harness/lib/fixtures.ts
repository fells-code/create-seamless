import { test as base } from '@playwright/test';

import { Actor, newApiActor } from './client';

// Provides an auto-created, auto-disposed `actor` (one virtual user with its own
// API request context, client IP, and service token) to every test.
export const test = base.extend<{ actor: Actor }>({
  actor: async ({}, use) => {
    const actor = await newApiActor();
    await use(actor);
    await actor.dispose();
  },
});

export { expect } from '@playwright/test';
