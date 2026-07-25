import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '.',
  timeout: 30_000,
  use: { baseURL: 'http://127.0.0.1:5173' },
  webServer: [
    {
      command: 'APPSOLO_USE_TEST_DATABASE=true pnpm --filter @appsolo/api dev',
      url: 'http://127.0.0.1:4000/api/v1/health',
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'pnpm --filter @appsolo/web dev -- --host 127.0.0.1',
      url: 'http://127.0.0.1:5173',
      reuseExistingServer: !process.env.CI,
    },
  ],
});
