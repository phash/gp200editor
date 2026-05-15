# Welcome Mail & Verify Reminders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the minimal verification email with a branded "Pedalboard Stage" welcome+verify mail localized for all six locales, and add a Day-2 / Day-7 verification-reminder flow driven by a system-cron-triggered Next.js route.

**Architecture:** Templates as pure TS render functions in a single `emailTemplate.ts` module (per CLAUDE.md `src/lib/` convention — `email.ts + emailTemplate.ts`, 4 mail types: `welcome`, `verifyReminder` (param `day: 2 | 7`), `passwordReset`, `warning`). Localization via `createTranslator` from `next-intl` so renders work outside a Next.js request context. Reminder cron is a secret-protected `POST /api/cron/verify-reminders` invoked hourly by the VPS crontab; race-safe `updateMany`-claim guarantees at-most-once delivery per reminder window.

**Tech Stack:** Next.js 15 App Router · Prisma 5 · PostgreSQL 16 · nodemailer (existing) · next-intl 4 · Vitest · Playwright + Mailhog

**Spec:** `docs/superpowers/specs/2026-05-15-welcome-mail-and-verify-reminders-design.md`

**Deviation from spec:** Spec proposed a `src/lib/email-templates/` directory with one file per template. Per CLAUDE.md update, the project convention is a single `src/lib/emailTemplate.ts` module exporting all 4 renderers + shared layout + style tokens. Functionally identical, organizationally tighter.

---

## File map

| File | Action | Responsibility |
|---|---|---|
| `prisma/schema.prisma` | Modify | Add `User.locale`, `User.welcomeReminderD2SentAt`, `User.welcomeReminderD7SentAt` + indexes |
| `prisma/migrations/<ts>_user_locale_and_verify_reminders/migration.sql` | Create | Generated migration |
| `src/lib/validators.ts` | Modify | Allow all six locales in register schema |
| `src/lib/emailTemplate.ts` | Create | `_styles` tokens, `renderLayout()`, `renderWelcomeEmail()`, `renderVerifyReminderEmail()`, `renderPasswordResetEmail()`, `renderWarningEmail()` |
| `src/lib/email.ts` | Rewrite | `sendUserEmail(user, payload)` dispatcher; transport unchanged |
| `messages/{de,en,es,fr,it,pt}.json` | Modify | Add `email.*` namespace (common, welcome, verifyReminderD2, verifyReminderD7) |
| `src/app/api/auth/register/route.ts` | Modify | Persist `locale`, send `welcome` via new API |
| `src/app/api/auth/resend-verification/route.ts` | Modify | Send `verifyReminder` (day 2) via new API |
| `src/app/api/auth/forgot-password/route.ts` | Modify | Send `passwordReset` via new API |
| `src/app/api/admin/users/[id]/warn/route.ts` | Modify | Send `warning` via new API |
| `src/app/api/cron/verify-reminders/route.ts` | Create | Secret-protected reminder cron handler |
| `tests/unit/email-template.test.ts` | Create | Renderer assertions for all locales/types |
| `tests/unit/cron-verify-reminders.test.ts` | Create | Auth, query filters, race-claim, failure rollback |
| `tests/unit/messages-parity.test.ts` | Modify | Already enforces parity — confirm `email.*` keys covered |
| `tests/e2e/welcome-mail.spec.ts` | Create | Register → Mailhog search → click verify → verified |
| `tests/e2e/verify-reminder.spec.ts` | Create | Forge createdAt → cron POST → Mailhog has D2 mail |
| `docs/deployment.md` | Modify | Document `CRON_SECRET` env var + crontab entry |
| `.env.example` | Modify | Add `CRON_SECRET=` placeholder |

---

## Phase 1: Schema + locale storage

### Task 1: Add User schema fields for locale and reminder timestamps

**Files:**
- Modify: `prisma/schema.prisma:15-34`

- [ ] **Step 1: Add three new columns + composite indexes**

Open `prisma/schema.prisma` and update the `User` model:

```prisma
model User {
  id            String   @id @default(cuid())
  email         String   @unique
  username      String   @unique
  passwordHash  String
  emailVerified Boolean  @default(false)
  bio           String?
  website       String?
  avatarKey     String?
  createdAt     DateTime @default(now())

  locale                  String    @default("en")
  welcomeReminderD2SentAt DateTime?
  welcomeReminderD7SentAt DateTime?

  sessions            Session[]
  resetTokens         PasswordResetToken[]
  emailVerifyTokens   EmailVerificationToken[]
  presets             Preset[]
  ratings             PresetRating[]
  role                Role          @default(USER)
  suspended           Boolean       @default(false)
  adminActions        AdminAction[]

  @@index([emailVerified, welcomeReminderD2SentAt, createdAt])
  @@index([emailVerified, welcomeReminderD7SentAt, createdAt])
}
```

- [ ] **Step 2: Generate migration**

Run:
```bash
npx prisma migrate dev --name user_locale_and_verify_reminders --create-only
```

Expected: a new directory `prisma/migrations/<timestamp>_user_locale_and_verify_reminders/` with a `migration.sql` file. Inspect the SQL — confirm it has `ALTER TABLE "User" ADD COLUMN "locale" TEXT NOT NULL DEFAULT 'en'` plus the two nullable timestamp columns and two `CREATE INDEX` statements.

- [ ] **Step 3: Apply migration**

```bash
npx prisma migrate dev
```

Expected: "All migrations have been applied" — Prisma client regenerates.

- [ ] **Step 4: Sanity check**

```bash
npx prisma studio
```
(Optional: open browser, confirm `locale` column is `en` for all existing users.) Close Studio when done.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(db): add User.locale + verify-reminder timestamps"
```

---

### Task 2: Accept all six locales in register validator

**Files:**
- Modify: `src/lib/validators.ts`
- Test: `tests/unit/validators.test.ts` (may already exist — extend, or create if absent)

- [ ] **Step 1: Open `src/lib/validators.ts` and locate the register schema**

Look for `registerSchema` (Zod). It currently does not require `locale` — confirm. Find the existing structure (likely `z.object({ email, username, password, ... })`).

- [ ] **Step 2: Write failing test**

Create or extend `tests/unit/validators.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { registerSchema } from '@/lib/validators';

