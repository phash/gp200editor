import { defineConfig, devices } from '@playwright/test';

// Minimal config for the verify-reminder E2E — points at the existing
// docker stack (app on :3320, mailhog on :8025) and skips the webServer
// step. Use: npx playwright test --config=playwright.verify-reminder.config.ts
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'verify-reminder.spec.ts',
  fullyParallel: false,
  retries: 0,
  reporter: 'line',
  use: {
    baseURL: 'http://localhost:3320',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
