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
  projects: [
    { name: 'api', testMatch: /api\/.*\.spec\.ts$/ },
    { name: 'adapter', testMatch: /adapter\/.*\.spec\.ts$/ },
    {
      name: 'react',
      testMatch: /react\/.*\.spec\.ts$/,
      use: { ...devices['Desktop Chrome'], baseURL: REACT_URL },
    },
  ],
});
