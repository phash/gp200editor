# Auth (Lucia v3)

- `@lucia-auth/adapter-prisma@4.0.1` (nicht 1.0.0 — das ist Lucia v1/v2)
- Session-Cookie: `auth_session` (Lucia-Standard)
- Passwort-Hashing: Argon2id (`@node-rs/argon2`)
- Session-Validation: `validateSession()` in `src/lib/session.ts` — immer auch `refreshSessionCookie()` aufrufen
- `getUserAttributes` liefert: `username`, `email`, `role`, `suspended`, `emailVerified`
- Login akzeptiert Email oder Username (`loginSchema.login` Feld, `@`-Check für Lookup)
- Gesperrte User (`suspended=true`) können sich nicht einloggen (403)
- Admin-Guard: `requireAdmin()` in `src/lib/admin.ts` — prüft `role === 'ADMIN'`
- Email-Verification-Guard: `requireVerifiedUser()` in `src/lib/session.ts` — prüft `emailVerified`
- Zod-Fehler: `.issues[0].message` (nicht `.errors` — das ist Zod v4)

## Anti-Spam (4 Schichten, seit 2026-03-29)

- **Cloudflare Turnstile** — unsichtbares CAPTCHA auf Registration (`@marsidev/react-turnstile`)
  - Env: `NEXT_PUBLIC_TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY`
  - Dev: Cloudflare Test-Keys (always pass) in `.env.dev.example`
  - Server: `src/lib/turnstile.ts`, blockiert Registration in Prod wenn Keys fehlen (returns false)
- **Honeypot** — hidden `company_url` Feld (nicht `website` — das ist ein User-Model-Feld!)
- **Disposable-Email-Blocker** — `disposable-email-domains` (121K Domains), `src/lib/disposableEmails.ts`
- **Email-Verification Enforcement** — `requireVerifiedUser()` auf Upload/Publish/Rate/Edit
  - Nicht auf: GET (list), DELETE, Download, Share/Revoke
