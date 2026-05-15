# Welcome-Mail & Verify-Reminders — Design

**Date:** 2026-05-15
**Status:** Draft (pending review)
**Author:** Manuel + Claude

## Problem

Preset Forge sends a single minimal verification email at registration (`src/lib/email.ts:47-62` — four `<p>` tags, no branding, no onboarding context). Users who don't click the verify link within 24 hours are silently abandoned: no reminder mechanism exists, only a user-initiated `POST /api/auth/resend-verification` endpoint. Result: unverified accounts accumulate; users who lose or overlook the original mail never come back.

This design replaces the existing verify mail with a single visually polished **Welcome + Verify** mail, and introduces an automated **two-step reminder** flow (Day 2 + Day 7) driven by a system-cron-triggered Next.js route.

## Goals

- One combined Welcome-and-Verify email at registration, on-brand (Pedalboard Stage: dark + amber LED, JetBrains Mono headlines), explaining the next onboarding steps alongside the verification CTA.
- Two automated reminders for unverified users at Day 2 and Day 7, each with a freshly-issued verification token.
- All emails localized for the six supported locales (de, en, es, fr, it, pt).
- Cron infrastructure that fits the existing self-hosted Docker-on-VPS deployment (no third-party scheduler dependency).
- Templates maintainable in TypeScript with no new heavyweight dependencies (no React Email, no MJML).

## Non-Goals

- Verify-token cleanup (separate maintenance job, not in this spec).
- Account auto-deletion for stale unverified users (explicitly out of scope per user preference).
- Marketing-email unsubscribe (verify reminders are transactional under GDPR; no opt-out needed).
- Email bounce / complaint handling.
- Reminder for verified users (e.g., "we miss you" re-engagement) — out of scope.

## Decisions

| # | Question | Decision |
|---|---|---|
| 1 | Mail flow | **One combined Welcome+Verify mail** (replaces current verify mail). No separate post-verification welcome. |
| 2 | Locale scope | **All six locales** (de/en/es/fr/it/pt), consistent with the existing next-intl setup. |
| 3 | Reminder cadence | **Day 2 + Day 7**, two reminders total. After Day 7 the account stays unverified silently. |
| 4 | Trigger infrastructure | **System cron on VPS** calling a secret-protected Next.js route (`POST /api/cron/verify-reminders`). |
| 5 | Visual direction | **Pedalboard Stage** — dark `#0a0a0c` background, amber `#f59e0b` LED accents, JetBrains Mono headlines. On-brand with the editor UI. |
| 6 | Template engine | **TS functions + i18n lookups** via `createTranslator` from `next-intl`. No new dependency. |

## Architecture

### Schema delta (`prisma/schema.prisma`)

```prisma
model User {
  // ... existing fields
  locale                    String    @default("en")
  welcomeReminderD2SentAt   DateTime?
  welcomeReminderD7SentAt   DateTime?

  @@index([emailVerified, welcomeReminderD2SentAt, createdAt])
  @@index([emailVerified, welcomeReminderD7SentAt, createdAt])
}
```

Rationale for placing the timestamps on `User` rather than `EmailVerificationToken`: tokens rotate (24h expiry), reminders are a per-user lifetime concern. Two nullable timestamps are idempotent and cron-efficient.

**Migration** sets `locale = 'en'` for existing users (one-time backfill). DE-locale users who registered before this change will receive English reminders — accepted as a one-time compromise.

### File layout

```
src/lib/
  email.ts                        # public API: sendUserEmail(kind, user, payload)
  email-templates/
    _styles.ts                    # color/font tokens
    _layout.ts                    # renderEmailLayout({brand, hero, body, footer, locale})
    welcome.ts                    # renderWelcomeEmail(locale, {username, verifyUrl})
    verifyReminderD2.ts           # renderVerifyReminderD2Email(...)
    verifyReminderD7.ts           # renderVerifyReminderD7Email(...)
    passwordReset.ts              # migrated from inline string in email.ts
    warning.ts                    # migrated from inline string in email.ts

src/app/api/cron/verify-reminders/
  route.ts                        # POST handler, secret-protected

messages/{de,en,es,fr,it,pt}.json # new "email" namespace
```

