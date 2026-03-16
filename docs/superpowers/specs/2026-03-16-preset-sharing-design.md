# Preset Sharing — Design Spec (Sub-project B)

**Date:** 2026-03-16
**Status:** Approved
**Project:** GP-200 Editor — Issue #1 Preset Sharing / Marketplace

---

## Overview

Sub-project B adds persistent preset storage and share links to the GP-200 Editor. Users can upload `.prst` files, manage them privately, and share individual presets via a permanent link that allows anyone (without login) to view details and download the file.

**Goal:** Users can upload, manage, and optionally share GP-200 presets. Each preset gets a permanent share link that can be revoked (regenerated) by the owner.

---

## Architecture

### Database Schema (Prisma)

**`Preset`** (new model):
```prisma
model Preset {
  id            String   @id @default(cuid())
  userId        String
  presetKey     String   // Garage object key: "preset-<userId>-<cuid>.prst"
  name          String   // Patch name from PRST file, editable (max 32 chars)
  description   String?  // Optional description (max 500 chars)
  tags          String[] // User-defined tags (max 10, each max 30 chars)
  shareToken    String   @unique @default(cuid())
  downloadCount Int      @default(0)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

`User` gains `presets Preset[]` relation.

Tags are stored as a PostgreSQL string array — no separate Tags table in v1.
`shareToken` is auto-generated on creation and permanent until explicitly revoked.

---

## API Routes

All routes are Next.js Route Handlers under `src/app/api/`.

### Preset routes (authenticated)

**`POST /api/presets`**
- Auth: Yes
- Body: `multipart/form-data`, fields: `preset` (file, required), `description?` (string), `tags?` (comma-separated string or JSON array)
- Validation:
  - File size must be exactly 1224 bytes
  - Magic header `TSRP` verified via `PRSTDecoder.hasMagic()`
  - description: max 500 chars
  - tags: max 10 items, each max 30 chars, alphanumeric + spaces + hyphens
- Flow:
  1. Validate session + file
  2. Decode PRST to extract `patchName`
  3. Generate key: `preset-{userId}-{cuid()}.prst`
  4. Upload to Garage `presets` bucket
  5. Create `Preset` DB record (shareToken auto-generated)
- Success: `201 { id, name, shareToken }`
- Errors: `400` (validation), `500` (Garage failure)

**`GET /api/presets`**
- Auth: Yes
- Response: `200 [{ id, name, description, tags, shareToken, downloadCount, createdAt, updatedAt }]`
- Returns all presets for the authenticated user, ordered by `createdAt DESC`

**`PATCH /api/presets/[id]`**
- Auth: Yes (owner only)
- Body: `multipart/form-data` — all fields optional:
  - `name?`: string, max 32 chars
  - `description?`: string max 500 chars, or empty string to clear
  - `tags?`: comma-separated or JSON array
  - `preset?`: new `.prst` file (replaces existing binary)
- If `preset` file is provided: validates + uploads new file to Garage with new key, deletes old key
- Success: `200 { id, name, description, tags, shareToken, downloadCount, createdAt, updatedAt }`
- Errors: `400` (validation), `403` (not owner), `404` (not found)

**`DELETE /api/presets/[id]`**
- Auth: Yes (owner only)
- Flow: delete Garage object, delete DB record
- Success: `200 {}`
- Errors: `403` (not owner), `404` (not found)

**`GET /api/presets/[id]/download`**
- Auth: Yes (owner only)
- Streams binary from Garage
- Response headers: `Content-Type: application/octet-stream`, `Content-Disposition: attachment; filename="<name>.prst"`
- Errors: `403`, `404`

**`POST /api/presets/[id]/share/revoke`**
- Auth: Yes (owner only)
- Generates new `shareToken` (old share link immediately returns 404)
- Success: `200 { shareToken: "<new token>" }`
- Errors: `403`, `404`

### Share routes (public)

**`GET /api/share/[token]`**
- Auth: No
- Response: `200 { name, description, tags, username, downloadCount, createdAt }`
- Errors: `404` if token not found

**`GET /api/share/[token]/download`**
- Auth: No
- Atomically increments `downloadCount`
- Streams binary from Garage
- Response headers: `Content-Type: application/octet-stream`, `Content-Disposition: attachment; filename="<name>.prst"`
- Errors: `404` if token not found

---

## Pages

All pages under `src/app/[locale]/`.

| Path | Auth | Description |
|------|------|-------------|
| `/[locale]/presets` | Required | My presets list + upload |
| `/[locale]/presets/[id]/edit` | Required | Edit preset metadata / replace file |
| `/[locale]/share/[token]` | Public | Share page: details + download |

### `/[locale]/presets` — Preset list

Server Component shell + Client Component for interactions.

- Loads presets via `prisma.preset.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } })`
- Upload button triggers file picker → `POST /api/presets`
- Each preset card shows: name, tags, date, download count
- Card actions: Edit (→ `/presets/[id]/edit`), Copy share link, Reset share link, Download, Delete
- Empty state: localised message with upload call-to-action

### `/[locale]/presets/[id]/edit` — Edit preset

Client Component.

Fields:
- Name (text input, max 32 chars, pre-filled from DB)
- Description (textarea, max 500 chars)
- Tags (chip input — type tag + Enter to add, click chip to remove)
- Replace file (file picker, `.prst` only — optional)

Saves via `PATCH /api/presets/[id]`.

### `/[locale]/share/[token]` — Public share page

Server Component.

Shows:
- Preset name
- Description (if set)
- Tags (if set)
- Uploaded by: `@username`
- Date uploaded
- Download count
- Download button → `GET /api/share/[token]/download`

No login required. If token is not found: 404 page.

### Middleware

`middleware.ts` matcher extended:
```typescript
export const config = {
  matcher: ['/(en|de)/(profile|presets)/:path*'],
};
```

---

## Storage

### Garage bucket `presets`

New bucket alongside existing `avatars`. `scripts/garage-init.sh` extended:
```bash
garage bucket create presets
garage bucket allow --read --write presets --key <ACCESS_KEY>
```

Object key format: `preset-{userId}-{cuid}.prst`

### `src/lib/storage.ts` additions

```typescript
uploadPreset(key: string, buffer: Buffer): Promise<void>
deletePreset(key: string): Promise<void>
getPresetStream(key: string): Promise<Readable>
```

Pattern identical to existing `uploadAvatar` / `deleteAvatar` / `getAvatarStream`.

### `.env.local.example` additions

```
GARAGE_PRESET_BUCKET=presets
```

---

## Validation (Zod)

New schemas in `src/lib/validators.ts`:

**`uploadPresetSchema`**
- `description`: `string().max(500).optional()`
- `tags`: `string().max(30).array().max(10).optional()`

**`patchPresetSchema`**
- `name`: `string().min(1).max(32).optional()`
- `description`: `string().max(500).nullable().optional()`
- `tags`: `string().max(30).array().max(10).optional()`

File validation (outside Zod, in route handler):
- Size === 1224 bytes
- `PRSTDecoder.hasMagic(buffer)` returns true

---

## i18n

New keys in `messages/en.json` and `messages/de.json` under `"presets"` namespace:

```json
{
  "presets": {
    "title": "My Presets",
    "upload": "Upload Preset",
    "noPresets": "No presets yet. Upload your first one.",
    "name": "Preset Name",
    "description": "Description",
    "tags": "Tags",
    "addTag": "Add tag…",
    "save": "Save Changes",
    "saving": "Saving…",
    "saved": "Saved!",
    "saveFailed": "Failed to save. Please try again.",
    "delete": "Delete",
    "deleteConfirm": "Delete this preset? This cannot be undone.",
    "download": "Download",
    "copyLink": "Copy Link",
    "linkCopied": "Link copied!",
    "resetLink": "Reset Link",
    "resetLinkConfirm": "Reset the share link? The old link will stop working.",
    "uploadError": "Upload failed. Please try again.",
    "invalidFile": "Invalid file. Must be a .prst file for the GP-200.",
    "memberSince": "Uploaded by",
    "downloads": "downloads",
    "editPreset": "Edit Preset",
    "replaceFile": "Replace File",
    "backToPresets": "Back to my presets"
  }
}
```

---

## YAGNI — Explicitly Excluded

| Feature | Reason |
|---------|--------|
| Public gallery / search | Sub-project C |
| Preset version history | Complexity, no v1 value |
| Per-user preset quota | Volume negligible in v1 |
| Preset download on profile page | Deferred to Sub-project C (public profiles) |
| Pagination of preset list | No need in v1 |
| Filter/search by tags | Sub-project C |
| Preset rating / comments | Sub-project D |
| Admin moderation | Sub-project E |

---

## Security Notes

- Owner checks on all mutating routes (`preset.userId === user.id`)
- Share routes are intentionally public — no sensitive data exposed (no email, passwordHash)
- `downloadCount` incremented atomically via Prisma `update` with `increment`
- Garage credentials never exposed to client
- PRST file validated (size + magic) before touching Garage
- `shareToken` is a CUID — not guessable, not sequential

---

## Dependencies

No new npm packages required. All needed libraries are already installed:
- `@aws-sdk/client-s3` — already used for avatars
- `zod` — already used
- `@prisma/client` — already used
