import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  reporter: 'line',
  // No webServer — hardware tests use an already-running server
});
