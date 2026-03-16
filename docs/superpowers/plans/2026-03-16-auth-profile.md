# Auth & Profile Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement user authentication, profile management, and avatar uploads for the GP-200 Preset Sharing platform.

**Architecture:** Lucia v3 sessions in PostgreSQL (Prisma), Argon2id password hashing, avatar images in Garage Object Store served via Next.js proxy, password reset via email (Nodemailer + Mailhog in dev).

**Tech Stack:** Next.js 14 App Router · Lucia v3 · Prisma · PostgreSQL 16 · Argon2id (`@node-rs/argon2`) · Garage S3 (`@aws-sdk/client-s3`) · sharp · Nodemailer · Zod v4 · Tailwind CSS · Vitest (unit) · Playwright (E2E)

**Spec:** `docs/superpowers/specs/2026-03-16-auth-profile-design.md`

---

## File Map

### New files

| File | Responsibility |
|------|---------------|
| `docker-compose.yml` | postgres, mailhog, garage, app services |
| `garage.toml` | Garage single-node config (mounted into container) |
| `scripts/garage-init.sh` | One-time bucket + access key setup |
| `.env.local.example` | Documented env vars for local dev |
| `prisma/schema.prisma` | User, Session, PasswordResetToken models |
| `src/lib/prisma.ts` | Prisma client singleton (dev-safe global) |
| `src/lib/auth.ts` | Lucia instance + Prisma adapter + type augmentation |
| `src/lib/session.ts` | `validateSession()` + `refreshSessionCookie()` helpers |
| `src/lib/validators.ts` | All Zod input schemas |
| `src/lib/email.ts` | `sendPasswordResetEmail()` via Nodemailer |
| `src/lib/storage.ts` | `uploadAvatar()`, `deleteAvatar()`, `getAvatarStream()` |
| `src/app/api/auth/register/route.ts` | POST: create user + session |
| `src/app/api/auth/login/route.ts` | POST: verify credentials + session |
| `src/app/api/auth/logout/route.ts` | POST: invalidate session |
| `src/app/api/auth/forgot-password/route.ts` | POST: send reset email |
| `src/app/api/auth/reset-password/route.ts` | POST: consume token + update password |
| `src/app/api/profile/route.ts` | GET + PATCH own profile |
| `src/app/api/profile/avatar/route.ts` | POST: upload + convert avatar to Garage |
| `src/app/api/avatar/[key]/route.ts` | GET: proxy avatar from Garage (public) |
| `src/app/[locale]/auth/login/page.tsx` | Login form |
| `src/app/[locale]/auth/register/page.tsx` | Register form |
| `src/app/[locale]/auth/forgot-password/page.tsx` | Forgot password form |
| `src/app/[locale]/auth/reset-password/page.tsx` | Reset password form |
| `src/app/[locale]/profile/page.tsx` | Own profile page (Server Component shell) |
| `src/app/[locale]/profile/ProfileEditForm.tsx` | Own profile edit form (Client Component) |
| `src/app/[locale]/profile/[username]/page.tsx` | Other user profile (read-only) |
| `tests/unit/lib/validators.test.ts` | Unit tests for Zod schemas |
| `tests/e2e/auth.spec.ts` | E2E auth flows |
| `tests/e2e/profile.spec.ts` | E2E profile flows |

### Modified files

| File | Change |
|------|--------|
| `Dockerfile` | Add `npx prisma generate` in builder stage |
| `src/middleware.ts` | Add session-cookie check to protect `/profile/*` |
| `src/components/Navbar.tsx` | Add Login / Profile nav links |
| `messages/en.json` | Add `auth` and `profile` translation namespaces |
| `messages/de.json` | Add `auth` and `profile` translation namespaces |
| `package.json` | New runtime + dev dependencies |

---

## Chunk 1: Infrastructure & Database

### Task 1: Install dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install runtime dependencies**

```bash
npm install lucia @lucia-auth/adapter-prisma @node-rs/argon2 @aws-sdk/client-s3 sharp nodemailer @prisma/client
```

- [ ] **Step 2: Install dev dependencies**

```bash
npm install --save-dev prisma @types/nodemailer
```

- [ ] **Step 3: Initialize Prisma**

```bash
npx prisma init --datasource-provider postgresql
```

Expected: creates `prisma/schema.prisma`. Remove the generated `.env` (we use `.env.local`):

```bash
rm -f .env
```

---

### Task 2: Docker Compose + Garage config

**Files:**
- Create: `docker-compose.yml`
- Create: `garage.toml`
- Create: `.env.local.example`

- [ ] **Step 1: Create `docker-compose.yml`**

```yaml
services:
  # Local dev: use "npm run dev" instead of this service.
  # For production container builds, run: docker compose up app
  app:
    build: .
    ports:
      - "3000:3000"
    env_file:
      - .env.local
    depends_on:
      - postgres
      - garage
      - mailhog

  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: gp200
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  mailhog:
    image: mailhog/mailhog:latest
    ports:
      - "1025:1025"   # SMTP
      - "8025:8025"   # Web UI

  garage:
    image: dxflrs/garage:v1
    ports:
      - "3900:3900"   # S3 API
      - "3902:3902"   # Admin API
    volumes:
      - garage_data:/var/lib/garage/data
      - garage_meta:/var/lib/garage/meta
      - ./garage.toml:/etc/garage.toml:ro
    command: /garage -c /etc/garage.toml server

volumes:
  postgres_data:
  garage_data:
  garage_meta:
```

- [ ] **Step 2: Create `garage.toml`**

```toml
metadata_dir = "/var/lib/garage/meta"
data_dir     = "/var/lib/garage/data"

replication_factor = 1

# Required: random hex string, any value works for single-node dev
rpc_secret = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"

rpc_bind_addr = "0.0.0.0:3901"

[s3_api]
s3_region     = "garage"
api_bind_addr = "0.0.0.0:3900"

[admin]
api_bind_addr = "0.0.0.0:3902"
```

- [ ] **Step 3: Create `.env.local.example`**

```
# Copy to .env.local and fill in values

DATABASE_URL=postgresql://postgres:postgres@localhost:5432/gp200

# Garage Object Store — run scripts/garage-init.sh once to get these values
GARAGE_ENDPOINT=http://localhost:3900
GARAGE_ACCESS_KEY_ID=<from garage-init.sh output>
GARAGE_SECRET_ACCESS_KEY=<from garage-init.sh output>
GARAGE_BUCKET=avatars

# Email (Mailhog in dev — no user/pass needed)
EMAIL_FROM=noreply@gp200editor.local
EMAIL_SMTP_HOST=localhost
EMAIL_SMTP_PORT=1025
EMAIL_SMTP_USER=
EMAIL_SMTP_PASS=

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

### Task 3: Garage init script

**Files:**
- Create: `scripts/garage-init.sh`

- [ ] **Step 1: Create `scripts/garage-init.sh`**

```bash
#!/usr/bin/env bash
set -euo pipefail