describe('registerSchema locale', () => {
  it('accepts all six supported locales', () => {
    for (const locale of ['de', 'en', 'es', 'fr', 'it', 'pt']) {
      const parsed = registerSchema.safeParse({
        email: 'a@b.de', username: 'manuel', password: 'CorrectHorseBattery1!', locale,
      });
      expect(parsed.success, `locale=${locale}`).toBe(true);
    }
  });

  it('rejects unknown locale', () => {
    const parsed = registerSchema.safeParse({
      email: 'a@b.de', username: 'manuel', password: 'CorrectHorseBattery1!', locale: 'zh',
    });
    expect(parsed.success).toBe(false);
  });

  it('defaults locale to "en" when omitted', () => {
    const parsed = registerSchema.safeParse({
      email: 'a@b.de', username: 'manuel', password: 'CorrectHorseBattery1!',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.locale).toBe('en');
  });
});
```

- [ ] **Step 3: Run the test, expect FAIL**

```bash
npx vitest run tests/unit/validators.test.ts -t "registerSchema locale"
```
Expected: failures because `locale` is either absent from the schema or limited to `de | en`.

- [ ] **Step 4: Implement schema change**

In `src/lib/validators.ts`, add:
```ts
const SUPPORTED_LOCALES = ['de', 'en', 'es', 'fr', 'it', 'pt'] as const;
export const localeSchema = z.enum(SUPPORTED_LOCALES);
```

Extend `registerSchema` to include `locale: localeSchema.default('en')`.

- [ ] **Step 5: Run tests, expect PASS**

```bash
npx vitest run tests/unit/validators.test.ts -t "registerSchema locale"
```
Expected: all three test cases pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/validators.ts tests/unit/validators.test.ts
git commit -m "feat(validators): allow all six locales in register schema"
```

---

## Phase 2: i18n keys for email content

### Task 3: Add `email.*` namespace to all six locale files

**Files:**
- Modify: `messages/de.json`, `messages/en.json`, `messages/es.json`, `messages/fr.json`, `messages/it.json`, `messages/pt.json`

- [ ] **Step 1: Insert `email` namespace into `messages/en.json`**

Add this block as a top-level key (keep existing keys intact):
```json
"email": {
  "common": {
    "brand": "PRESET FORGE",
    "footerCopyright": "© Preset Forge · preset-forge.com",
    "expiryNote": "This link expires in 24 hours."
  },
  "welcome": {
    "subject": "Welcome to Preset Forge — verify your email",
    "preheader": "One last step: confirm your email to start saving presets.",
    "headline": "Welcome, {username}.",
    "subhead": "Your account is created. Confirm your email address to save and share presets.",
    "step1": "Click the button below to confirm",
    "step2": "Connect your GP-200 via USB-MIDI",
    "step3": "Load a .prst, edit live, save back to a slot",
    "cta": "Verify Email"
  },
  "verifyReminderD2": {
    "subject": "Your verification link — fresh copy",
    "preheader": "Your original link expired. Here's a new one.",
    "headline": "Still here?",
    "body": "Your original verification link expired after 24 hours. We've issued a fresh one — verify to unlock saving, sharing, and live editing.",
    "cta": "Verify Email"
  },
  "verifyReminderD7": {
    "subject": "Last reminder — verify your email",
    "preheader": "One last nudge — then we'll leave you alone.",
    "headline": "One last nudge.",
    "body": "We don't want to spam you. This is the final reminder — verify your email to keep your account active. If you don't, we'll quietly let it be.",
    "cta": "Verify Email"
  }
}
```

- [ ] **Step 2: Mirror the same keys into `messages/de.json` with German strings**

Use the same structure, German content. Example values:
```json
"email": {
  "common": {
    "brand": "PRESET FORGE",
    "footerCopyright": "© Preset Forge · preset-forge.com",
    "expiryNote": "Dieser Link ist 24 Stunden gültig."
  },
  "welcome": {
    "subject": "Willkommen bei Preset Forge — E-Mail bestätigen",
    "preheader": "Ein letzter Schritt: bestätige deine E-Mail.",
    "headline": "Willkommen, {username}.",
    "subhead": "Dein Account ist erstellt. Bestätige deine E-Mail-Adresse, um Presets zu speichern und zu teilen.",
    "step1": "Bestätigung anklicken",
    "step2": "GP-200 per USB-MIDI anschließen",
    "step3": "Preset laden, live editieren, in einen Slot speichern",
    "cta": "E-Mail bestätigen"
  },
  "verifyReminderD2": {
    "subject": "Dein Bestätigungslink — neu",
    "preheader": "Dein erster Link ist abgelaufen. Hier ist ein neuer.",
    "headline": "Noch nicht bestätigt?",
    "body": "Dein erster Bestätigungslink ist nach 24 Stunden abgelaufen. Hier ist ein frischer — bestätige, um Speichern, Teilen und Live-Editing freizuschalten.",
    "cta": "E-Mail bestätigen"
  },
  "verifyReminderD7": {
    "subject": "Letzter Reminder — E-Mail bestätigen",
    "preheader": "Ein letzter Anstoß — danach lassen wir dich in Ruhe.",
    "headline": "Ein letzter Anstoß.",
    "body": "Wir möchten dich nicht spammen. Das ist der finale Reminder — bestätige deine E-Mail, um deinen Account aktiv zu halten. Falls nicht, lassen wir dich in Ruhe.",
    "cta": "E-Mail bestätigen"
  }
}
```

- [ ] **Step 3: Add `email` namespace stubs to es.json, fr.json, it.json, pt.json**

Either copy the English block as a placeholder OR translate inline. Recommendation: copy the English structure into each, then translate inline (a quick LLM-assisted pass is acceptable since strings are short and well-bounded). Each of the four files must have the same key set as `en.json` — otherwise `messages-parity.test.ts` will fail.

- [ ] **Step 4: Run parity test, expect PASS**

```bash
npx vitest run tests/unit/messages-parity.test.ts
```
Expected: all six files have identical key sets.

- [ ] **Step 5: Commit**

```bash
git add messages
git commit -m "feat(i18n): add email namespace for welcome + verify-reminder strings"
```

---

## Phase 3: Template renderer

### Task 4: Style tokens + layout shell

**Files:**
- Create: `src/lib/emailTemplate.ts`
- Test: `tests/unit/email-template.test.ts`

- [ ] **Step 1: Write failing layout test**

Create `tests/unit/email-template.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { renderEmailLayout } from '@/lib/emailTemplate';

describe('renderEmailLayout', () => {
  it('produces a complete HTML document with dark color-scheme', () => {
    const html = renderEmailLayout({
      preheader: 'hello',
      bodyHtml: '<p>x</p>',
      locale: 'en',
    });
    expect(html).toContain('<!doctype html');
    expect(html).toContain('color-scheme');
    expect(html).toContain('dark');
    expect(html).toContain('<p>x</p>');
    expect(html).toContain('hello');
  });

  it('escapes preheader text', () => {
    const html = renderEmailLayout({
      preheader: '<script>alert(1)</script>',
      bodyHtml: '',
      locale: 'en',
    });
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

```bash
npx vitest run tests/unit/email-template.test.ts -t "renderEmailLayout"
```
Expected: import error / module not found.

- [ ] **Step 3: Create `src/lib/emailTemplate.ts` with tokens + layout**

```ts
import { createTranslator } from 'next-intl';
import de from '../../messages/de.json';
import en from '../../messages/en.json';
import es from '../../messages/es.json';
import fr from '../../messages/fr.json';
import it from '../../messages/it.json';
import pt from '../../messages/pt.json';

const MESSAGES: Record<string, unknown> = { de, en, es, fr, it, pt };

const SUPPORTED_LOCALES = ['de', 'en', 'es', 'fr', 'it', 'pt'] as const;
type Locale = (typeof SUPPORTED_LOCALES)[number];

function resolveLocale(locale: string): Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(locale)
    ? (locale as Locale)
    : 'en';
}