### Public mail API

```ts
type EmailKind =
  | 'welcome'
  | 'verifyReminderD2'
  | 'verifyReminderD7'
  | 'passwordReset'
  | 'warning';

type EmailPayload =
  | { kind: 'welcome';          verifyUrl: string }
  | { kind: 'verifyReminderD2'; verifyUrl: string }
  | { kind: 'verifyReminderD7'; verifyUrl: string }
  | { kind: 'passwordReset';    resetUrl: string }
  | { kind: 'warning';          reason: string; message?: string };

export async function sendUserEmail(
  user: { email: string; locale: string; username: string },
  payload: EmailPayload,
): Promise<void>
```

A discriminated union on `kind` lets TypeScript narrow the required payload per email type. The dispatcher inside `sendUserEmail` picks the right renderer, then sends via the existing nodemailer transporter (unchanged).

### Template rendering

Each template module exports a pure function:

```ts
export function renderWelcomeEmail(
  locale: string,
  vars: { username: string; verifyUrl: string },
): { subject: string; html: string }
```

Inside:

```ts
import { createTranslator } from 'next-intl';
import messagesByLocale from '@/lib/email-templates/messages';  // or dynamic import

const t = createTranslator({
  locale,
  messages: messagesByLocale[locale],
  namespace: 'email.welcome',
});
```

`createTranslator` is the request-context-free variant of `next-intl`'s translation API — required because cron-triggered renders have no Next.js request scope.

### Layout (`_layout.ts`)

Table-based HTML, 600px max-width, inline CSS, dark theme. Header band carries the LED indicator and brand wordmark, body slot is template-specific, footer carries expiry note + locale-aware unsubscribe-equivalent text. Includes:

- `<meta name="color-scheme" content="dark">` for native dark-mode handling
- Hidden preheader `<div>` with the inbox preview text
- All colors / fonts from `_styles.ts` tokens
- No webfonts loaded — relies on `'JetBrains Mono'` and `'DM Sans'` being installed, with full mono / sans fallback stacks

### i18n keys (`messages/*.json`)

```json
{
  "email": {
    "common": {
      "footerCopyright": "© Preset Forge",
      "footerExpiryNote": "Link gültig für 24 Stunden"
    },
    "welcome": {
      "subject": "Willkommen bei Preset Forge — E-Mail bestätigen",
      "preheader": "Ein letzter Schritt: bestätige deine E-Mail.",
      "headline": "Willkommen, {username}.",
      "subhead": "Dein Account ist erstellt …",
      "step1": "Bestätigung anklicken",
      "step2": "GP-200 per USB anschließen",
      "step3": "Preset laden, editieren, teilen",
      "cta": "E-Mail bestätigen"
    },
    "verifyReminderD2": {
      "subject": "Dein Bestätigungslink — neu",
      "preheader": "Hier ist ein frischer Link.",
      "headline": "Noch nicht bestätigt?",
      "body": "Dein erster Link ist abgelaufen — hier ein neuer …",
      "cta": "E-Mail bestätigen"
    },
    "verifyReminderD7": {
      "subject": "Letzter Reminder — E-Mail bestätigen",
      "preheader": "Wir möchten dich nicht spammen.",
      "headline": "Ein letzter Anstoß.",
      "body": "Falls du nicht zurückkommst, lassen wir dich in Ruhe …",
      "cta": "E-Mail bestätigen"
    }
  }
}
```

Key-parity across all six locales is enforced by the existing i18n-parity unit test.

### Cron route — `POST /api/cron/verify-reminders`