echo "→ Waiting for Garage to start..."
until docker compose exec -T garage /garage status > /dev/null 2>&1; do sleep 1; done

echo "→ Getting node ID..."
NODE_ID=$(docker compose exec -T garage /garage node id 2>/dev/null | awk 'NR==1{print $1}')

echo "→ Assigning layout (zone=dc1, capacity=1G)..."
docker compose exec -T garage /garage layout assign --zone dc1 --capacity 1G "$NODE_ID"
docker compose exec -T garage /garage layout apply --version 1

echo "→ Creating access key 'gp200editor-key'..."
docker compose exec -T garage /garage key create gp200editor-key

echo "→ Creating bucket 'avatars'..."
docker compose exec -T garage /garage bucket create avatars

echo "→ Granting bucket access..."
docker compose exec -T garage /garage bucket allow avatars --read --write --key gp200editor-key

echo ""
echo "✅ Garage initialized! Add these values to .env.local:"
echo ""
docker compose exec -T garage /garage key info gp200editor-key
```

Note: the `--capacity` flag syntax (`1G`, `1T`, etc.) and the exact subcommand names may vary slightly across Garage v1 minor releases. Check `docker compose exec garage /garage --help` if a command fails.

- [ ] **Step 2: Make executable**

```bash
chmod +x scripts/garage-init.sh
```

---

### Task 4: Update Dockerfile

**Files:**
- Modify: `Dockerfile`

The builder stage must run `npx prisma generate` so the Prisma client is generated before `npm run build`.

- [ ] **Step 1: Add `prisma generate` to builder stage**

In `Dockerfile`, find the builder stage and insert `RUN npx prisma generate` after `COPY . .`:

```dockerfile
# ── Builder ───────────────────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build
```

---

### Task 5: Prisma schema

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Replace generated schema with our models**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id           String   @id @default(cuid())
  email        String   @unique
  username     String   @unique
  passwordHash String
  bio          String?
  website      String?
  avatarKey    String?
  createdAt    DateTime @default(now())

  sessions    Session[]
  resetTokens PasswordResetToken[]
}

model Session {
  id        String   @id
  userId    String
  expiresAt DateTime

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model PasswordResetToken {
  id        String    @id @default(cuid())
  tokenHash String    @unique
  userId    String
  expiresAt DateTime
  usedAt    DateTime?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

---

### Task 6: Run migration

**Files:**
- Creates: `prisma/migrations/`

- [ ] **Step 1: Start postgres**

```bash
docker compose up -d postgres
```

- [ ] **Step 2: Wait for postgres to be ready**

```bash
until docker compose exec postgres pg_isready -U postgres; do sleep 1; done
```

Expected: `localhost:5432 - accepting connections`

- [ ] **Step 3: Create `.env.local` from example**

```bash
cp .env.local.example .env.local
```

The `DATABASE_URL` is already correct for local dev — no changes needed yet.

- [ ] **Step 4: Run migration**

```bash
npx prisma migrate dev --name init
```

Expected output includes: `The following migration(s) have been created and applied`

- [ ] **Step 5: Verify schema**

```bash
npx prisma validate
```

Expected: `The schema at prisma/schema.prisma is valid`

---

### Task 7: Commit

- [ ] **Commit**

```bash
git add docker-compose.yml garage.toml scripts/garage-init.sh .env.local.example prisma/ Dockerfile package.json package-lock.json
git commit -m "feat: add infrastructure (postgres, mailhog, garage) and prisma schema"
```

---

## Chunk 2: Core Libraries + Validators

### Task 8: Validators (TDD)

**Files:**
- Create: `src/lib/validators.ts`
- Create: `tests/unit/lib/validators.test.ts`

- [ ] **Step 1: Write failing tests first**

Create `tests/unit/lib/validators.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  patchProfileSchema,
} from '@/lib/validators';

describe('registerSchema', () => {
  it('accepts valid input', () => {
    const result = registerSchema.safeParse({ email: 'a@b.com', username: 'alice_01', password: 'secret12' });
    expect(result.success).toBe(true);
  });
  it('rejects invalid email', () => {
    expect(registerSchema.safeParse({ email: 'notanemail', username: 'alice', password: 'secret12' }).success).toBe(false);
  });
  it('rejects username shorter than 3 chars', () => {
    expect(registerSchema.safeParse({ email: 'a@b.com', username: 'ab', password: 'secret12' }).success).toBe(false);
  });
  it('rejects username with special chars', () => {
    expect(registerSchema.safeParse({ email: 'a@b.com', username: 'alice!', password: 'secret12' }).success).toBe(false);
  });
  it('rejects password shorter than 8 chars', () => {
    expect(registerSchema.safeParse({ email: 'a@b.com', username: 'alice', password: 'short' }).success).toBe(false);
  });
  it('rejects username longer than 30 chars', () => {
    expect(registerSchema.safeParse({ email: 'a@b.com', username: 'a'.repeat(31), password: 'secret12' }).success).toBe(false);
  });
});

describe('loginSchema', () => {
  it('accepts valid input', () => {
    expect(loginSchema.safeParse({ email: 'a@b.com', password: 'x' }).success).toBe(true);
  });
  it('rejects invalid email', () => {
    expect(loginSchema.safeParse({ email: 'notanemail', password: 'pass' }).success).toBe(false);
  });
  it('rejects empty password', () => {
    expect(loginSchema.safeParse({ email: 'a@b.com', password: '' }).success).toBe(false);
  });
});

describe('forgotPasswordSchema', () => {
  it('accepts valid email', () => {
    expect(forgotPasswordSchema.safeParse({ email: 'a@b.com' }).success).toBe(true);
  });
  it('rejects non-email', () => {
    expect(forgotPasswordSchema.safeParse({ email: 'notvalid' }).success).toBe(false);
  });
});

describe('resetPasswordSchema', () => {
  it('accepts valid input', () => {
    expect(resetPasswordSchema.safeParse({ token: 'abc', newPassword: 'newpass1' }).success).toBe(true);
  });
  it('rejects empty token', () => {
    expect(resetPasswordSchema.safeParse({ token: '', newPassword: 'newpass1' }).success).toBe(false);
  });
  it('rejects short password', () => {
    expect(resetPasswordSchema.safeParse({ token: 'abc', newPassword: 'short' }).success).toBe(false);
  });
});