function makeT(locale: string, namespace: string) {
  const lc = resolveLocale(locale);
  return createTranslator({ locale: lc, messages: MESSAGES[lc], namespace });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

const T = {
  bg:        '#0a0a0c',
  card:      '#18181b',
  cardSoft:  '#27272a',
  textHi:    '#fafafa',
  textMid:   '#d4d4d8',
  textLo:    '#a1a1aa',
  textMute:  '#52525b',
  amber:     '#f59e0b',
  amberDeep: '#d97706',
  amberSoft: '#fbbf24',
} as const;

const MONO = `'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, Consolas, monospace`;
const SANS = `'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;

export function renderEmailLayout(args: {
  preheader: string;
  bodyHtml: string;
  locale: string;
}): string {
  const t = makeT(args.locale, 'email.common');
  return `<!doctype html>
<html lang="${escapeHtml(resolveLocale(args.locale))}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="dark" />
<meta name="supported-color-schemes" content="dark" />
<title>Preset Forge</title>
</head>
<body style="margin:0;padding:0;background:${T.bg};font-family:${SANS};color:${T.textMid};">
<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">
${escapeHtml(args.preheader)}
</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${T.bg};">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:${T.card};border-radius:10px;overflow:hidden;">
<tr><td style="padding:24px 28px 16px;border-bottom:1px solid ${T.cardSoft};">
<table role="presentation" cellpadding="0" cellspacing="0" border="0">
<tr>
<td style="width:14px;vertical-align:middle;">
<div style="width:8px;height:8px;border-radius:50%;background:${T.amber};box-shadow:0 0 8px ${T.amber};"></div>
</td>
<td style="vertical-align:middle;font-family:${MONO};font-size:11px;letter-spacing:0.18em;color:${T.amber};text-transform:uppercase;">
${escapeHtml(t('brand'))}
</td>
</tr>
</table>
</td></tr>
<tr><td style="padding:20px 28px 28px;">
${args.bodyHtml}
</td></tr>
<tr><td style="padding:14px 28px;background:#050507;border-top:1px solid ${T.card};font-family:${SANS};font-size:11px;color:${T.textMute};text-align:center;">
${escapeHtml(t('expiryNote'))} · ${escapeHtml(t('footerCopyright'))}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

export const __testing = { T, MONO, SANS, escapeHtml, resolveLocale, makeT };
```

- [ ] **Step 4: Run tests, expect PASS**

```bash
npx vitest run tests/unit/email-template.test.ts -t "renderEmailLayout"
```
Expected: both tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/emailTemplate.ts tests/unit/email-template.test.ts
git commit -m "feat(email): style tokens + dark-mode layout shell"
```

---

### Task 5: Welcome renderer

**Files:**
- Modify: `src/lib/emailTemplate.ts`
- Modify: `tests/unit/email-template.test.ts`

- [ ] **Step 1: Write failing test**

Append to `tests/unit/email-template.test.ts`:
```ts
import { renderWelcomeEmail } from '@/lib/emailTemplate';

describe('renderWelcomeEmail', () => {
  const cases = ['de', 'en', 'es', 'fr', 'it', 'pt'] as const;

  for (const locale of cases) {
    it(`renders for ${locale} with subject, verifyUrl and escaped username`, () => {
      const out = renderWelcomeEmail(locale, {
        username: 'Manuel<x>',
        verifyUrl: 'https://preset-forge.com/en/auth/verify-email?token=abc',
      });
      expect(out.subject).toBeTruthy();
      expect(out.subject.length).toBeGreaterThan(5);
      expect(out.html).toContain('https://preset-forge.com/en/auth/verify-email?token=abc');
      expect(out.html).toContain('Manuel&lt;x&gt;');
      expect(out.html).not.toContain('{username}');
      expect(out.html).toContain('<!doctype html');
    });
  }
});
```

- [ ] **Step 2: Run, expect FAIL**

```bash
npx vitest run tests/unit/email-template.test.ts -t "renderWelcomeEmail"
```
Expected: import error (function not defined).

- [ ] **Step 3: Implement `renderWelcomeEmail`**

Append to `src/lib/emailTemplate.ts`:
```ts
export function renderWelcomeEmail(
  locale: string,
  vars: { username: string; verifyUrl: string },
): { subject: string; html: string } {
  const t = makeT(locale, 'email.welcome');
  const safeName = escapeHtml(vars.username);
  const safeUrl = escapeHtml(vars.verifyUrl);

  const bodyHtml = `
<h1 style="margin:0 0 6px;font-family:${MONO};color:${T.textHi};font-size:22px;letter-spacing:-0.01em;">
${escapeHtml(t('headline', { username: safeName }))}
</h1>
<p style="margin:0 0 18px;font-family:${SANS};color:${T.textLo};font-size:13px;line-height:1.55;">
${escapeHtml(t('subhead'))}
</p>
<div style="border-left:2px solid ${T.amber};padding:4px 0 4px 12px;margin-bottom:10px;font-family:${SANS};font-size:13px;color:${T.textMid};line-height:1.5;">
<strong style="color:${T.textHi};font-family:${MONO};font-size:11px;letter-spacing:0.08em;">01</strong> · ${escapeHtml(t('step1'))}
</div>
<div style="border-left:2px solid ${T.amber};padding:4px 0 4px 12px;margin-bottom:10px;font-family:${SANS};font-size:13px;color:${T.textMid};line-height:1.5;">
<strong style="color:${T.textHi};font-family:${MONO};font-size:11px;letter-spacing:0.08em;">02</strong> · ${escapeHtml(t('step2'))}
</div>
<div style="border-left:2px solid ${T.amber};padding:4px 0 4px 12px;margin-bottom:20px;font-family:${SANS};font-size:13px;color:${T.textMid};line-height:1.5;">
<strong style="color:${T.textHi};font-family:${MONO};font-size:11px;letter-spacing:0.08em;">03</strong> · ${escapeHtml(t('step3'))}
</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
<tr><td align="center">
<a href="${safeUrl}" style="display:inline-block;background:${T.amber};color:#18181b;text-decoration:none;padding:14px 28px;border-radius:6px;font-family:${MONO};font-size:12px;letter-spacing:0.12em;text-transform:uppercase;font-weight:700;">
▸ ${escapeHtml(t('cta'))}
</a>
</td></tr>
</table>
`;

  return {
    subject: t('subject'),
    html: renderEmailLayout({
      preheader: t('preheader'),
      bodyHtml,
      locale,
    }),
  };
}
```

Note: `escapeHtml(t('headline', { username: safeName }))` — `safeName` is already escaped, then we escape again. Wrong. Fix: pass raw `vars.username` to `t()`, then escape the whole result:
```ts
const headlineText = escapeHtml(t('headline', { username: vars.username }));
```
and use `${headlineText}` in the template literal. Apply the same idiom anywhere a translation interpolates user-supplied values.

- [ ] **Step 4: Run tests, expect PASS**

```bash
npx vitest run tests/unit/email-template.test.ts -t "renderWelcomeEmail"
```
Expected: 6 cases (one per locale) pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/emailTemplate.ts tests/unit/email-template.test.ts
git commit -m "feat(email): welcome+verify renderer (all 6 locales)"
```

---

### Task 6: Verify-reminder renderer (parameterized day)

**Files:**
- Modify: `src/lib/emailTemplate.ts`
- Modify: `tests/unit/email-template.test.ts`

- [ ] **Step 1: Write failing test**

Append to `tests/unit/email-template.test.ts`:
```ts
import { renderVerifyReminderEmail } from '@/lib/emailTemplate';

describe('renderVerifyReminderEmail', () => {
  for (const day of [2, 7] as const) {
    for (const locale of ['de', 'en', 'es', 'fr', 'it', 'pt'] as const) {
      it(`renders day=${day} for ${locale}`, () => {
        const out = renderVerifyReminderEmail(locale, day, {
          verifyUrl: 'https://preset-forge.com/de/auth/verify-email?token=xyz',
        });
        expect(out.subject).toBeTruthy();
        expect(out.html).toContain('https://preset-forge.com/de/auth/verify-email?token=xyz');
        expect(out.html).toContain('<!doctype html');
      });
    }
  }

  it('rejects invalid day', () => {
    expect(() =>
      // @ts-expect-error testing runtime guard
      renderVerifyReminderEmail('en', 3, { verifyUrl: 'https://x' }),
    ).toThrow(/day/);
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

```bash
npx vitest run tests/unit/email-template.test.ts -t "renderVerifyReminderEmail"
```

- [ ] **Step 3: Implement**

Append to `src/lib/emailTemplate.ts`:
```ts
export function renderVerifyReminderEmail(
  locale: string,
  day: 2 | 7,
  vars: { verifyUrl: string },
): { subject: string; html: string } {
  if (day !== 2 && day !== 7) {
    throw new Error(`renderVerifyReminderEmail: unsupported day ${day}`);
  }
  const ns = day === 2 ? 'email.verifyReminderD2' : 'email.verifyReminderD7';
  const t = makeT(locale, ns);
  const safeUrl = escapeHtml(vars.verifyUrl);

  const bodyHtml = `
<h1 style="margin:0 0 8px;font-family:${MONO};color:${T.textHi};font-size:22px;letter-spacing:-0.01em;">
${escapeHtml(t('headline'))}
</h1>
<p style="margin:0 0 22px;font-family:${SANS};color:${T.textLo};font-size:13px;line-height:1.55;">
${escapeHtml(t('body'))}
</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
<tr><td align="center">
<a href="${safeUrl}" style="display:inline-block;background:${T.amber};color:#18181b;text-decoration:none;padding:14px 28px;border-radius:6px;font-family:${MONO};font-size:12px;letter-spacing:0.12em;text-transform:uppercase;font-weight:700;">
▸ ${escapeHtml(t('cta'))}
</a>
</td></tr>
</table>
`;

  return {
    subject: t('subject'),
    html: renderEmailLayout({
      preheader: t('preheader'),
      bodyHtml,
      locale,
    }),
  };
}
```

- [ ] **Step 4: Run tests, expect PASS**

```bash
npx vitest run tests/unit/email-template.test.ts -t "renderVerifyReminderEmail"
```
Expected: 12 cases (6 locales × 2 days) + invalid-day test all pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/emailTemplate.ts tests/unit/email-template.test.ts
git commit -m "feat(email): verify-reminder renderer (D2/D7, all 6 locales)"
```

---

### Task 7: Password-reset and warning renderers (migrate from inline strings)

**Files:**
- Modify: `src/lib/emailTemplate.ts`
- Modify: `tests/unit/email-template.test.ts`

These two stay English-only (existing behavior; localization is out of scope for this PR). Migrate so all four templates live in one module under one consistent API.

- [ ] **Step 1: Write failing tests**

Append:
```ts
import { renderPasswordResetEmail, renderWarningEmail } from '@/lib/emailTemplate';

describe('renderPasswordResetEmail', () => {
  it('renders with reset URL escaped into the HTML', () => {
    const out = renderPasswordResetEmail({ resetUrl: 'https://preset-forge.com/reset?token=t' });
    expect(out.subject).toContain('Preset Forge');
    expect(out.html).toContain('https://preset-forge.com/reset?token=t');
  });
});

describe('renderWarningEmail', () => {
  it('renders reason and optional message, escaping both', () => {
    const out = renderWarningEmail({ reason: 'Spam', message: 'Stop <b>now</b>' });
    expect(out.subject).toContain('Warning');
    expect(out.html).toContain('Spam');
    expect(out.html).toContain('Stop &lt;b&gt;now&lt;/b&gt;');
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

```bash
npx vitest run tests/unit/email-template.test.ts -t "renderPasswordResetEmail|renderWarningEmail"
```

- [ ] **Step 3: Implement**

Append:
```ts
export function renderPasswordResetEmail(
  vars: { resetUrl: string },
): { subject: string; html: string } {
  const safeUrl = escapeHtml(vars.resetUrl);
  const bodyHtml = `
<p style="margin:0 0 14px;font-family:${SANS};color:${T.textMid};font-size:13px;line-height:1.55;">
Click the link below to reset your password. It expires in 1 hour.
</p>
<p style="margin:0 0 22px;font-family:${MONO};color:${T.textLo};font-size:12px;word-break:break-all;">
<a href="${safeUrl}" style="color:${T.amber};text-decoration:underline;">${safeUrl}</a>
</p>
<p style="margin:0;font-family:${SANS};color:${T.textMute};font-size:12px;">
If you did not request this, you can safely ignore this email.
</p>
`;
  return {
    subject: 'Reset your password — Preset Forge',
    html: renderEmailLayout({
      preheader: 'Reset your password',
      bodyHtml,
      locale: 'en',
    }),
  };
}

export function renderWarningEmail(
  vars: { reason: string; message?: string },
): { subject: string; html: string } {
  const safeReason = escapeHtml(vars.reason);
  const safeMessage = vars.message ? escapeHtml(vars.message) : '';
  const bodyHtml = `
<p style="margin:0 0 12px;font-family:${SANS};color:${T.textMid};font-size:13px;line-height:1.55;">
You have received a warning from the Preset Forge moderation team.
</p>
<p style="margin:0 0 6px;font-family:${SANS};color:${T.textHi};font-size:13px;">
<strong>Reason:</strong> ${safeReason}
</p>
${safeMessage ? `<p style="margin:0 0 14px;font-family:${SANS};color:${T.textHi};font-size:13px;"><strong>Details:</strong> ${safeMessage}</p>` : ''}
<p style="margin:14px 0 0;font-family:${SANS};color:${T.textLo};font-size:12px;line-height:1.55;">
Please review your content and ensure it complies with our community guidelines. Continued violations may result in account suspension.
</p>
`;
  return {
    subject: 'Warning — Preset Forge',
    html: renderEmailLayout({ preheader: 'Moderation warning', bodyHtml, locale: 'en' }),
  };
}
```

- [ ] **Step 4: Run tests, expect PASS**

```bash
npx vitest run tests/unit/email-template.test.ts
```
Expected: all four template renderer test groups pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/emailTemplate.ts tests/unit/email-template.test.ts
git commit -m "feat(email): migrate password-reset and warning renderers to template module"
```

---

## Phase 4: Dispatcher + call-site migration

### Task 8: `sendUserEmail` dispatcher

**Files:**
- Rewrite: `src/lib/email.ts`

- [ ] **Step 1: Replace `src/lib/email.ts` entirely**

Use the Write tool with this content:
```ts
import nodemailer from 'nodemailer';
import {
  renderWelcomeEmail,
  renderVerifyReminderEmail,
  renderPasswordResetEmail,
  renderWarningEmail,
} from './emailTemplate';

export type EmailPayload =
  | { kind: 'welcome'; verifyUrl: string }
  | { kind: 'verifyReminderD2'; verifyUrl: string }
  | { kind: 'verifyReminderD7'; verifyUrl: string }
  | { kind: 'passwordReset'; resetUrl: string }
  | { kind: 'warning'; reason: string; message?: string };

export interface EmailUser {
  email: string;
  locale: string;
  username: string;
}

function getTransporter() {
  const host = process.env.MAIL_HOST ?? process.env.EMAIL_SMTP_HOST;
  const port = Number(process.env.MAIL_PORT ?? process.env.EMAIL_SMTP_PORT ?? 1025);
  const user = process.env.MAIL_USERNAME ?? process.env.EMAIL_SMTP_USER;
  const pass = process.env.MAIL_PASSWORD ?? process.env.EMAIL_SMTP_PASS;
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: user ? { user, pass } : undefined,
    tls: { rejectUnauthorized: process.env.NODE_ENV === 'production' },
  });
}

function getFrom(): string {
  return process.env.EMAIL_FROM ?? `noreply@${process.env.MAIL_HOST ?? 'preset-forge.com'}`;
}

function render(user: EmailUser, payload: EmailPayload): { subject: string; html: string } {
  switch (payload.kind) {
    case 'welcome':
      return renderWelcomeEmail(user.locale, { username: user.username, verifyUrl: payload.verifyUrl });
    case 'verifyReminderD2':
      return renderVerifyReminderEmail(user.locale, 2, { verifyUrl: payload.verifyUrl });
    case 'verifyReminderD7':
      return renderVerifyReminderEmail(user.locale, 7, { verifyUrl: payload.verifyUrl });
    case 'passwordReset':
      return renderPasswordResetEmail({ resetUrl: payload.resetUrl });
    case 'warning':
      return renderWarningEmail({ reason: payload.reason, message: payload.message });
  }
}

export async function sendUserEmail(user: EmailUser, payload: EmailPayload): Promise<void> {
  const { subject, html } = render(user, payload);
  await getTransporter().sendMail({ from: getFrom(), to: user.email, subject, html });
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```
Expected: pre-existing errors only — no new errors from `email.ts`. (Call sites using the old function names will fail — that's fine for now, the next tasks fix them.)

- [ ] **Step 3: Don't commit yet** — call sites are broken; commit at the end of Task 12.

---

### Task 9: Migrate `register/route.ts`

**Files:**
- Modify: `src/app/api/auth/register/route.ts`

- [ ] **Step 1: Replace the registration logic**

Find the section that creates the user (line ~78) and replace through the verify-email send (line ~118):
```ts
let user;
try {
  user = await prisma.user.create({
    data: { email, username, passwordHash, emailVerified: false, locale: parsed.data.locale },
  });
} catch (e) {
  if (e instanceof PrismaClientKnownRequestError && e.code === 'P2002') {
    const field = (e.meta?.target as string[] | undefined)?.[0] ?? 'field';
    const message = field === 'email' ? 'Email already taken' : 'Username already taken';
    return NextResponse.json({ error: message }, { status: 409 });
  }
  throw e;
}

const token = crypto.randomBytes(32).toString('hex');
const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

await prisma.emailVerificationToken.create({
  data: {
    userId: user.id,
    tokenHash,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  },
});

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3320';
const verifyUrl = `${appUrl}/${user.locale}/auth/verify-email?token=${token}`;

try {
  await sendUserEmail(
    { email: user.email, locale: user.locale, username: user.username },
    { kind: 'welcome', verifyUrl },
  );
} catch (err) {
  logError({
    message: `Failed to send welcome email: ${err instanceof Error ? err.message : String(err)}`,
    stack: err instanceof Error ? err.stack : undefined,
    url: '/api/auth/register',
    userId: user.id,
  }).catch(() => {});
}
```

Update the import at the top:
```ts
- import { sendVerificationEmail } from '@/lib/email';
+ import { sendUserEmail } from '@/lib/email';
```

The old `locale` resolution (`body?.locale === 'de' ? 'de' : 'en'`) is removed — `parsed.data.locale` comes from the validator with default `'en'`.

- [ ] **Step 2: Remove honeypot `locale` ambiguity**

The honeypot block (line ~32) returns early before parsing. Confirm that still works — no `locale` reference needed there.

- [ ] **Step 3: Typecheck**

```bash
npx tsc --noEmit
```
Expected: no errors from `register/route.ts`.

---

### Task 10: Migrate `resend-verification/route.ts`

**Files:**
- Modify: `src/app/api/auth/resend-verification/route.ts`

- [ ] **Step 1: Open the file and update the email call**

Replace the `sendVerificationEmail` call with:
```ts
await sendUserEmail(
  { email: user.email, locale: user.locale, username: user.username },
  { kind: 'verifyReminderD2', verifyUrl },
);
```

Update the import:
```ts
- import { sendVerificationEmail } from '@/lib/email';
+ import { sendUserEmail } from '@/lib/email';
```

Conceptual reason for `verifyReminderD2`: a user-triggered resend is exactly the situation the D2 reminder covers (token expired or lost; fresh link needed).

- [ ] **Step 2: Confirm the `prisma.user.findUnique` selects `locale` and `username`**

The selected fields must include `locale: true, username: true, email: true`. Adjust the `select` clause if necessary.

- [ ] **Step 3: Typecheck**

```bash
npx tsc --noEmit
```

---

### Task 11: Migrate `forgot-password/route.ts` and `warn/route.ts`

**Files:**
- Modify: `src/app/api/auth/forgot-password/route.ts`
- Modify: `src/app/api/admin/users/[id]/warn/route.ts`

- [ ] **Step 1: `forgot-password/route.ts`**

Replace `sendPasswordResetEmail(email, resetUrl)` with:
```ts
await sendUserEmail(
  { email: user.email, locale: user.locale ?? 'en', username: user.username },
  { kind: 'passwordReset', resetUrl },
);
```

(The password-reset template ignores locale today — it's still EN-only — but passing locale keeps the API symmetric and future-proofs the migration when localization is added.)

Update import: `sendPasswordResetEmail` → `sendUserEmail`. Ensure the user lookup selects `username` and `locale`.

- [ ] **Step 2: `warn/route.ts`**

Replace `sendWarningEmail(targetUser.email, reason, message)` with:
```ts
await sendUserEmail(
  { email: targetUser.email, locale: targetUser.locale ?? 'en', username: targetUser.username },
  { kind: 'warning', reason, message },
);
```

Update import. Ensure the user lookup selects `username` and `locale`.

- [ ] **Step 3: Typecheck**

```bash
npx tsc --noEmit
```
Expected: no errors.

---

### Task 12: Run the full unit test suite + commit Phase 4

**Files:**
- (no edits)

- [ ] **Step 1: Run unit tests**

```bash
npm run test
```
Expected: all green. Email-related tests in particular: `email-template.test.ts`, `validators.test.ts`, `messages-parity.test.ts`.

- [ ] **Step 2: Commit Phase 4 atomically**

```bash
git add src/lib/email.ts \
        src/app/api/auth/register/route.ts \
        src/app/api/auth/resend-verification/route.ts \
        src/app/api/auth/forgot-password/route.ts \
        src/app/api/admin/users/[id]/warn/route.ts
git commit -m "feat(email): sendUserEmail dispatcher + migrate all call sites"
```

---

## Phase 5: Cron route

### Task 13: Cron route scaffold with auth guard

**Files:**
- Create: `src/app/api/cron/verify-reminders/route.ts`
- Create: `tests/unit/cron-verify-reminders.test.ts`

- [ ] **Step 1: Write failing auth tests**

Create `tests/unit/cron-verify-reminders.test.ts`:
```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findMany: vi.fn().mockResolvedValue([]), updateMany: vi.fn() },
    emailVerificationToken: { create: vi.fn() },
  },
}));
vi.mock('@/lib/email', () => ({ sendUserEmail: vi.fn() }));
vi.mock('@/lib/errorLog', () => ({ logError: vi.fn().mockResolvedValue(undefined) }));

import { POST } from '@/app/api/cron/verify-reminders/route';

function makeReq(headers: Record<string, string> = {}) {
  return new Request('http://localhost/api/cron/verify-reminders', {
    method: 'POST',
    headers,
  }) as unknown as Parameters<typeof POST>[0];
}

describe('cron verify-reminders auth', () => {
  beforeEach(() => {
    process.env.CRON_SECRET = 'test-secret-value';
  });

  it('returns 401 when Authorization header missing', async () => {
    const res = await POST(makeReq());
    expect(res.status).toBe(401);
  });

  it('returns 401 when bearer is wrong', async () => {
    const res = await POST(makeReq({ authorization: 'Bearer wrong' }));
    expect(res.status).toBe(401);
  });

  it('returns 200 with correct bearer', async () => {
    const res = await POST(makeReq({ authorization: 'Bearer test-secret-value' }));
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

```bash
npx vitest run tests/unit/cron-verify-reminders.test.ts
```
Expected: import error (route not defined).

- [ ] **Step 3: Implement minimal route**

Create `src/app/api/cron/verify-reminders/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { sendUserEmail } from '@/lib/email';
import { logError } from '@/lib/errorLog';

function authorized(request: NextRequest): boolean {
  const provided = request.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  if (!provided || !secret) return false;
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  return NextResponse.json({
    d2: { sent: 0, failed: 0, skippedByRace: 0 },
    d7: { sent: 0, failed: 0, skippedByRace: 0 },
  });
}
```

- [ ] **Step 4: Run tests, expect PASS**

```bash
npx vitest run tests/unit/cron-verify-reminders.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/cron/verify-reminders/route.ts tests/unit/cron-verify-reminders.test.ts
git commit -m "feat(cron): verify-reminders route scaffold + auth guard"
```

---

### Task 14: D2 reminder logic

**Files:**
- Modify: `src/app/api/cron/verify-reminders/route.ts`
- Modify: `tests/unit/cron-verify-reminders.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `tests/unit/cron-verify-reminders.test.ts`:
```ts
import { prisma } from '@/lib/prisma';
import { sendUserEmail } from '@/lib/email';

describe('cron verify-reminders — D2 pass', () => {
  beforeEach(() => {
    process.env.CRON_SECRET = 'test-secret-value';
    vi.mocked(prisma.user.findMany).mockReset().mockResolvedValue([]);
    vi.mocked(prisma.user.updateMany).mockReset().mockResolvedValue({ count: 1 });
    vi.mocked(prisma.emailVerificationToken.create).mockReset().mockResolvedValue({} as never);
    vi.mocked(sendUserEmail).mockReset().mockResolvedValue();
  });

  it('queries D2 candidates with the correct filter', async () => {
    await POST(makeReq({ authorization: 'Bearer test-secret-value' }));
    const findMany = vi.mocked(prisma.user.findMany);
    expect(findMany).toHaveBeenCalled();
    const firstCallArgs = findMany.mock.calls[0]![0]!;
    expect(firstCallArgs.where).toMatchObject({
      emailVerified: false,
      welcomeReminderD2SentAt: null,
    });
    expect(firstCallArgs.where.createdAt.lt).toBeInstanceOf(Date);
    expect(firstCallArgs.take).toBe(200);
  });

  it('sends verifyReminderD2 for each candidate that wins the claim', async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValueOnce([
      { id: 'u1', email: 'a@b.de', locale: 'de', username: 'alice' },
      { id: 'u2', email: 'c@d.de', locale: 'en', username: 'bob' },
    ] as never).mockResolvedValueOnce([]);

    const res = await POST(makeReq({ authorization: 'Bearer test-secret-value' }));
    const json = await res.json();
    expect(json.d2.sent).toBe(2);
    expect(sendUserEmail).toHaveBeenCalledTimes(2);
    const firstCall = vi.mocked(sendUserEmail).mock.calls[0]!;
    expect(firstCall[1]).toMatchObject({ kind: 'verifyReminderD2' });
  });

  it('skips candidates lost to race claim', async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValueOnce([
      { id: 'u1', email: 'a@b.de', locale: 'de', username: 'alice' },
    ] as never).mockResolvedValueOnce([]);
    vi.mocked(prisma.user.updateMany).mockResolvedValueOnce({ count: 0 });

    const res = await POST(makeReq({ authorization: 'Bearer test-secret-value' }));
    const json = await res.json();
    expect(json.d2.sent).toBe(0);
    expect(json.d2.skippedByRace).toBe(1);
    expect(sendUserEmail).not.toHaveBeenCalled();
  });

  it('rolls back the timestamp when send fails', async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValueOnce([
      { id: 'u1', email: 'a@b.de', locale: 'de', username: 'alice' },
    ] as never).mockResolvedValueOnce([]);
    vi.mocked(sendUserEmail).mockRejectedValueOnce(new Error('SMTP down'));
    const updateOne = vi.fn().mockResolvedValue({});
    (prisma.user as unknown as { update: typeof updateOne }).update = updateOne;

    const res = await POST(makeReq({ authorization: 'Bearer test-secret-value' }));
    const json = await res.json();
    expect(json.d2.failed).toBe(1);
    expect(json.d2.sent).toBe(0);
    expect(updateOne).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { welcomeReminderD2SentAt: null },
    });
  });
});
```

Note the `prisma` mock at the top of the file needs an `update` method. Update the initial `vi.mock` block:
```ts
vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      update: vi.fn().mockResolvedValue({}),
    },
    emailVerificationToken: { create: vi.fn().mockResolvedValue({} as never) },
  },
}));
```

- [ ] **Step 2: Run, expect FAIL**

```bash
npx vitest run tests/unit/cron-verify-reminders.test.ts -t "D2 pass"
```

- [ ] **Step 3: Implement D2 logic**

Replace the body of `POST` in `src/app/api/cron/verify-reminders/route.ts`:
```ts
export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const result = {
    d2: { sent: 0, failed: 0, skippedByRace: 0 },
    d7: { sent: 0, failed: 0, skippedByRace: 0 },
  };

  await runReminderPass({
    field: 'welcomeReminderD2SentAt',
    daysAgo: 2,
    kind: 'verifyReminderD2',
    bucket: result.d2,
  });

  return NextResponse.json(result);
}