```ts
export async function POST(request: NextRequest) {
  const auth = request.headers.get('authorization');
  if (!auth || !timingSafeEqualBearer(auth, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const cutD2 = new Date(now.getTime() - 2 * 24 * 3600 * 1000);
  const cutD7 = new Date(now.getTime() - 7 * 24 * 3600 * 1000);

  const result = {
    d2: { sent: 0, failed: 0, skippedByRace: 0 },
    d7: { sent: 0, failed: 0, skippedByRace: 0 },
  };

  // D2 pass
  const d2Candidates = await prisma.user.findMany({
    where: {
      emailVerified: false,
      welcomeReminderD2SentAt: null,
      createdAt: { lt: cutD2 },
    },
    select: { id: true, email: true, locale: true, username: true },
    take: 200,
  });
  for (const u of d2Candidates) {
    // Race-safe claim: only proceed if still null
    const claim = await prisma.user.updateMany({
      where: { id: u.id, welcomeReminderD2SentAt: null },
      data: { welcomeReminderD2SentAt: now },
    });
    if (claim.count === 0) { result.d2.skippedByRace++; continue; }

    try {
      const token = await issueVerificationToken(u.id);  // fresh 24h token
      const verifyUrl = buildVerifyUrl(u.locale, token);
      await sendUserEmail(u, { kind: 'verifyReminderD2', verifyUrl });
      result.d2.sent++;
    } catch (err) {
      // Roll back the claim so the next cron run retries
      await prisma.user.update({
        where: { id: u.id },
        data: { welcomeReminderD2SentAt: null },
      });
      await logError({ message: `D2 reminder failed for ${u.id}: ${String(err)}`, url: '/api/cron/verify-reminders', userId: u.id }).catch(() => {});
      result.d2.failed++;
    }
  }

  // D7 pass — identical pattern with welcomeReminderD7SentAt and cutD7

  return NextResponse.json(result);
}
```

**Race safety:** the `updateMany({ where: { ..., welcomeReminderD2SentAt: null } })` pattern atomically claims the row. If two cron runs overlap, only one wins the claim. The losing run sees `count === 0` and skips.

**Failure recovery:** if email send fails after claiming, the route rolls back the timestamp to `null` so the next cron run retries. The token created during the failed attempt is not cleaned up — it expires naturally in 24h.

**Bound:** `take: 200` per pass limits a single cron tick to 200 sends. Hourly cron with 200/tick handles up to 4,800 reminders/day — well above realistic scale.

### Crontab on VPS

```cron
0 * * * * curl -fsS -X POST \
  -H "Authorization: Bearer $CRON_SECRET" \
  https://preset-forge.com/api/cron/verify-reminders \
  >> /opt/gp200editor/logs/cron-verify-reminders.log 2>&1
```

Installed under the `musikersuche` user's crontab. `$CRON_SECRET` sourced via shell environment (or inlined; tradeoff documented in `docs/deployment.md`).

### Environment variables

| Variable | Purpose | Where |
|---|---|---|
| `CRON_SECRET` | Bearer token for the reminder route | `.env.prod`, VPS crontab env |

Generated once via `openssl rand -hex 32`. Never logged; constant-time compared.

### Register-flow change (`src/app/api/auth/register/route.ts`)

```diff
- await prisma.user.create({ data: { email, username, passwordHash, emailVerified: false } });
+ await prisma.user.create({ data: { email, username, passwordHash, emailVerified: false, locale } });

- await sendVerificationEmail(email, verifyUrl);
+ await sendUserEmail(
+   { email, locale, username },
+   { kind: 'welcome', verifyUrl },
+ );
```

The `locale` already comes off `body.locale` and is validated to be one of the six supported locales (existing code currently restricts to `de | en` — relax to the full set).

### Existing call sites to migrate

- `sendPasswordResetEmail(...)` callers → `sendUserEmail(user, { kind: 'passwordReset', resetUrl })`
- `sendVerificationEmail(...)` callers (`/api/auth/register`, `/api/auth/resend-verification`) → `sendUserEmail(user, { kind: 'welcome', verifyUrl })` for register; resend-verification uses `verifyReminderD2` template (manual user-triggered resend is conceptually the same as a Day-2 reminder).
- `sendWarningEmail(...)` callers → `sendUserEmail(user, { kind: 'warning', reason, message? })`

The three legacy functions are removed in the same PR (no compat shim — call sites are all inside this repo, easy to migrate atomically).

## Error handling

