import { defineConfig } from '@playwright/test';

/** Minimal config for hardware MIDI tests — no webServer (app must already be running) */
export default defineConfig({
  testDir: '.',
  use: { baseURL: process.env.BASE_URL ?? 'http://localhost:3000' },
  timeout: 120_000,
});