describe('patchProfileSchema', () => {
  it('accepts all nullish', () => {
    expect(patchProfileSchema.safeParse({}).success).toBe(true);
  });
  it('accepts bio and website', () => {
    expect(patchProfileSchema.safeParse({ bio: 'Hello', website: 'https://example.com' }).success).toBe(true);
  });
  it('accepts null values (field clear)', () => {
    expect(patchProfileSchema.safeParse({ bio: null, website: null }).success).toBe(true);
  });
  it('rejects bio longer than 500 chars', () => {
    expect(patchProfileSchema.safeParse({ bio: 'x'.repeat(501) }).success).toBe(false);
  });
  it('rejects invalid website URL', () => {
    expect(patchProfileSchema.safeParse({ website: 'not-a-url' }).success).toBe(false);
  });
  it('preserves null for bio (does not coerce to undefined)', () => {
    const result = patchProfileSchema.safeParse({ bio: null });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.bio).toBeNull();
  });
});
```

- [ ] **Step 2: Run — verify tests fail**

```bash
npm test -- tests/unit/lib/validators.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/validators'`

- [ ] **Step 3: Create `src/lib/validators.ts`**

```typescript
import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email(),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be at most 30 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Only letters, numbers, and underscores'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const loginSchema = z.object({
  email: z.string().email(),
  // min(1) not min(8): don't reject a login attempt just because the password
  // is shorter than our current minimum — the user might have an old account
  password: z.string().min(1),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

export const patchProfileSchema = z.object({
  bio: z.string().max(500, 'Bio must be at most 500 characters').nullable().optional(),
  website: z.string().url('Invalid URL').nullable().optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type PatchProfileInput = z.infer<typeof patchProfileSchema>;
```

- [ ] **Step 4: Run — verify tests pass**

```bash
npm test -- tests/unit/lib/validators.test.ts
```

Expected: PASS — all 19 tests

---

### Task 9: Prisma client singleton

**Files:**
- Create: `src/lib/prisma.ts`

- [ ] **Step 1: Create `src/lib/prisma.ts`**

```typescript
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

---

### Task 10: Lucia auth instance

**Files:**
- Create: `src/lib/auth.ts`

- [ ] **Step 1: Create `src/lib/auth.ts`**

```typescript
import { Lucia } from 'lucia';
import { PrismaAdapter } from '@lucia-auth/adapter-prisma';
import { prisma } from './prisma';

const adapter = new PrismaAdapter(prisma.session, prisma.user);

export const lucia = new Lucia(adapter, {
  sessionCookie: {
    // Default cookie name: "auth_session" — referenced in middleware.ts
    attributes: {
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      httpOnly: true,
    },
  },
  getUserAttributes: (attributes) => ({
    username: attributes.username,
    email: attributes.email,
  }),
});

declare module 'lucia' {
  interface Register {
    Lucia: typeof lucia;
    DatabaseUserAttributes: {
      username: string;
      email: string;
    };
  }
}
```

---

### Task 11: Session validation + refresh helpers

**Files:**
- Create: `src/lib/session.ts`

- [ ] **Step 1: Create `src/lib/session.ts`**

```typescript
import { lucia } from './auth';
import { cookies } from 'next/headers';
import type { User, Session } from 'lucia';

export type SessionResult =
  | { user: User; session: Session }
  | { user: null; session: null };

/**
 * Validates the session cookie. Use in Server Components and Route Handlers.
 */
export async function validateSession(): Promise<SessionResult> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(lucia.sessionCookieName)?.value ?? null;
  if (!sessionId) return { user: null, session: null };
  return lucia.validateSession(sessionId);
}

/**
 * Call from Route Handlers after validateSession() to extend a near-expiry session.
 * Lucia sets session.fresh = true when it has extended the expiry.
 * Server Components cannot set cookies, so skip this call there.
 */
export async function refreshSessionCookie(session: Session): Promise<void> {
  if (!session.fresh) return;
  const cookieStore = await cookies();
  const cookie = lucia.createSessionCookie(session.id);
  cookieStore.set(cookie.name, cookie.value, cookie.attributes);
}
```

---

### Task 12: Commit

- [ ] **Commit**

```bash
git add src/lib/validators.ts src/lib/prisma.ts src/lib/auth.ts src/lib/session.ts tests/unit/lib/validators.test.ts
git commit -m "feat: add validators, prisma singleton, lucia auth, session helpers"
```

---

## Chunk 3: Email & Storage Libraries

### Task 13: Email library

**Files:**
- Create: `src/lib/email.ts`

- [ ] **Step 1: Create `src/lib/email.ts`**

```typescript
import nodemailer from 'nodemailer';

function getTransporter() {
  return nodemailer.createTransport({
    host: process.env.EMAIL_SMTP_HOST!,
    port: Number(process.env.EMAIL_SMTP_PORT ?? 1025),
    // For production with port 465 (TLS), add: secure: true
    auth: process.env.EMAIL_SMTP_USER
      ? { user: process.env.EMAIL_SMTP_USER, pass: process.env.EMAIL_SMTP_PASS }
      : undefined,
  });
}

export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string,
): Promise<void> {
  await getTransporter().sendMail({
    from: process.env.EMAIL_FROM!,
    to,
    subject: 'Reset your password — GP-200 Editor',
    html: `
      <p>Click the link below to reset your password. It expires in 1&nbsp;hour.</p>
      <p><a href="${resetUrl}">${resetUrl}</a></p>
      <p>If you did not request this, you can safely ignore this email.</p>
    `,
  });
}
```

---

### Task 14: Storage library

**Files:**
- Create: `src/lib/storage.ts`

- [ ] **Step 1: Create `src/lib/storage.ts`**

```typescript
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import type { Readable } from 'stream';

function getClient() {
  return new S3Client({
    endpoint: process.env.GARAGE_ENDPOINT!,
    region: 'garage',
    credentials: {
      accessKeyId: process.env.GARAGE_ACCESS_KEY_ID!,
      secretAccessKey: process.env.GARAGE_SECRET_ACCESS_KEY!,
    },
    forcePathStyle: true, // required for Garage and other S3-compatible stores
  });
}

function bucket() {
  return process.env.GARAGE_BUCKET!;
}

export async function uploadAvatar(key: string, body: Buffer): Promise<void> {
  await getClient().send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      Body: body,
      ContentType: 'image/webp',
    }),
  );
}

export async function deleteAvatar(key: string): Promise<void> {
  await getClient().send(
    new DeleteObjectCommand({ Bucket: bucket(), Key: key }),
  );
}

export async function getAvatarStream(key: string): Promise<Readable> {
  const response = await getClient().send(
    new GetObjectCommand({ Bucket: bucket(), Key: key }),
  );
  return response.Body as Readable;
}
```

---

### Task 15: Commit

- [ ] **Commit**

```bash
git add src/lib/email.ts src/lib/storage.ts
git commit -m "feat: add email and storage libraries"
```

---

## Chunk 4: Auth API Routes

**TDD order:** E2E tests are written first (Task 16), then routes are implemented (Tasks 17–21). The E2E tests will fail until the UI pages are built in Chunk 7 — that is expected and correct for TDD.

### Task 16: Write E2E auth tests first (TDD)

**Files:**
- Create: `tests/e2e/auth.spec.ts`

- [ ] **Step 1: Create `tests/e2e/auth.spec.ts`**

```typescript
import { test, expect } from '@playwright/test';