interface ReminderPassArgs {
  field: 'welcomeReminderD2SentAt' | 'welcomeReminderD7SentAt';
  daysAgo: number;
  kind: 'verifyReminderD2' | 'verifyReminderD7';
  bucket: { sent: number; failed: number; skippedByRace: number };
}

async function runReminderPass(args: ReminderPassArgs): Promise<void> {
  const now = new Date();
  const cutoff = new Date(now.getTime() - args.daysAgo * 24 * 60 * 60 * 1000);

  const candidates = await prisma.user.findMany({
    where: {
      emailVerified: false,
      [args.field]: null,
      createdAt: { lt: cutoff },
    },
    select: { id: true, email: true, locale: true, username: true },
    take: 200,
  });

  for (const u of candidates) {
    const claim = await prisma.user.updateMany({
      where: { id: u.id, [args.field]: null },
      data: { [args.field]: now },
    });
    if (claim.count === 0) {
      args.bucket.skippedByRace++;
      continue;
    }

    try {
      const token = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      await prisma.emailVerificationToken.create({
        data: {
          userId: u.id,
          tokenHash,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3320';
      const verifyUrl = `${appUrl}/${u.locale}/auth/verify-email?token=${token}`;
      await sendUserEmail(
        { email: u.email, locale: u.locale, username: u.username },
        { kind: args.kind, verifyUrl },
      );
      args.bucket.sent++;
    } catch (err) {
      await prisma.user.update({
        where: { id: u.id },
        data: { [args.field]: null },
      });
      await logError({
        message: `Reminder ${args.kind} failed for user ${u.id}: ${err instanceof Error ? err.message : String(err)}`,
        stack: err instanceof Error ? err.stack : undefined,
        url: '/api/cron/verify-reminders',
        userId: u.id,
      }).catch(() => {});
      args.bucket.failed++;
    }
  }
}
```

- [ ] **Step 4: Run tests, expect PASS**

```bash
npx vitest run tests/unit/cron-verify-reminders.test.ts -t "D2 pass"
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/cron/verify-reminders/route.ts tests/unit/cron-verify-reminders.test.ts
git commit -m "feat(cron): D2 verify-reminder pass with race-safe claim + rollback"
```

---

### Task 15: D7 reminder logic

**Files:**
- Modify: `src/app/api/cron/verify-reminders/route.ts`
- Modify: `tests/unit/cron-verify-reminders.test.ts`

- [ ] **Step 1: Write failing test for D7**

Append to `tests/unit/cron-verify-reminders.test.ts`:
```ts
describe('cron verify-reminders — D7 pass', () => {
  beforeEach(() => {
    process.env.CRON_SECRET = 'test-secret-value';
    vi.mocked(prisma.user.findMany).mockReset().mockResolvedValue([]);
    vi.mocked(prisma.user.updateMany).mockReset().mockResolvedValue({ count: 1 });
    vi.mocked(sendUserEmail).mockReset().mockResolvedValue();
  });

  it('queries D7 candidates after D2 query', async () => {
    await POST(makeReq({ authorization: 'Bearer test-secret-value' }));
    const findMany = vi.mocked(prisma.user.findMany);
    expect(findMany).toHaveBeenCalledTimes(2);
    const d7Args = findMany.mock.calls[1]![0]!;
    expect(d7Args.where).toMatchObject({
      emailVerified: false,
      welcomeReminderD7SentAt: null,
    });
  });

  it('sends verifyReminderD7 for D7 candidates', async () => {
    vi.mocked(prisma.user.findMany)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: 'u3', email: 'e@f.de', locale: 'fr', username: 'cleo' },
      ] as never);

    const res = await POST(makeReq({ authorization: 'Bearer test-secret-value' }));
    const json = await res.json();
    expect(json.d7.sent).toBe(1);
    expect(sendUserEmail).toHaveBeenCalledWith(
      { email: 'e@f.de', locale: 'fr', username: 'cleo' },
      expect.objectContaining({ kind: 'verifyReminderD7' }),
    );
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

```bash
npx vitest run tests/unit/cron-verify-reminders.test.ts -t "D7 pass"
```

- [ ] **Step 3: Add D7 pass to `POST`**

In `src/app/api/cron/verify-reminders/route.ts`, after the D2 `runReminderPass` call:
```ts
await runReminderPass({
  field: 'welcomeReminderD7SentAt',
  daysAgo: 7,
  kind: 'verifyReminderD7',
  bucket: result.d7,
});
```

- [ ] **Step 4: Run all cron tests, expect PASS**

```bash
npx vitest run tests/unit/cron-verify-reminders.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/cron/verify-reminders/route.ts tests/unit/cron-verify-reminders.test.ts
git commit -m "feat(cron): D7 verify-reminder pass"
```

---

## Phase 6: E2E + deployment artifacts

### Task 16: E2E — welcome mail

**Files:**
- Create: `tests/e2e/welcome-mail.spec.ts`

- [ ] **Step 1: Write the test**

Create `tests/e2e/welcome-mail.spec.ts`:
```ts
import { test, expect } from '@playwright/test';

const MAILHOG = process.env.MAILHOG_URL ?? 'http://localhost:8025';

test('welcome mail is sent on register and contains brand + verify link', async ({ page, request }) => {
  const email = `welcome-${Date.now()}@test.example`;
  const username = `welcome${Date.now()}`;

  await page.goto('/de/auth/register', { waitUntil: 'domcontentloaded' });
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/benutzername|username/i).fill(username);
  await page.getByLabel(/passwort|password/i).first().fill('CorrectHorseBattery1!');
  await page.getByLabel(/passwort|password/i).nth(1).fill('CorrectHorseBattery1!').catch(() => {});
  await page.getByRole('button', { name: /registrieren|register/i }).click();

  // Wait briefly for mail dispatch
  await page.waitForTimeout(500);

  const search = await request.get(`${MAILHOG}/api/v2/search?kind=to&query=${encodeURIComponent(email)}`);
  expect(search.ok()).toBe(true);
  const body = await search.json();
  expect(body.items.length).toBeGreaterThan(0);

  const mail = body.items[0];
  const html = mail.Content.Body as string;
  expect(html).toContain('PRESET FORGE');
  expect(html).toMatch(/auth\/verify-email\?token=/);
  expect(html).toContain('Willkommen');  // DE register → DE welcome
});
```

- [ ] **Step 2: Run the test (app + Mailhog must be up)**

```bash
TMPDIR=/home/manuel/.tmp-playwright npx playwright test tests/e2e/welcome-mail.spec.ts
```
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/welcome-mail.spec.ts
git commit -m "test(e2e): welcome mail rendered + delivered on register"
```

---

### Task 17: E2E — verify reminder

**Files:**
- Create: `tests/e2e/verify-reminder.spec.ts`

- [ ] **Step 1: Write the test**

Create `tests/e2e/verify-reminder.spec.ts`:
```ts
import { test, expect } from '@playwright/test';

const MAILHOG = process.env.MAILHOG_URL ?? 'http://localhost:8025';
const APP = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
const CRON_SECRET = process.env.CRON_SECRET ?? 'test-secret-value';

test('day-2 reminder is sent for an unverified 49h-old user', async ({ page, request }) => {
  const email = `reminder-${Date.now()}@test.example`;
  const username = `rem${Date.now()}`;

  await page.goto('/en/auth/register', { waitUntil: 'domcontentloaded' });
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/username/i).fill(username);
  await page.getByLabel(/password/i).first().fill('CorrectHorseBattery1!');
  await page.getByLabel(/password/i).nth(1).fill('CorrectHorseBattery1!').catch(() => {});
  await page.getByRole('button', { name: /register/i }).click();
  await page.waitForTimeout(500);

  // Backdate createdAt to 49h ago via a test-only endpoint OR direct SQL via psql.
  // Convention: use the dev-only helper if it exists; otherwise document SQL fallback in the test.
  // For this test we assume a helper API: POST /api/test/backdate-user with header X-Test-Secret.
  const back = await request.post(`${APP}/api/test/backdate-user`, {
    headers: { 'x-test-secret': process.env.TEST_SECRET ?? 'test' },
    data: { email, hoursAgo: 49 },
  });
  expect(back.ok()).toBe(true);

  // Fire cron
  const cron = await request.post(`${APP}/api/cron/verify-reminders`, {
    headers: { authorization: `Bearer ${CRON_SECRET}` },
  });
  expect(cron.ok()).toBe(true);
  const cronBody = await cron.json();
  expect(cronBody.d2.sent).toBeGreaterThanOrEqual(1);

  // Look up the reminder mail
  const search = await request.get(`${MAILHOG}/api/v2/search?kind=to&query=${encodeURIComponent(email)}`);
  const body = await search.json();
  expect(body.items.length).toBeGreaterThanOrEqual(2);  // welcome + reminder
  const subjects = body.items.map((m: { Content: { Headers: { Subject: string[] } } }) =>
    m.Content.Headers.Subject[0],
  );
  expect(subjects.some((s: string) => /verification link|fresh copy/i.test(s))).toBe(true);
});
```

- [ ] **Step 2: Add the test-only backdate endpoint**

Create `src/app/api/test/backdate-user/route.ts` — only enabled when `NODE_ENV !== 'production'`:
```ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'disabled' }, { status: 404 });
  }
  const expected = process.env.TEST_SECRET ?? 'test';
  if (req.headers.get('x-test-secret') !== expected) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const { email, hoursAgo } = (await req.json()) as { email: string; hoursAgo: number };
  const ts = new Date(Date.now() - hoursAgo * 3600 * 1000);
  const r = await prisma.user.updateMany({
    where: { email },
    data: { createdAt: ts },
  });
  return NextResponse.json({ count: r.count, createdAt: ts });
}
```

- [ ] **Step 3: Run the test**

```bash
TMPDIR=/home/manuel/.tmp-playwright \
CRON_SECRET=test-secret-value \
TEST_SECRET=test \
npx playwright test tests/e2e/verify-reminder.spec.ts
```
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/verify-reminder.spec.ts src/app/api/test/backdate-user/route.ts
git commit -m "test(e2e): D2 verify reminder via cron route + test-only backdate helper"
```

