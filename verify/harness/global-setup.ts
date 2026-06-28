import { request as playwrightRequest } from '@playwright/test';

import { ADAPTER_URL, API_URL, REACT_URL } from './lib/env';

async function waitForHealth(url: string, name: string, timeoutMs = 120_000): Promise<void> {
  const ctx = await playwrightRequest.newContext();
  const start = Date.now();
  let lastError = '';
  try {
    while (Date.now() - start < timeoutMs) {
      try {
        const res = await ctx.get(url);
        if (res.ok()) {
          // eslint-disable-next-line no-console
          console.log(`✔ ${name} healthy (${url})`);
          return;
        }
        lastError = `status ${res.status()}`;
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
  } finally {
    await ctx.dispose();
  }
  throw new Error(`✖ ${name} not healthy at ${url} within ${timeoutMs}ms (last: ${lastError})`);
}

export default async function globalSetup(): Promise<void> {
  await waitForHealth(`${API_URL}/health/status`, 'auth-api');
  if (process.env.SEAMLESS_VERIFY_ADAPTER === '1') {
    await waitForHealth(`${ADAPTER_URL}/`, 'adapter');
  }
  if (process.env.SEAMLESS_VERIFY_REACT === '1') {
    await waitForHealth(`${REACT_URL}/health`, 'react');
  }
}
