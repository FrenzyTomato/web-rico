import { defineConfig } from '@playwright/test';

// CI installs Playwright's pinned Chromium; local runs use system Chrome.
// One worker: games share one server's seed hook.
export default defineConfig({
  testDir: 'e2e',
  workers: 1,
  timeout: 300_000,
  // Traces are kept for failing tests, so an intermittent failure can be diagnosed (no retries: flakes stay visible).
  use: { actionTimeout: 15_000, navigationTimeout: 30_000, baseURL: 'http://127.0.0.1:5173', ...(process.env.CI ? {} : { channel: 'chrome' }), trace: 'retain-on-failure' },
  webServer: [
    { command: 'node e2e/server.mjs', url: 'http://127.0.0.1:3000/health', reuseExistingServer: false },
    { env: { VITE_ROOM_CREATION_PASSWORD: 'e2e-room-password' }, command: 'vite --port 5173 --strictPort --host 127.0.0.1', url: 'http://127.0.0.1:5173', reuseExistingServer: false },
  ],
});
