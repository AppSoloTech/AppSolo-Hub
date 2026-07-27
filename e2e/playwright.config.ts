import { defineConfig } from '@playwright/test';
const apiPort = process.env.PLAYWRIGHT_API_PORT ?? '4000';
const webPort = process.env.PLAYWRIGHT_WEB_PORT ?? '5173';
const apiBaseUrl = `http://127.0.0.1:${apiPort}/api/v1`;
const webBaseUrl = `http://127.0.0.1:${webPort}`;

export default defineConfig({
  testDir: '.',
  timeout: 30_000,
  use: { baseURL: webBaseUrl },
  webServer: [
    {
      command: `PORT=${apiPort} CORS_ORIGIN=${webBaseUrl} WEB_ACCEPTANCE_BASE_URL=${webBaseUrl} APPSOLO_USE_TEST_DATABASE=true pnpm --filter @appsolo/api dev`,
      url: `${apiBaseUrl}/health`,
      reuseExistingServer: false,
    },
    {
      command: `VITE_API_BASE_URL=${apiBaseUrl} pnpm --filter @appsolo/web exec vite --host 127.0.0.1 --port ${webPort}`,
      url: webBaseUrl,
      reuseExistingServer: false,
    },
  ],
});