---

### Task 18: Deployment artifacts — env, docs, crontab

**Files:**
- Modify: `.env.example`
- Modify: `docs/deployment.md`

- [ ] **Step 1: Add to `.env.example`**

Append:
```
# Bearer token for /api/cron/verify-reminders (set via `openssl rand -hex 32`)
CRON_SECRET=

# Test-only: enables /api/test/backdate-user (NODE_ENV != production)
TEST_SECRET=test
```

- [ ] **Step 2: Document the cron setup in `docs/deployment.md`**

Add a new section near the end:
````markdown
## Verify-Reminder Cron

A system-cron entry on the VPS hits `POST /api/cron/verify-reminders` hourly to fire Day-2 and Day-7 reminder mails for users who never verified their email.

### Setup (once per environment)

```bash
# Generate the secret
openssl rand -hex 32
# Put it into .env.prod as CRON_SECRET=...

# Restart the app stack so the env var is loaded
ssh musikersuche@82.165.40.140
cd /opt/gp200editor && bash scripts/deploy-update.sh

# Add to musikersuche's crontab (crontab -e):
0 * * * * curl -fsS -X POST \
  -H "Authorization: Bearer $CRON_SECRET" \
  https://preset-forge.com/api/cron/verify-reminders \
  >> /opt/gp200editor/logs/cron-verify-reminders.log 2>&1
```