const UNIQUE = () => `user_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

test.describe('Auth flows', () => {
  test('register → auto-login → redirected to profile', async ({ page }) => {
    const username = UNIQUE();
    const email = `${username}@test.com`;

    await page.goto('/en/auth/register');
    await page.fill('[name="email"]', email);
    await page.fill('[name="username"]', username);
    await page.fill('[name="password"]', 'testpass123');
    await page.click('[type="submit"]');

    await page.waitForURL('**/profile');
    await expect(page.locator('h1')).toBeVisible();
  });

  test('login with wrong password shows error', async ({ page }) => {
    await page.goto('/en/auth/login');
    await page.fill('[name="email"]', 'nobody@example.com');
    await page.fill('[name="password"]', 'wrongpass');
    await page.click('[type="submit"]');

    await expect(page.locator('text=Invalid email or password')).toBeVisible();
  });

  test('register then login then logout', async ({ page }) => {
    const username = UNIQUE();
    const email = `${username}@test.com`;
    const password = 'testpass123';

    await page.goto('/en/auth/register');
    await page.fill('[name="email"]', email);
    await page.fill('[name="username"]', username);
    await page.fill('[name="password"]', password);
    await page.click('[type="submit"]');
    await page.waitForURL('**/profile');

    await page.click('[data-testid="nav-logout"]');
    await page.waitForURL('**/auth/login');

    await page.fill('[name="email"]', email);
    await page.fill('[name="password"]', password);
    await page.click('[type="submit"]');
    await page.waitForURL('**/profile');
  });

  test('forgot password sends email to Mailhog', async ({ page, request }) => {
    const username = UNIQUE();
    const email = `${username}@test.com`;

    // Register
    await page.goto('/en/auth/register');
    await page.fill('[name="email"]', email);
    await page.fill('[name="username"]', username);
    await page.fill('[name="password"]', 'testpass123');
    await page.click('[type="submit"]');
    await page.waitForURL('**/profile');

    // Logout
    await page.click('[data-testid="nav-logout"]');

    // Forgot password
    await page.goto('/en/auth/forgot-password');
    await page.fill('[name="email"]', email);
    await page.click('[type="submit"]');
    await expect(page.locator('[data-testid="forgot-password-sent"]')).toBeVisible();

    // Verify email in Mailhog
    const mailhog = await request.get('http://localhost:8025/api/v2/messages');
    const messages = await mailhog.json();
    const resetEmail = messages.items?.find(
      (m: { To: Array<{ Mailbox: string; Domain: string }> }) =>
        `${m.To[0].Mailbox}@${m.To[0].Domain}` === email,
    );
    expect(resetEmail).toBeDefined();
  });

  test('unauthenticated user is redirected from /profile to /auth/login', async ({ page }) => {
    await page.goto('/en/profile');
    await page.waitForURL('**/auth/login');
  });
});
```

- [ ] **Step 2: Run — verify tests fail (expected at this point)**

```bash
npm run test:e2e -- tests/e2e/auth.spec.ts
```

Expected: tests FAIL because the register/login pages don't exist yet. This is the correct TDD red state. The test will show navigation errors or missing elements — that is expected.

---

### Task 17: Register route

**Files:**
- Create: `src/app/api/auth/register/route.ts`

- [ ] **Step 1: Create `src/app/api/auth/register/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { hash } from '@node-rs/argon2';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { lucia } from '@/lib/auth';
import { refreshSessionCookie } from '@/lib/session';
import { registerSchema } from '@/lib/validators';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0].message },
      { status: 400 },
    );
  }

  const { email, username, password } = parsed.data;

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { username }] },
    select: { email: true, username: true },
  });

  if (existing?.email === email) {
    return NextResponse.json({ error: 'Email already taken' }, { status: 409 });
  }
  if (existing?.username === username) {
    return NextResponse.json({ error: 'Username already taken' }, { status: 409 });
  }

  const passwordHash = await hash(password);

  // Let Prisma generate the CUID via @default(cuid()) in the schema
  const user = await prisma.user.create({
    data: { email, username, passwordHash },
  });

  const session = await lucia.createSession(user.id, {});
  await refreshSessionCookie(session);

  const sessionCookie = lucia.createSessionCookie(session.id);
  const cookieStore = await cookies();
  cookieStore.set(sessionCookie.name, sessionCookie.value, sessionCookie.attributes);

  return NextResponse.json({ userId: user.id }, { status: 201 });
}
```

---

### Task 18: Login route

**Files:**
- Create: `src/app/api/auth/login/route.ts`

- [ ] **Step 1: Create `src/app/api/auth/login/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { verify } from '@node-rs/argon2';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { lucia } from '@/lib/auth';
import { loginSchema } from '@/lib/validators';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 400 });
  }

  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    // Same message regardless — no user enumeration
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
  }

  const valid = await verify(user.passwordHash, password);
  if (!valid) {
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
  }

  const session = await lucia.createSession(user.id, {});
  const sessionCookie = lucia.createSessionCookie(session.id);
  const cookieStore = await cookies();
  cookieStore.set(sessionCookie.name, sessionCookie.value, sessionCookie.attributes);

  return NextResponse.json({ userId: user.id });
}
```

---

### Task 19: Logout route

**Files:**
- Create: `src/app/api/auth/logout/route.ts`

- [ ] **Step 1: Create `src/app/api/auth/logout/route.ts`**

```typescript
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { lucia } from '@/lib/auth';
import { validateSession } from '@/lib/session';

export async function POST() {
  const { session } = await validateSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await lucia.invalidateSession(session.id);

  const cookieStore = await cookies();
  const blank = lucia.createBlankSessionCookie();
  cookieStore.set(blank.name, blank.value, blank.attributes);

  return NextResponse.json({});
}
```

---

### Task 20: Forgot-password route

**Files:**
- Create: `src/app/api/auth/forgot-password/route.ts`

