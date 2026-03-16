# Auth & Profile — Design Spec (Sub-project A)

**Date:** 2026-03-16
**Status:** Approved
**Project:** GP-200 Editor — Issue #1 Preset Sharing / Marketplace

---

## Overview

This is the first of five independent sub-projects that together build the GP-200 Preset Sharing Platform. Sub-project A introduces user accounts, authentication, and login-gated profile pages — the foundation everything else depends on.

**Goal:** Users can register, log in, reset their password, and maintain a profile with optional avatar image. All profile pages require login (v1 scope; public profiles are planned for a later sub-project).

---

## Architecture

### Infrastructure (`docker-compose.yml`)

Four services:

| Service | Image | Ports | Purpose |
|---------|-------|-------|---------|
| `app` | Next.js (local build) | 3000 | Application |
| `postgres` | postgres:16 | 5432 | Primary database |
| `mailhog` | mailhog/mailhog | 1025 (SMTP), 8025 (Web UI) | Email catch-all (dev) |
| `garage` | dxflrs/garage:v1 | 3900 (S3 API), 3902 (Admin) | S3-compatible object store for avatars |

Garage provides an S3-compatible API, accessed server-side via `@aws-sdk/client-s3`. Garage is not publicly reachable; the app proxies all avatar access.

**Garage bucket initialization:** Garage does not auto-create buckets. On first `docker compose up`, run:
```bash
docker compose exec garage garage bucket create avatars
docker compose exec garage garage bucket allow --read --write avatars --key <ACCESS_KEY>
```
A helper script `scripts/garage-init.sh` will be created as part of this sub-project.

### Database Schema (Prisma)

**`User`**
```prisma
model User {
  id           String   @id @default(cuid())
  email        String   @unique
  username     String   @unique
  passwordHash String
  bio          String?
  website      String?
  avatarKey    String?  // Garage object key (filename only), e.g. "user-<id>-<timestamp>.webp"
  createdAt    DateTime @default(now())
  sessions     Session[]
  resetTokens  PasswordResetToken[]
}
```

`avatarKey` stores the object filename without a directory prefix (e.g. `user-abc-1234567890.webp`). The Garage bucket (`avatars`) provides the namespace. The proxy URL is `/api/avatar/<avatarKey>` — a single Next.js segment `[key]` matches because the key contains no `/`.