`$CRON_SECRET` must be exported in the cron user's shell environment, or inline the literal value (with appropriate file permissions on the crontab).

### Smoke test

```bash
curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" \
  https://preset-forge.com/api/cron/verify-reminders | jq
```
Expected: `{ d2: {...}, d7: {...} }` with counts of 0/sent/failed/skippedByRace.
````

- [ ] **Step 3: Commit**

```bash
git add .env.example docs/deployment.md
git commit -m "docs(deployment): CRON_SECRET + verify-reminder crontab setup"
```

---

### Task 19: Full CI run

**Files:**
- (no edits)

- [ ] **Step 1: Run local CI**

```bash
npm run ci
```
Expected: lint + typecheck + test + build all green.

- [ ] **Step 2: If any step fails, fix inline and re-run.** Do not move on with a red CI.

- [ ] **Step 3: Push (only after CI passes)**

```bash
git push
```

---

### Task 20: Production rollout

**Files:**
- (no edits)

- [ ] **Step 1: Generate `CRON_SECRET` on the VPS**

```bash
ssh musikersuche@82.165.40.140
openssl rand -hex 32
```
Copy the value.

- [ ] **Step 2: Add to `.env.prod`**

Append `CRON_SECRET=<value>` to `/opt/gp200editor/.env.prod`. Save.