- [ ] **Step 1: Create `src/app/api/auth/forgot-password/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { sendPasswordResetEmail } from '@/lib/email';
import { forgotPasswordSchema } from '@/lib/validators';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = forgotPasswordSchema.safeParse(body);

  // Always 200 — no user enumeration, even on bad input
  if (!parsed.success) return NextResponse.json({});

  const { email } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });

  if (user) {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.passwordResetToken.create({
      data: { tokenHash, userId: user.id, expiresAt },
    });

    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/en/auth/reset-password?token=${rawToken}`;
    // SMTP errors propagate as 500 (intentional — user knows to retry)
    await sendPasswordResetEmail(email, resetUrl);
  }

  return NextResponse.json({});
}
```

---

### Task 21: Reset-password route

**Files:**
- Create: `src/app/api/auth/reset-password/route.ts`

- [ ] **Step 1: Create `src/app/api/auth/reset-password/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { hash } from '@node-rs/argon2';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { lucia } from '@/lib/auth';
import { resetPasswordSchema } from '@/lib/validators';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = resetPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const { token, newPassword } = parsed.data;
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
  });

  if (
    !resetToken ||
    resetToken.expiresAt < new Date() ||
    resetToken.usedAt !== null
  ) {
    return NextResponse.json({ error: 'Token invalid or expired' }, { status: 400 });
  }

  const passwordHash = await hash(newPassword);

  await prisma.$transaction([
    prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash },
    }),
  ]);

  // Invalidate all existing sessions, then auto-login with a fresh session
  await lucia.invalidateUserSessions(resetToken.userId);
  const session = await lucia.createSession(resetToken.userId, {});
  const sessionCookie = lucia.createSessionCookie(session.id);
  const cookieStore = await cookies();
  cookieStore.set(sessionCookie.name, sessionCookie.value, sessionCookie.attributes);

  return NextResponse.json({});
}
```

---

### Task 22: Commit

- [ ] **Commit**

```bash
git add src/app/api/auth/ tests/e2e/auth.spec.ts
git commit -m "feat: add auth API routes (register, login, logout, forgot-password, reset-password)"
```

---

## Chunk 5: Profile API Routes + Avatar Proxy

### Task 23: Profile GET + PATCH

**Files:**
- Create: `src/app/api/profile/route.ts`

- [ ] **Step 1: Create `src/app/api/profile/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateSession, refreshSessionCookie } from '@/lib/session';
import { patchProfileSchema } from '@/lib/validators';

function toResponse(user: {
  id: string;
  username: string;
  email: string;
  bio: string | null;
  website: string | null;
  avatarKey: string | null;
  createdAt: Date;
}) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    bio: user.bio,
    website: user.website,
    avatarUrl: user.avatarKey ? `/api/avatar/${user.avatarKey}` : null,
    createdAt: user.createdAt.toISOString(),
  };
}

