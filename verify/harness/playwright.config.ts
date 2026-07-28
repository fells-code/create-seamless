import { defineConfig, devices } from '@playwright/test';

import { REACT_URL } from './lib/env';

// One runner, multiple projects. `api` and `adapter` hit HTTP directly (no
// browser); `react` drives chromium against the starter SPA. global-setup
// health-gates the stack before any project runs.
export default defineConfig({
  testDir: '.',
  globalSetup: './global-setup.ts',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [
    ['list'],
    ['./lib/matrixReporter.ts'],
    ['junit', { outputFile: 'results/junit.xml' }],
    ['html', { outputFolder: 'results/html', open: 'never' }],
  ],
  // Each project scopes itself with testDir, not testMatch. A testMatch regex is
  // applied to the absolute path, so `/api\/.*\.spec\.ts$/` also matched every
  // adapter and react spec whenever the checkout lived under a directory
  // containing "api/" (the seamless-auth-api conformance run does exactly that),
  // pulling browser specs into a project with no baseURL.
  projects: [
    { name: 'api', testDir: './api' },
    { name: 'adapter', testDir: './adapter' },
    {
      name: 'react',
      testDir: './react',
      use: { ...devices['Desktop Chrome'], baseURL: REACT_URL },
    },
  ],
});