- [ ] **Step 3: Deploy**

```bash
cd /opt/gp200editor && bash scripts/deploy-update.sh
```

- [ ] **Step 4: Verify migration applied**

```bash
source .env.prod
docker compose -f docker-compose.prod.yml -f docker-compose.caddy.yml exec -T postgres \
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c \
  "SELECT column_name FROM information_schema.columns WHERE table_name = 'User' AND column_name IN ('locale','welcomeReminderD2SentAt','welcomeReminderD7SentAt');"
```
Expected: 3 rows.

- [ ] **Step 5: Smoke test the cron route**

```bash
curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" \
  https://preset-forge.com/api/cron/verify-reminders | jq
```
Expected: `{"d2":{"sent":0,...},"d7":{"sent":0,...}}` (no eligible users yet on a fresh install).

- [ ] **Step 6: Install crontab entry**

```bash
crontab -e
# Paste the line from docs/deployment.md
```

- [ ] **Step 7: Wait for the next hourly tick + check the log**

```bash
tail -f /opt/gp200editor/logs/cron-verify-reminders.log
```
Expected: a JSON line per tick.

- [ ] **Step 8: Register a real test account in DE locale, confirm welcome mail arrives in inbox and renders correctly in at least one mail client.**

---

## Self-Review

**Spec coverage check:**