export async function GET() {
  const { user, session } = await validateSession();
  if (!user || !session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  await refreshSessionCookie(session);

  const dbUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  return NextResponse.json(toResponse(dbUser));
}

export async function PATCH(request: NextRequest) {
  const { user, session } = await validateSession();
  if (!user || !session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  await refreshSessionCookie(session);

  const body = await request.json().catch(() => null);
  const parsed = patchProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  // Build update object carefully:
  // - undefined (field absent) → Prisma skips the field (no-op)
  // - null (field explicitly cleared) → Prisma sets column to NULL
  // The ?? undefined pattern must NOT be used here as it collapses null to undefined.
  const data: { bio?: string | null; website?: string | null } = {};
  if (parsed.data.bio !== undefined) data.bio = parsed.data.bio;
  if (parsed.data.website !== undefined) data.website = parsed.data.website;

  const updated = await prisma.user.update({ where: { id: user.id }, data });
  return NextResponse.json(toResponse(updated));
}
```

---

### Task 24: Avatar upload route

**Files:**
- Create: `src/app/api/profile/avatar/route.ts`

- [ ] **Step 1: Create `src/app/api/profile/avatar/route.ts`**

```typescript
import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { prisma } from '@/lib/prisma';
import { validateSession, refreshSessionCookie } from '@/lib/session';
import { uploadAvatar, deleteAvatar } from '@/lib/storage';

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export async function POST(request: Request) {
  const { user, session } = await validateSession();
  if (!user || !session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  await refreshSessionCookie(session);

  const formData = await request.formData().catch(() => null);
  const file = formData?.get('avatar');

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: 'No avatar file provided' }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: 'Unsupported file type. Use JPEG, PNG, or WebP.' },
      { status: 400 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'File too large. Max 5 MB.' }, { status: 400 });
  }

  const input = Buffer.from(await file.arrayBuffer());
  const webp = await sharp(input)
    // fit: 'inside' preserves aspect ratio; image scaled down to fit within 512×512
    .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
    .webp()
    .toBuffer();

  const newKey = `user-${user.id}-${Date.now()}.webp`;

  // Upload new object, then update DB, then delete old (safest order)
  await uploadAvatar(newKey, webp);

  const dbUser = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { avatarKey: true },
  });

  await prisma.user.update({ where: { id: user.id }, data: { avatarKey: newKey } });

  // Best-effort delete of old avatar after DB update
  if (dbUser.avatarKey) {
    await deleteAvatar(dbUser.avatarKey).catch(() => {});
  }

  return NextResponse.json({ avatarUrl: `/api/avatar/${newKey}` });
}
```

---

### Task 25: Avatar proxy route

**Files:**
- Create: `src/app/api/avatar/[key]/route.ts`

- [ ] **Step 1: Create `src/app/api/avatar/[key]/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAvatarStream } from '@/lib/storage';

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ key: string }> },
) {
  const { key } = await params;

  try {
    const stream = await getAvatarStream(key);

    const webStream = new ReadableStream({
      start(controller) {
        stream.on('data', (chunk: Buffer) => controller.enqueue(chunk));
        stream.on('end', () => controller.close());
        stream.on('error', (err) => controller.error(err));
      },
    });

    return new Response(webStream, {
      headers: {
        'Content-Type': 'image/webp',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
}
```

---

### Task 26: Profile E2E tests

**Files:**
- Create: `tests/e2e/profile.spec.ts`

- [ ] **Step 1: Create `tests/e2e/profile.spec.ts`**

```typescript
import { test, expect } from '@playwright/test';

const UNIQUE = () => `user_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

async function registerAndLogin(page: import('@playwright/test').Page) {
  const username = UNIQUE();
  const email = `${username}@test.com`;
  await page.goto('/en/auth/register');
  await page.fill('[name="email"]', email);
  await page.fill('[name="username"]', username);
  await page.fill('[name="password"]', 'testpass123');
  await page.click('[type="submit"]');
  await page.waitForURL('**/profile');
  return { username, email };
}

test.describe('Profile page', () => {
  test('shows own username after login', async ({ page }) => {
    const { username } = await registerAndLogin(page);
    await expect(page.locator(`text=${username}`)).toBeVisible();
  });

  test('can update bio and it persists', async ({ page }) => {
    await registerAndLogin(page);
    await page.fill('[name="bio"]', 'Guitar enthusiast');
    await page.click('[data-testid="save-profile"]');
    await expect(page.locator('[data-testid="save-success"]')).toBeVisible();

    await page.reload();
    await expect(page.locator('[name="bio"]')).toHaveValue('Guitar enthusiast');
  });

  test('other user profile page shows username and no edit form', async ({ page }) => {
    const { username: user1 } = await registerAndLogin(page);

    // Logout and register user2 to get a second session
    await page.click('[data-testid="nav-logout"]');
    const username2 = UNIQUE();
    await page.goto('/en/auth/register');
    await page.fill('[name="email"]', `${username2}@test.com`);
    await page.fill('[name="username"]', username2);
    await page.fill('[name="password"]', 'testpass123');
    await page.click('[type="submit"]');
    await page.waitForURL('**/profile');

    // Visit user1's read-only profile
    await page.goto(`/en/profile/${user1}`);
    await expect(page.locator(`text=@${user1}`)).toBeVisible();
    // Read-only page has no save button
    await expect(page.locator('[data-testid="save-profile"]')).not.toBeVisible();
  });
});
```

---

### Task 27: Commit

- [ ] **Commit**

```bash
git add src/app/api/profile/ src/app/api/avatar/ tests/e2e/profile.spec.ts
git commit -m "feat: add profile API routes and avatar proxy"
```

---

## Chunk 6: Middleware Update

### Task 28: Protect /profile/* routes

**Files:**
- Modify: `src/middleware.ts`

The middleware cannot import `lucia` (Prisma is not edge-compatible). It checks cookie presence only; full session validation happens inside each route/page. Lucia v3's default cookie name is `auth_session` — verify this matches `lucia.sessionCookieName` in `src/lib/auth.ts`.

- [ ] **Step 1: Replace `src/middleware.ts`**

```typescript
import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';
import { type NextRequest, NextResponse } from 'next/server';

const intlMiddleware = createMiddleware(routing);

// Lucia v3 default session cookie name — must match lucia.sessionCookieName in src/lib/auth.ts
const SESSION_COOKIE = 'auth_session';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Protect /[locale]/profile and /[locale]/profile/* routes.
  // Locale list must match routing.ts (de, en).
  const profilePattern = /^\/(de|en)(\/profile)(\/|$)/;
  if (profilePattern.test(pathname)) {
    const sessionId = request.cookies.get(SESSION_COOKIE)?.value;
    if (!sessionId) {
      const locale = pathname.startsWith('/en') ? 'en' : 'de';
      return NextResponse.redirect(
        new URL(`/${locale}/auth/login`, request.url),
      );
    }
    // Note: only cookie presence is checked here (edge runtime can't call Prisma).
    // Full session validation happens inside each profile page/route.
  }

  return intlMiddleware(request);
}

export const config = {
  // Exclude Next.js internals, static files, and all API routes
  matcher: ['/((?!_next|_vercel|api|.*\\..*).*)'],
};
```

---

### Task 29: Commit

- [ ] **Commit**

```bash
git add src/middleware.ts
git commit -m "feat: add auth protection for /profile/* routes in middleware"
```

---

## Chunk 7: Auth Pages + i18n + Navbar

### Task 30: i18n messages

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/de.json`

- [ ] **Step 1: Update `messages/en.json`** (merge with existing content)

```json
{
  "nav": {
    "title": "GP-200 Editor",
    "home": "Home",
    "editor": "Editor",
    "login": "Sign In",
    "profile": "Profile",
    "logout": "Logout"
  },
  "auth": {
    "loginTitle": "Sign In",
    "registerTitle": "Create Account",
    "forgotPasswordTitle": "Reset Password",
    "resetPasswordTitle": "Set New Password",
    "email": "Email",
    "username": "Username",
    "password": "Password",
    "newPassword": "New Password",
    "loginButton": "Sign In",
    "registerButton": "Create Account",
    "sendResetButton": "Send Reset Email",
    "resetButton": "Set New Password",
    "loading": "Loading…",
    "loginFailed": "Invalid email or password",
    "forgotPasswordSent": "If your email is registered, you will receive a reset link shortly.",
    "resetSuccess": "Password updated. Signing you in…",
    "noAccount": "Don't have an account?",
    "register": "Sign up",
    "haveAccount": "Already have an account?",
    "login": "Sign in",
    "forgotPassword": "Forgot password?",
    "backToLogin": "Back to sign in",
    "registrationError": "Registration failed. Please try again."
  },
  "profile": {
    "title": "My Profile",
    "bio": "Bio",
    "website": "Website",
    "avatarLabel": "Profile Picture",
    "saveButton": "Save Changes",
    "saving": "Saving…",
    "saved": "Saved!",
    "saveFailed": "Failed to save. Please try again.",
    "changeAvatar": "Change Avatar",
    "memberSince": "Member since"
  }
}
```

- [ ] **Step 2: Update `messages/de.json`** (merge with existing content)

```json
{
  "nav": {
    "title": "GP-200 Editor",
    "home": "Start",
    "editor": "Editor",
    "login": "Anmelden",
    "profile": "Profil",
    "logout": "Abmelden"
  },
  "auth": {
    "loginTitle": "Anmelden",
    "registerTitle": "Konto erstellen",
    "forgotPasswordTitle": "Passwort zurücksetzen",
    "resetPasswordTitle": "Neues Passwort setzen",
    "email": "E-Mail",
    "username": "Benutzername",
    "password": "Passwort",
    "newPassword": "Neues Passwort",
    "loginButton": "Anmelden",
    "registerButton": "Konto erstellen",
    "sendResetButton": "Reset-E-Mail senden",
    "resetButton": "Neues Passwort setzen",
    "loading": "Laden…",
    "loginFailed": "Ungültige E-Mail oder falsches Passwort",
    "forgotPasswordSent": "Falls deine E-Mail registriert ist, erhältst du in Kürze einen Reset-Link.",
    "resetSuccess": "Passwort aktualisiert. Anmeldung läuft…",
    "noAccount": "Noch kein Konto?",
    "register": "Registrieren",
    "haveAccount": "Bereits ein Konto?",
    "login": "Anmelden",
    "forgotPassword": "Passwort vergessen?",
    "backToLogin": "Zurück zur Anmeldung",
    "registrationError": "Registrierung fehlgeschlagen. Bitte erneut versuchen."
  },
  "profile": {
    "title": "Mein Profil",
    "bio": "Bio",
    "website": "Website",
    "avatarLabel": "Profilbild",
    "saveButton": "Änderungen speichern",
    "saving": "Speichern…",
    "saved": "Gespeichert!",
    "saveFailed": "Speichern fehlgeschlagen.",
    "changeAvatar": "Avatar ändern",
    "memberSince": "Mitglied seit"
  }
}
```

---

### Task 31: Navbar update

**Files:**
- Modify: `src/components/Navbar.tsx`

- [ ] **Step 1: Update `src/components/Navbar.tsx`**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Link, useRouter, usePathname } from '@/i18n/routing';

export function Navbar() {
  const t = useTranslations('nav');
  const tAuth = useTranslations('auth');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [username, setUsername] = useState<string | null>(null);

  const otherLocale = locale === 'de' ? 'en' : 'de';

  useEffect(() => {
    fetch('/api/profile')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { username?: string } | null) =>
        setUsername(data?.username ?? null),
      )
      .catch(() => setUsername(null));
  }, [pathname]);

  function switchLocale() {
    router.replace(pathname, { locale: otherLocale });
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUsername(null);
    router.push('/');
    router.refresh();
  }

  return (
    <nav
      role="navigation"
      aria-label={t('title')}
      className="flex items-center justify-between px-6 py-4 bg-gray-900 text-white"
    >
      <Link href="/" className="text-xl font-bold" data-testid="nav-home-link">
        {t('title')}
      </Link>
      <div className="flex gap-4 items-center">
        <Link href="/" className="hover:underline" data-testid="nav-link-home">
          {t('home')}
        </Link>
        <Link href="/editor" className="hover:underline" data-testid="nav-link-editor">
          {t('editor')}
        </Link>
        {username ? (
          <>
            <Link href="/profile" className="hover:underline" data-testid="nav-link-profile">
              {t('profile')}
            </Link>
            <button
              onClick={handleLogout}
              data-testid="nav-logout"
              className="hover:underline text-sm"
            >
              {t('logout')}
            </button>
          </>
        ) : (
          <Link href="/auth/login" className="hover:underline" data-testid="nav-link-login">
            {tAuth('login')}
          </Link>
        )}
        <button
          onClick={switchLocale}
          aria-label={`Switch to ${otherLocale.toUpperCase()}`}
          data-testid="nav-locale-switcher"
          className="px-3 py-1 border border-white rounded hover:bg-white hover:text-gray-900 transition"
        >
          {otherLocale.toUpperCase()}
        </button>
      </div>
    </nav>
  );
}
```

---

### Task 32: Login page

**Files:**
- Create: `src/app/[locale]/auth/login/page.tsx`

- [ ] **Step 1: Create `src/app/[locale]/auth/login/page.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/routing';

export default function LoginPage() {
  const t = useTranslations('auth');
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    setLoading(false);

    if (res.ok) {
      router.push('/profile');
      router.refresh();
    } else {
      const data = await res.json();
      setError(data.error ?? t('loginFailed'));
    }
  }

  return (
    <div className="flex items-center justify-center flex-1 px-4 py-16">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold mb-6">{t('loginTitle')}</h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="email">
              {t('email')}
            </label>
            <input
              id="email"
              name="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="password">
              {t('password')}
            </label>
            <input
              id="password"
              name="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white rounded py-2 hover:bg-blue-700 disabled:opacity-50 transition"
          >
            {loading ? t('loading') : t('loginButton')}
          </button>
        </form>
        <p className="mt-4 text-sm text-center">
          {t('noAccount')}{' '}
          <Link href="/auth/register" className="text-blue-600 hover:underline">
            {t('register')}
          </Link>
        </p>
        <p className="mt-2 text-sm text-center">
          <Link href="/auth/forgot-password" className="text-blue-600 hover:underline">
            {t('forgotPassword')}
          </Link>
        </p>
      </div>
    </div>
  );
}
```

---

### Task 33: Register page

**Files:**
- Create: `src/app/[locale]/auth/register/page.tsx`

- [ ] **Step 1: Create `src/app/[locale]/auth/register/page.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/routing';

export default function RegisterPage() {
  const t = useTranslations('auth');
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, username, password }),
    });

    setLoading(false);

    if (res.ok) {
      router.push('/profile');
      router.refresh();
    } else {
      const data = await res.json();
      setError(data.error ?? t('registrationError'));
    }
  }

  return (
    <div className="flex items-center justify-center flex-1 px-4 py-16">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold mb-6">{t('registerTitle')}</h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="email">
              {t('email')}
            </label>
            <input
              id="email"
              name="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="username">
              {t('username')}
            </label>
            <input
              id="username"
              name="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              minLength={3}
              maxLength={30}
              pattern="[a-zA-Z0-9_]+"
              title="Only letters, numbers, and underscores"
              className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="password">
              {t('password')}
            </label>
            <input
              id="password"
              name="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white rounded py-2 hover:bg-blue-700 disabled:opacity-50 transition"
          >
            {loading ? t('loading') : t('registerButton')}
          </button>
        </form>
        <p className="mt-4 text-sm text-center">
          {t('haveAccount')}{' '}
          <Link href="/auth/login" className="text-blue-600 hover:underline">
            {t('login')}
          </Link>
        </p>
      </div>
    </div>
  );
}
```

---

### Task 34: Forgot-password page

**Files:**
- Create: `src/app/[locale]/auth/forgot-password/page.tsx`

- [ ] **Step 1: Create `src/app/[locale]/auth/forgot-password/page.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';

export default function ForgotPasswordPage() {
  const t = useTranslations('auth');
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    setLoading(false);
    setSent(true);
  }

  return (
    <div className="flex items-center justify-center flex-1 px-4 py-16">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold mb-6">{t('forgotPasswordTitle')}</h1>
        {sent ? (
          <div>
            <p className="text-gray-700 mb-4" data-testid="forgot-password-sent">
              {t('forgotPasswordSent')}
            </p>
            <Link href="/auth/login" className="text-blue-600 hover:underline text-sm">
              {t('backToLogin')}
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="email">
                {t('email')}
              </label>
              <input
                id="email"
                name="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white rounded py-2 hover:bg-blue-700 disabled:opacity-50 transition"
            >
              {loading ? t('loading') : t('sendResetButton')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
```

---

### Task 35: Reset-password page

**Files:**
- Create: `src/app/[locale]/auth/reset-password/page.tsx`

- [ ] **Step 1: Create `src/app/[locale]/auth/reset-password/page.tsx`**

```tsx
'use client';

import { useState, Suspense } from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useRouter } from '@/i18n/routing';

function ResetPasswordForm() {
  const t = useTranslations('auth');
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, newPassword }),
    });

    setLoading(false);

    if (res.ok) {
      router.push('/profile');
      router.refresh();
    } else {
      const data = await res.json();
      setError(data.error ?? 'Something went wrong.');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className="block text-sm font-medium mb-1" htmlFor="newPassword">
          {t('newPassword')}
        </label>
        <input
          id="newPassword"
          name="newPassword"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
          minLength={8}
          className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <button
        type="submit"
        disabled={loading || !token}
        className="w-full bg-blue-600 text-white rounded py-2 hover:bg-blue-700 disabled:opacity-50 transition"
      >
        {loading ? t('loading') : t('resetButton')}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  const t = useTranslations('auth');
  return (
    <div className="flex items-center justify-center flex-1 px-4 py-16">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold mb-6">{t('resetPasswordTitle')}</h1>
        <Suspense fallback={<p>…</p>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
```

---

### Task 36: Commit

- [ ] **Commit**

```bash
git add messages/ src/components/Navbar.tsx src/app/[locale]/auth/
git commit -m "feat: add auth pages (login, register, forgot-password, reset-password) and i18n"
```

---

## Chunk 8: Profile Pages

### Task 37: Own profile page

**Files:**
- Create: `src/app/[locale]/profile/page.tsx`
- Create: `src/app/[locale]/profile/ProfileEditForm.tsx`

- [ ] **Step 1: Create `src/app/[locale]/profile/page.tsx`**

```tsx
import { getTranslations } from 'next-intl/server';
import { redirect } from '@/i18n/routing';
import { validateSession } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import ProfileEditForm from './ProfileEditForm';

export default async function ProfilePage() {
  const { user } = await validateSession();
  // Redirect unauthenticated users (e.g., expired session with stale cookie)
  if (!user) redirect('/auth/login');

  const dbUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  const t = await getTranslations('profile');

  return (
    <div className="max-w-xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-2">{t('title')}</h1>
      <p className="text-gray-500 text-sm mb-6">
        @{dbUser.username} · {t('memberSince')}{' '}
        {dbUser.createdAt.toLocaleDateString()}
      </p>
      <ProfileEditForm
        initialData={{
          bio: dbUser.bio ?? '',
          website: dbUser.website ?? '',
          avatarUrl: dbUser.avatarKey ? `/api/avatar/${dbUser.avatarKey}` : null,
        }}
        username={dbUser.username}
      />
    </div>
  );
}
```

- [ ] **Step 2: Create `src/app/[locale]/profile/ProfileEditForm.tsx`**

```tsx
'use client';

import { useState, useRef } from 'react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';

type Props = {
  initialData: { bio: string; website: string; avatarUrl: string | null };
  username: string;
};

export default function ProfileEditForm({ initialData, username }: Props) {
  const t = useTranslations('profile');
  const [bio, setBio] = useState(initialData.bio);
  const [website, setWebsite] = useState(initialData.website);
  const [avatarUrl, setAvatarUrl] = useState(initialData.avatarUrl);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setStatus('saving');

    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bio: bio || null, website: website || null }),
    });

    setStatus(res.ok ? 'saved' : 'error');
    setTimeout(() => setStatus('idle'), 2000);
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const form = new FormData();
    form.append('avatar', file);

    const res = await fetch('/api/profile/avatar', { method: 'POST', body: form });
    if (res.ok) {
      const data = await res.json() as { avatarUrl: string };
      setAvatarUrl(data.avatarUrl);
    }
  }

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-5">
      {/* Avatar */}
      <div>
        <p className="text-sm font-medium mb-2">{t('avatarLabel')}</p>
        <div className="flex items-center gap-4">
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt={username}
              width={80}
              height={80}
              className="rounded-full object-cover"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center text-2xl text-gray-500">
              {username[0]?.toUpperCase()}
            </div>
          )}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-sm text-blue-600 hover:underline"
          >
            {t('changeAvatar')}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleAvatarChange}
            className="hidden"
          />
        </div>
      </div>

      {/* Bio */}
      <div>
        <label className="block text-sm font-medium mb-1" htmlFor="bio">
          {t('bio')}
        </label>
        <textarea
          id="bio"
          name="bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          maxLength={500}
          rows={3}
          className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </div>

      {/* Website */}
      <div>
        <label className="block text-sm font-medium mb-1" htmlFor="website">
          {t('website')}
        </label>
        <input
          id="website"
          name="website"
          type="url"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={status === 'saving'}
          data-testid="save-profile"
          className="bg-blue-600 text-white rounded px-4 py-2 hover:bg-blue-700 disabled:opacity-50 transition"
        >
          {status === 'saving' ? t('saving') : t('saveButton')}
        </button>
        {status === 'saved' && (
          <span className="text-green-600 text-sm" data-testid="save-success">
            {t('saved')}
          </span>
        )}
        {status === 'error' && (
          <span className="text-red-600 text-sm">{t('saveFailed')}</span>
        )}
      </div>
    </form>
  );
}
```

---

### Task 38: Other user profile page

**Files:**
- Create: `src/app/[locale]/profile/[username]/page.tsx`

- [ ] **Step 1: Create `src/app/[locale]/profile/[username]/page.tsx`**

```tsx
import { notFound } from 'next/navigation';
import { redirect } from '@/i18n/routing';
import { getTranslations } from 'next-intl/server';
import { validateSession } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import Image from 'next/image';

type Props = {
  params: Promise<{ username: string }>;
};

export default async function UserProfilePage({ params }: Props) {
  // Spec: all profile pages require login in v1
  const { user } = await validateSession();
  if (!user) redirect('/auth/login');

  const { username } = await params;
  const t = await getTranslations('profile');

  const profileUser = await prisma.user.findUnique({
    where: { username },
    select: {
      username: true,
      bio: true,
      website: true,
      avatarKey: true,
      createdAt: true,
    },
  });

  if (!profileUser) notFound();

  const avatarUrl = profileUser.avatarKey
    ? `/api/avatar/${profileUser.avatarKey}`
    : null;

  return (
    <div className="max-w-xl mx-auto px-4 py-8">
      <div className="flex items-center gap-4 mb-6">
        {avatarUrl ? (
          <Image
            src={avatarUrl}
            alt={profileUser.username}
            width={80}
            height={80}
            className="rounded-full object-cover"
          />
        ) : (
          <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center text-2xl text-gray-500">
            {profileUser.username[0]?.toUpperCase()}
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold">@{profileUser.username}</h1>
          <p className="text-gray-500 text-sm">
            {t('memberSince')} {profileUser.createdAt.toLocaleDateString()}
          </p>
        </div>
      </div>

      {profileUser.bio && (
        <p className="text-gray-700 mb-3">{profileUser.bio}</p>
      )}

      {profileUser.website && (
        <a
          href={profileUser.website}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline text-sm"
        >
          {profileUser.website}
        </a>
      )}
    </div>
  );
}
```

---

### Task 39: Run unit tests

- [ ] **Step 1: Verify all unit tests still pass**

```bash
npm test
```

Expected: all tests in `tests/unit/` pass (19 validator tests + existing preset tests).

---

### Task 40: Commit

- [ ] **Commit**

```bash
git add src/app/[locale]/profile/
git commit -m "feat: add profile pages (own editable, other user read-only)"
```

---

## Final verification

Before running E2E tests, ensure the full stack is running:

- [ ] `docker compose up -d postgres mailhog garage`
- [ ] First time only: `bash scripts/garage-init.sh` — copy key values into `.env.local`
- [ ] Dev server: `npm run dev`
- [ ] Mailhog Web UI accessible: http://localhost:8025

Run all E2E tests:

```bash
npm run test:e2e -- tests/e2e/auth.spec.ts tests/e2e/profile.spec.ts
```

Expected: all tests pass.

---

### Task 41: Final commit

- [ ] **Final commit**

```bash
git add .
git commit -m "feat: complete Auth & Profile sub-project A"
```
