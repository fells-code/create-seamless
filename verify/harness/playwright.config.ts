import { defineConfig } from '@playwright/test';

// One runner, multiple projects. `api` and `adapter` hit HTTP directly (no
// browser); `react` (added in M2) drives chromium. global-setup health-gates
// the stack before any project runs.
export default defineConfig({
  testDir: '.',
  globalSetup: './global-setup.ts',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [
    ['list'],
    ['junit', { outputFile: 'results/junit.xml' }],
    ['html', { outputFolder: 'results/html', open: 'never' }],
  ],
  projects: [
    { name: 'api', testMatch: /api\/.*\.spec\.ts$/ },
    { name: 'adapter', testMatch: /adapter\/.*\.spec\.ts$/ },
  ],
});