| Failure mode | Behavior |
|---|---|
| Email send fails during register | Same as today: `logError`, registration still succeeds, user can request resend. |
| Email send fails during cron reminder | `logError`, `welcomeReminderD*SentAt` rolled back to `null`, retried on next hourly cron. |
| Cron route hit without/with wrong bearer | 401, no work performed. |
| Two cron runs overlap | `updateMany` race-claim ensures at most one wins. Losing run logs `skippedByRace`. |
| Token issue inside cron fails (DB error) | Caught by outer `try/catch`, timestamp rolled back, retried next run. |
| Invalid locale on user | `createTranslator` falls back to `'en'` (defensive default in dispatcher). |

## Testing

| Layer | File | Coverage |
|---|---|---|
| Unit | `tests/unit/email-templates/welcome.test.ts` | renderWelcomeEmail for all 6 locales: subject non-empty, verifyUrl present and escaped, username present and escaped, CTA link href correct |
| Unit | `tests/unit/email-templates/verifyReminders.test.ts` | D2 + D7 renders for all 6 locales, snapshot-tested |
| Unit | `tests/unit/email-templates/i18n-keys.test.ts` | All six locale files have identical `email.*` key sets (or extend the existing parity test) |
| Unit | `tests/unit/cron-verify-reminders.test.ts` | 401 on bad/missing bearer; D2 query filter correctness; D7 query filter correctness; race-claim via `updateMany` returns `count === 0` path; send-failure rolls back timestamp |
| E2E | `tests/e2e/welcome-mail.spec.ts` | Register → Mailhog search by recipient → email contains brand wordmark + verify URL → click → user verified |
| E2E | `tests/e2e/verify-reminder.spec.ts` | Register → DB manipulation `createdAt = now - 49h` → POST cron route with test secret → Mailhog contains D2 subject for that recipient |

Mailhog tests use `/api/v2/search?kind=to&query=<email>` per CLAUDE.md (never `DELETE /messages` between tests — kills parallel test emails).

Playwright runs use `TMPDIR=/home/manuel/.tmp-playwright` per existing project convention.

## Rollout

1. Add `locale`, `welcomeReminderD2SentAt`, `welcomeReminderD7SentAt` to `User`; migration backfills `locale='en'`.
2. Add `email.*` namespace to all six locale files.
3. Implement `_styles.ts`, `_layout.ts`, three template modules.
4. Implement `sendUserEmail` dispatcher in `src/lib/email.ts`; remove three legacy functions; migrate all call sites.
5. Update `register/route.ts` to store locale and send welcome via new API.
6. Update `resend-verification/route.ts` to use `verifyReminderD2` template.
7. Implement cron route + tests.
8. Generate `CRON_SECRET` (`openssl rand -hex 32`); add to `.env.prod`.
9. Smoke test locally with a forged unverified user (createdAt < now-2d) and a manual `curl` to the cron route.
10. Deploy via `scripts/deploy-update.sh`.
11. Install VPS crontab entry under `musikersuche` user.
12. Verify first cron tick fires and produces a clean log line.

## Risks & open items

- **Cron-secret leak:** Blast radius = attacker can trigger reminder mails to unverified users. Mitigated by idempotency (each user gets each reminder at most once). Still worth rotating the secret if leak suspected.
- **Locale backfill for existing users:** Pre-migration users get `'en'`. If a DE-locale user registered before this change is still unverified, their D2/D7 reminder will arrive in English. Acceptable as a one-time backfill compromise.
- **Mail-client rendering variance:** Outlook on Windows still has notoriously buggy CSS. Mitigated by table layout + inline CSS + web-safe font fallbacks. Snapshot tests catch regressions; a manual cross-client check (Mail.app, Gmail web, Outlook 2019 if accessible) is recommended once before rollout.
- **JetBrains Mono / DM Sans availability:** Email clients ignore most webfont loading. The mono / sans fallback stacks guarantee a readable render on every system; the brand-specific fonts are nice-to-have.
- **Future re-engagement mails:** Out of scope here, but the new `sendUserEmail` dispatcher is the natural extension point.