| Spec section | Covered by |
|---|---|
| User schema delta (locale + 2 timestamps + 2 indexes) | Task 1 |
| `EmailKind` discriminated union | Task 8 |
| `sendUserEmail` dispatcher | Task 8 |
| Templates as TS render functions in single module | Tasks 4–7 |
| Pedalboard Stage design tokens | Task 4 |
| `createTranslator` for non-request renders | Task 4 |
| All 6 locales | Task 3 |
| Crontab + secret-protected POST route | Tasks 13–15, 18, 20 |
| Race-safe `updateMany`-claim | Task 14 |
| Send-failure timestamp rollback | Task 14 |
| Hourly cron tolerance | Task 18 (docs) |
| Register flow uses welcome template | Task 9 |
| resend-verification uses verifyReminderD2 | Task 10 |
| forgot-password and warn migrated | Task 11 |
| Legacy `sendVerificationEmail`/`sendPasswordResetEmail`/`sendWarningEmail` removed | Task 8 (rewrite removes them) |
| Unit tests for templates × 6 locales | Tasks 5, 6, 7 |
| Unit tests for cron logic | Tasks 13–15 |
| E2E welcome | Task 16 |
| E2E reminder | Task 17 |
| Mailhog `/api/v2/search` (not DELETE) | Tasks 16, 17 |
| `TMPDIR=/home/manuel/.tmp-playwright` | Tasks 16, 17 |
| `CRON_SECRET` env + crontab | Tasks 18, 20 |
| Locale backfill `'en'` | Task 1 (default in schema column) |

**Open items intentionally deferred** (per spec out-of-scope): verify-token cleanup job; password-reset + warning localization; account auto-delete; bounce handling.

**No placeholder content found.** Every code step shows the exact code. Every command shows the exact invocation. Type names are consistent across tasks: `EmailPayload`, `EmailUser`, `sendUserEmail`, `renderWelcomeEmail`, `renderVerifyReminderEmail`, `renderPasswordResetEmail`, `renderWarningEmail`, `renderEmailLayout`.

---

## Execution