**`Session`** (Lucia-managed)
```prisma
model Session {
  id        String   @id
  userId    String
  expiresAt DateTime
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

**`PasswordResetToken`**
```prisma
model PasswordResetToken {
  id        String    @id @default(cuid())
  tokenHash String    @unique  // SHA-256 hash of the raw token
  userId    String
  expiresAt DateTime  // 1 hour from creation
  usedAt    DateTime? // set when token is consumed; null = unused
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

### Auth Layer

- **Lucia v3** (`lucia@^3.0`) with `@lucia-auth/adapter-prisma@^1.0` — sessions stored in the `Session` table, managed entirely by Lucia. No shared secret is required; session IDs are opaque and validated against the DB on every request.
- Passwords hashed with **Argon2id** (`@node-rs/argon2@^1.0`, default parameters: memory=19456KB, iterations=2, parallelism=1)
- Password reset: single-use raw token (32 bytes, hex), only SHA-256 hash persisted, 1h TTL

**Key files:**
- `src/lib/auth.ts` — Lucia instance + Prisma adapter
- `src/lib/session.ts` — `validateSession()` helper for Server Components and Route Handlers
- `src/lib/email.ts` — `sendPasswordResetEmail(to: string, resetUrl: string): Promise<void>` via Nodemailer
- `src/lib/storage.ts` — `uploadAvatar(key, buffer): Promise<void>`, `deleteAvatar(key): Promise<void>`, `getAvatarStream(key): Promise<Readable>` via AWS SDK S3

### Avatar Storage

Avatars are stored in Garage bucket `avatars`. The `User.avatarKey` field stores the filename only: `user-<id>-<timestamp>.webp`. The timestamp suffix makes every upload unique, preventing stale cache responses.

**Upload flow:**
1. Client sends `multipart/form-data` to `POST /api/profile/avatar` with field `avatar` (parsed via `request.formData()`)
2. Server validates session, validates file (JPEG/PNG/WebP, max 5 MB)
3. Server resizes to max 512×512 px (preserving aspect ratio) and converts to WebP using `sharp`
4. Generates new key: `user-<id>-<Date.now()>.webp`
5. Uploads to Garage; if user had a previous `avatarKey`, `deleteAvatar(oldKey)` removes it
6. Updates `User.avatarKey` in DB; returns `{ avatarUrl: "/api/avatar/<newKey>" }`

**Serving flow:** `GET /api/avatar/[key]` is a public proxy (no auth check) that fetches the Garage object stream and pipes it to the client. This is safe because:
- Garage is internal (not reachable outside Docker)
- The key is not guessable by outsiders; only logged-in users encounter avatar URLs

Response headers: `Content-Type: image/webp`, `Cache-Control: public, max-age=31536000, immutable` (versioned keys make immutable caching safe).

---

## API Routes

All routes are Next.js Route Handlers under `src/app/api/`.

### Auth routes

**`POST /api/auth/register`**
- Auth: No
- Body: `{ email: string, username: string, password: string }`
  - email: valid email format
  - username: 3–30 chars, alphanumeric + underscore only
  - password: min 8 chars
- Success: `201 { userId: string }` + sets Lucia session cookie
- Errors: `400` (validation), `409 { error: "Email already taken" }` or `409 { error: "Username already taken" }`

**`POST /api/auth/login`**
- Auth: No
- Body: `{ email: string, password: string }`
- Success: `200 { userId: string }` + sets Lucia session cookie
- Errors: `400` (validation), `401 { error: "Invalid email or password" }` (same message regardless of whether email exists — no enumeration)

**`POST /api/auth/logout`**
- Auth: Yes (session cookie)
- Body: none
- Success: `200 {}` + invalidates session via `lucia.invalidateSession(sessionId)`, clears session cookie

**`POST /api/auth/forgot-password`**
- Auth: No
- Body: `{ email: string }`
- Success: always `200 {}` (no user enumeration; sends email only if account exists)

**`POST /api/auth/reset-password`**
- Auth: No
- Body: `{ token: string, newPassword: string }` (token = raw hex token from reset URL query param)
  - newPassword: min 8 chars
- Success: `200 {}` — see [Password Reset Flow](#password-reset-flow-end-to-end) for post-success actions
- Errors: `400` (validation), `400 { error: "Token invalid or expired" }` (token not found, expired `expiresAt < now`, or already used `usedAt != null`)

### Profile routes

**`GET /api/profile`**
- Auth: Yes
- Response: `200 { id, username, email, bio, website, avatarUrl, createdAt }`
  - `avatarUrl`: `/api/avatar/<avatarKey>` if avatarKey is set, else `null`

**`PATCH /api/profile`**
- Auth: Yes
- Body (all fields optional): `{ bio?: string | null, website?: string | null }`
  - bio: max 500 chars
  - website: valid URL or null
  - Note: email and username are not patchable (email change is out of scope for v1; username is immutable after registration)
- Success: `200 { id, username, email, bio, website, avatarUrl, createdAt }`
- Errors: `400` (validation)

**`POST /api/profile/avatar`**
- Auth: Yes
- Body: `multipart/form-data`, field name `avatar` (JPEG, PNG, or WebP, max 5 MB)
- Success: `200 { avatarUrl: string }` (e.g. `"/api/avatar/user-abc-1234.webp"`)
- Errors: `400` (no file / unsupported type / over size limit), `500` (Garage failure)

**`GET /api/avatar/[key]`**
- Auth: No (public proxy)
- `[key]` is a single Next.js dynamic segment matching `user-<id>-<timestamp>.webp` (no `/` in key)
- Pipes Garage object stream; `Content-Type: image/webp`, `Cache-Control: public, max-age=31536000, immutable`
- Errors: `404` if object not found in Garage

### Validation

All request bodies validated with **Zod**. Invalid input → `400 { error: "..." }`. Auth failure → `401 { error: "Unauthorized" }`.

---

## Pages

All pages live under `src/app/[locale]/` (existing i18n structure).

| Path | Auth | Description |
|------|------|-------------|
| `/[locale]/auth/login` | Public | Email + password login form |
| `/[locale]/auth/register` | Public | Registration form |
| `/[locale]/auth/forgot-password` | Public | "Enter your email" form |
| `/[locale]/auth/reset-password?token=…` | Public | New password form; reads `token` from search params, POSTs to `/api/auth/reset-password` |
| `/[locale]/profile` | Required | Own profile (editable: bio, website, avatar) |
| `/[locale]/profile/[username]` | Required | Another user's profile (read-only) |

**Note:** Both profile pages require login. This is an intentional v1 constraint. Public profile sharing is deferred to a later sub-project.

### Middleware

`middleware.ts` matcher extended to protect profile routes:
```typescript
export const config = {
  matcher: ['/(en|de)/(profile)/:path*'],
};
```
(Adjust locale list to match the project's `i18n.ts` config.) Unauthenticated requests redirect to `/[locale]/auth/login`.

---

## Password Reset Flow (end-to-end)

1. User submits `POST /api/auth/forgot-password` with email
2. Server looks up user by email. If found: generates 32-byte hex token, hashes with SHA-256, creates `PasswordResetToken { tokenHash, userId, expiresAt: now+1h }`, sends reset email. SMTP errors are not silently swallowed — they bubble up as `500`. The outer route always returns `200 {}` regardless of whether the email was found (no enumeration), but if the email was found and the send fails, a 500 is returned.
3. Email body contains: `${NEXT_PUBLIC_APP_URL}/en/auth/reset-password?token=<raw-token>` (locale hardcoded to `en` in v1 for simplicity — the reset page is functionally locale-independent)
4. User opens link → page renders "new password" form with token in hidden input
5. User submits form → page POSTs `{ token, newPassword }` to `/api/auth/reset-password`
6. Server:
   - Hashes submitted token with SHA-256
   - Looks up `PasswordResetToken` where `tokenHash = hash AND expiresAt > now AND usedAt IS NULL`
   - If not found → `400 { error: "Token invalid or expired" }`
   - If found: sets `usedAt = now`, updates `User.passwordHash` with new Argon2id hash, invalidates all existing sessions for the user via `lucia.invalidateUserSessions(userId)`, creates a new session (auto-login)
7. Server returns `200 {}` + new session cookie
8. Client redirects to `/[locale]/profile`

**Token lifecycle:** Token records are marked `usedAt` on consumption but not deleted. Expired and used records accumulate; cleanup is out of scope for v1.

---

## Email

Development: Mailhog catches all outbound email (SMTP on port 1025, Web UI on port 8025).
Production: `EMAIL_SMTP_*` env vars configure Nodemailer.

---

## Environment Variables

```
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/gp200

GARAGE_ENDPOINT=http://garage:3900
GARAGE_ACCESS_KEY_ID=...
GARAGE_SECRET_ACCESS_KEY=...
GARAGE_BUCKET=avatars

EMAIL_FROM=noreply@gp200editor.local
EMAIL_SMTP_HOST=mailhog        # overridden in prod
EMAIL_SMTP_PORT=1025
EMAIL_SMTP_USER=               # empty in dev
EMAIL_SMTP_PASS=               # empty in dev

NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Note: Lucia v3 does not use a shared secret — sessions are opaque IDs validated against the database on every request.

---

## YAGNI — Explicitly Excluded

| Feature | Reason |
|---------|--------|
| Email verification on register | Complex flow, no v1 value |
| Social login (Google/GitHub) | Scope creep |
| Username changes after registration | Immutable in v1 |
| Email address changes | Out of scope for v1 |
| Password change on profile page | Use forgot-password flow instead |
| Rate limiting on auth routes | Middleware, add later |
| Admin panel | Sub-project E |
| Public (unauthenticated) profile pages | Deferred to social sub-project |
| Avatar removal without replacement | Out of scope for v1 |
| Token record cleanup / cron job | Volume negligible in v1 |

---

## Security Notes

- Passwords: Argon2id with default parameters
- Reset tokens: raw token never stored — only SHA-256 hash
- Forgot-password endpoint: always `200`, no user enumeration
- Login endpoint: same error message for unknown email and wrong password
- Session cookies: `HttpOnly`, `Secure` in production, `SameSite=Lax` — configured in the Lucia instance options in `src/lib/auth.ts`
- Password reset invalidates all existing sessions for the user
- Garage credentials never exposed to the client

---

## Dependencies to Add

```
lucia@^3.0
@lucia-auth/adapter-prisma@^1.0
@node-rs/argon2@^1.0
@aws-sdk/client-s3
sharp          # bundles its own TypeScript types; no @types/sharp needed
nodemailer
@types/nodemailer
zod  (already present)
```
