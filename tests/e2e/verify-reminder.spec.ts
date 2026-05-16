import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { UNIQUE } from './helpers';

const MAILHOG = process.env.MAILHOG_URL ?? 'http://localhost:8025';
const APP = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
const CRON_SECRET = process.env.CRON_SECRET ?? 'test-secret-value';
const TEST_SECRET = process.env.TEST_SECRET ?? 'test';
// Set BACKDATE_VIA=psql to bypass the test-only API and backdate via direct
// SQL — required when running E2E against a NODE_ENV=production build
// (e.g. the local docker stack), where /api/test/backdate-user returns 404.
const BACKDATE_VIA = process.env.BACKDATE_VIA ?? 'api';
const PG_CONTAINER = process.env.PG_CONTAINER ?? 'gp200editor-postgres-1';

function decodeQP(text: string): string {
  return text
    .replace(/=\r?\n/g, '')
    .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function backdateViaPsql(email: string, hoursAgo: number): void {
  // execFileSync (no shell) — passes args directly to docker, no shell expansion.
  // email comes from UNIQUE() (timestamp + hex), so embedding is safe; we still
  // single-quote-escape defensively. hoursAgo is a hardcoded number from the test.
  const safeEmail = email.replace(/'/g, "''");
  const sql = `UPDATE "User" SET "createdAt" = NOW() - INTERVAL '${hoursAgo} hours' WHERE email = '${safeEmail}'`;
  execFileSync(
    'docker',
    ['exec', '-i', PG_CONTAINER, 'psql', '-U', 'postgres', '-d', 'gp200', '-c', sql],
    { stdio: 'pipe' },
  );
}

test('day-2 reminder is sent for an unverified 49h-old user', async ({ request }) => {
  const username = UNIQUE();
  const email = `${username}@test.com`;
  const password = 'testpass123';

  // 1. Register the user via the API in DE locale
  const reg = await request.post(`${APP}/api/auth/register`, {
    data: { email, username, password, locale: 'de' },
  });
  expect(reg.ok(), 'register failed').toBe(true);

  // wait for the welcome/verify mail to land
  await new Promise((r) => setTimeout(r, 500));

  // 2. Backdate the user's createdAt to 49h ago
  if (BACKDATE_VIA === 'psql') {
    backdateViaPsql(email, 49);
  } else {
    const back = await request.post(`${APP}/api/test/backdate-user`, {
      headers: { 'x-test-secret': TEST_SECRET },
      data: { email, hoursAgo: 49 },
    });
    expect(back.ok(), 'backdate failed (set BACKDATE_VIA=psql for prod-mode docker)').toBe(true);
  }

  // 3. Trigger the cron route
  const cron = await request.post(`${APP}/api/cron/verify-reminders`, {
    headers: { authorization: `Bearer ${CRON_SECRET}` },
  });
  expect(cron.ok(), `cron failed: ${cron.status()}`).toBe(true);
  const cronBody = await cron.json();
  expect(cronBody.d2.sent, `expected ≥1 D2 sent, got ${JSON.stringify(cronBody)}`).toBeGreaterThanOrEqual(1);

  // 4. Look up the reminder mail in Mailhog
  const mailbox = email.split('@')[0];

  let found = false;
  for (let attempt = 0; attempt < 5 && !found; attempt++) {
    const search = await request.get(
      `${MAILHOG}/api/v2/search?kind=to&query=${mailbox}`,
    );
    const result = await search.json();
    for (const m of result.items ?? []) {
      const body = decodeQP(m.Content.Body as string);
      // The D2 reminder German subject contains "Bestätigungslink — neu"
      // Mailhog stores subjects in Content.Headers.Subject (array)
      const subjects = m.Content.Headers.Subject as string[] | undefined;
      if (subjects?.some((s) => /Bestätigungslink|neu/i.test(s))) {
        found = true;
        // Also assert the body contains a fresh verify URL
        expect(body).toMatch(/auth\/verify-email\?token=[a-f0-9]{64}/);
        break;
      }
    }
    if (!found) await new Promise((r) => setTimeout(r, 500));
  }

  expect(found, 'D2 reminder mail not found in Mailhog').toBe(true);
});
