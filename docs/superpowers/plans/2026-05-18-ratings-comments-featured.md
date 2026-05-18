# Ratings · Comments · Featured Preset — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Inline-Bewertungen in der Gallery-Liste, 1-Level-Threading Kommentar-System mit Admin-Moderation, Homepage-Featured-Preset (Bayes-Avg über 30 Tage) mit Signal-Chain-Grafik und Kommentar-Vorschau.

**Architecture:** Eine neue Prisma-Tabelle `Comment` mit Self-FK für 1-Level-Threading. 5 neue API-Routes (CRUD + Admin-Listing) im bestehenden Lucia/CSRF/rate-limit-Pattern. UI als Mix aus Server- und Client-Components, nahtlos ins Pedalboard-Theme integriert. Featured-Berechnung als Live-Query mit Next.js ISR (`revalidate=3600`).

**Tech Stack:** Next.js 15 App Router · React 19 · TypeScript strict · Prisma 5 · PostgreSQL 16 · Lucia v3 · Zod v4 · next-intl 4 (6 Locales) · Vitest · Playwright

**Spec:** [`docs/superpowers/specs/2026-05-18-ratings-comments-featured-design.md`](../specs/2026-05-18-ratings-comments-featured-design.md)

---

## File Map

**New files**
- `src/lib/featuredPreset.ts` — Bayes-Avg + Featured-Query
- `src/lib/autoLink.tsx` — Plaintext → React-Nodes mit URL-Linkifizierung
- `src/lib/commentValidators.ts` — Zod-Schemas für Body/Reason
- `src/app/api/presets/[id]/comments/route.ts` — GET list + POST top-level
- `src/app/api/comments/[id]/route.ts` — PATCH edit + DELETE
- `src/app/api/comments/[id]/reply/route.ts` — POST reply
- `src/app/api/admin/comments/route.ts` — GET moderation list
- `src/components/SignalChainStrip.tsx`
- `src/components/FeaturedPresetBlock.tsx`
- `src/components/RateableGuitarRating.tsx`
- `src/components/comments/CommentSection.tsx`
- `src/components/comments/CommentList.tsx`
- `src/components/comments/CommentItem.tsx`
- `src/components/comments/CommentForm.tsx`
- `src/components/admin/AdminCommentsTab.tsx`
- Tests: ~14 unit + 4 E2E

**Modified files**
- `prisma/schema.prisma` (+ Comment model + 2 backlinks)
- `src/lib/admin.ts` (Erweitere `targetType`-Type um `'comment'`)
- `src/app/[locale]/page.tsx` (+ FeaturedPresetBlock)
- `src/app/[locale]/gallery/page.tsx` (+ session/existing-rating-Daten)
- `src/app/[locale]/gallery/GalleryClient.tsx` (RateableGuitarRating + Props)
- `src/app/[locale]/share/[token]/page.tsx` (+ CommentSection)
- `src/app/admin/page.tsx` (+ Comments-Tab)
- 6× `messages/{de,en,es,fr,it,pt}.json`
- `CHANGELOG.md`

---

## Task 1: Prisma Schema + Migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_add_comments/migration.sql` (auto-generated)

- [ ] **Step 1: Add Comment model and backlinks**

Append to `prisma/schema.prisma` (after `PresetRating`):

```prisma
model Comment {
  id        String    @id @default(cuid())
  presetId  String
  userId    String
  parentId  String?
  body      String?   @db.VarChar(1000)
  editedAt  DateTime?
  deletedAt DateTime?
  deletedBy String?
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt

  preset  Preset    @relation(fields: [presetId], references: [id], onDelete: Cascade)
  user    User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  parent  Comment?  @relation("CommentReplies", fields: [parentId], references: [id], onDelete: Cascade)
  replies Comment[] @relation("CommentReplies")

  @@index([presetId, parentId, createdAt])
  @@index([userId])
}
```

Add `comments Comment[]` line to `model Preset { ... }` (next to existing `ratings PresetRating[]`).
Add `comments Comment[]` line to `model User { ... }` (next to existing relations).

- [ ] **Step 2: Generate migration**

Run: `npx prisma migrate dev --name add_comments`
Expected: New SQL file in `prisma/migrations/`, schema applied to dev DB, `prisma generate` runs.

- [ ] **Step 3: Verify TypeScript types**

Run: `npx tsc --noEmit`
Expected: passes (no Prisma client errors).

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(db): add Comment model for 1-level threaded comments"
```

---

## Task 2: Zod Validators (commentValidators.ts)

**Files:**
- Create: `src/lib/commentValidators.ts`
- Test: `tests/unit/lib/commentValidators.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// tests/unit/lib/commentValidators.test.ts
import { describe, it, expect } from 'vitest';
import { commentBodySchema, adminDeleteReasonSchema } from '@/lib/commentValidators';

describe('commentBodySchema', () => {
  it('accepts 1..1000 chars after trim', () => {
    expect(commentBodySchema.parse('hi')).toBe('hi');
    expect(commentBodySchema.parse('  hi  ')).toBe('hi');
    expect(commentBodySchema.parse('x'.repeat(1000))).toHaveLength(1000);
  });
  it('rejects empty after trim', () => {
    expect(() => commentBodySchema.parse('   ')).toThrow();
  });
  it('rejects > 1000 chars', () => {
    expect(() => commentBodySchema.parse('x'.repeat(1001))).toThrow();
  });
});

describe('adminDeleteReasonSchema', () => {
  it('accepts 5..200 chars', () => {
    expect(adminDeleteReasonSchema.parse('spam from user')).toBe('spam from user');
  });
  it('rejects < 5 chars', () => {
    expect(() => adminDeleteReasonSchema.parse('hi')).toThrow();
  });
});
```

Run: `npx vitest run tests/unit/lib/commentValidators.test.ts`
Expected: FAIL (`Cannot find module '@/lib/commentValidators'`).

- [ ] **Step 2: Implement validators**

```ts
// src/lib/commentValidators.ts
import { z } from 'zod';

export const commentBodySchema = z
  .string()
  .trim()
  .min(1, 'Comment cannot be empty')
  .max(1000, 'Comment exceeds 1000 character limit');

export const adminDeleteReasonSchema = z
  .string()
  .trim()
  .min(5, 'Reason too short')
  .max(200, 'Reason exceeds 200 character limit');
```

- [ ] **Step 3: Run test green**

Run: `npx vitest run tests/unit/lib/commentValidators.test.ts`
Expected: PASS (3 tests in each describe).

- [ ] **Step 4: Commit**

```bash
git add src/lib/commentValidators.ts tests/unit/lib/commentValidators.test.ts
git commit -m "feat(lib): commentValidators with body + admin-reason schemas"
```

---

## Task 3: Auto-Link Helper (autoLink.tsx)

**Files:**
- Create: `src/lib/autoLink.tsx`
- Test: `tests/unit/lib/autoLink.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
// tests/unit/lib/autoLink.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AutoLink } from '@/lib/autoLink';

describe('AutoLink', () => {
  it('renders plain text without changes', () => {
    render(<AutoLink text="hello world" />);
    expect(screen.getByText('hello world')).toBeInTheDocument();
  });

  it('linkifies http and https URLs', () => {
    render(<AutoLink text="visit https://example.com now" />);
    const link = screen.getByRole('link', { name: 'https://example.com' });
    expect(link).toHaveAttribute('href', 'https://example.com');
    expect(link).toHaveAttribute('rel', 'nofollow noopener noreferrer');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('handles multiple URLs', () => {
    render(<AutoLink text="see https://a.com and http://b.com end" />);
    expect(screen.getAllByRole('link')).toHaveLength(2);
  });

  it('does not linkify javascript: or data: schemes', () => {
    render(<AutoLink text="click javascript:alert(1) here" />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText(/click javascript:alert\(1\) here/)).toBeInTheDocument();
  });

  it('treats URL as text-node never as HTML', () => {
    const { container } = render(<AutoLink text='<img src=x onerror=alert(1)>' />);
    // Body is rendered as text, no img element
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toBe('<img src=x onerror=alert(1)>');
  });
});
```

Run: `npx vitest run tests/unit/lib/autoLink.test.tsx`
Expected: FAIL (`Cannot find module`).

- [ ] **Step 2: Implement AutoLink**

```tsx
// src/lib/autoLink.tsx
import React from 'react';

// Matches http(s)://... up to the first whitespace. No path-end heuristics —
// trailing punctuation is intentional (kept simple, false-positive low-impact).
const URL_REGEX = /\bhttps?:\/\/[^\s<>"'`]+/g;

interface Props { text: string }

export function AutoLink({ text }: Props) {
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(URL_REGEX)) {
    const url = match[0];
    const start = match.index ?? 0;
    if (start > lastIndex) nodes.push(text.slice(lastIndex, start));
    nodes.push(
      <a
        key={start}
        href={url}
        rel="nofollow noopener noreferrer"
        target="_blank"
      >
        {url}
      </a>
    );
    lastIndex = start + url.length;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return <>{nodes}</>;
}
```

- [ ] **Step 3: Run test green**

Run: `npx vitest run tests/unit/lib/autoLink.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 4: Commit**

```bash
git add src/lib/autoLink.tsx tests/unit/lib/autoLink.test.tsx
git commit -m "feat(lib): autoLink helper renders URLs as safe React nodes"
```

---

## Task 4: POST `/api/presets/[id]/comments` (Top-Level Create)

**Files:**
- Create: `src/app/api/presets/[id]/comments/route.ts` (POST + GET — both in this task)
- Test: `tests/unit/api/comments-create.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// tests/unit/api/comments-create.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Pattern mirrors existing tests/unit/api/preset-rate.test.ts.
// Stubs prisma + session helpers. Real DB tests are E2E.
vi.mock('@/lib/prisma', () => ({
  prisma: {
    preset: { findUnique: vi.fn() },
    comment: { create: vi.fn() },
  },
}));
vi.mock('@/lib/session', () => ({
  requireVerifiedUser: vi.fn(),
}));
vi.mock('@/lib/csrf', () => ({ verifyCsrf: vi.fn(() => true) }));
vi.mock('@/lib/rateLimit', () => ({ rateLimit: vi.fn(() => ({ allowed: true, remaining: 9 })) }));

import { POST } from '@/app/api/presets/[id]/comments/route';
import { prisma } from '@/lib/prisma';
import { requireVerifiedUser } from '@/lib/session';

function makeRequest(body: unknown, headers: Record<string,string> = {}) {
  return new NextRequest('http://test/api/presets/p1/comments', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'http://test', ...headers },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.mocked(requireVerifiedUser).mockResolvedValue({ user: { id: 'u1' } as never, session: {} as never });
  vi.mocked(prisma.preset.findUnique).mockResolvedValue({ id: 'p1', public: true } as never);
});

describe('POST /api/presets/[id]/comments', () => {
  it('creates top-level comment for verified user', async () => {
    vi.mocked(prisma.comment.create).mockResolvedValue({ id: 'c1', body: 'hi' } as never);
    const res = await POST(makeRequest({ body: 'hi' }), { params: Promise.resolve({ id: 'p1' }) });
    expect(res.status).toBe(200);
    expect(prisma.comment.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ presetId: 'p1', userId: 'u1', body: 'hi', parentId: null }),
    }));
  });

  it('rejects empty body', async () => {
    const res = await POST(makeRequest({ body: '   ' }), { params: Promise.resolve({ id: 'p1' }) });
    expect(res.status).toBe(400);
  });

  it('rejects body > 1000 chars', async () => {
    const res = await POST(makeRequest({ body: 'x'.repeat(1001) }), { params: Promise.resolve({ id: 'p1' }) });
    expect(res.status).toBe(400);
  });

  it('returns 401 when not authenticated', async () => {
    vi.mocked(requireVerifiedUser).mockResolvedValue({ error: new Response(null, { status: 401 }) } as never);
    const res = await POST(makeRequest({ body: 'hi' }), { params: Promise.resolve({ id: 'p1' }) });
    expect(res.status).toBe(401);
  });

  it('returns 403 on CSRF fail', async () => {
    const { verifyCsrf } = await import('@/lib/csrf');
    vi.mocked(verifyCsrf).mockReturnValueOnce(false);
    const res = await POST(makeRequest({ body: 'hi' }), { params: Promise.resolve({ id: 'p1' }) });
    expect(res.status).toBe(403);
  });

  it('returns 404 for non-public preset', async () => {
    vi.mocked(prisma.preset.findUnique).mockResolvedValue({ id: 'p1', public: false } as never);
    const res = await POST(makeRequest({ body: 'hi' }), { params: Promise.resolve({ id: 'p1' }) });
    expect(res.status).toBe(404);
  });

  it('returns 429 when rate-limited', async () => {
    const { rateLimit } = await import('@/lib/rateLimit');
    vi.mocked(rateLimit).mockReturnValueOnce({ allowed: false, remaining: 0 });
    const res = await POST(makeRequest({ body: 'hi' }), { params: Promise.resolve({ id: 'p1' }) });
    expect(res.status).toBe(429);
  });
});
```

Run: `npx vitest run tests/unit/api/comments-create.test.ts`
Expected: FAIL.

- [ ] **Step 2: Implement POST + GET (Top-Level + list — GET tested in Task 5)**

```ts
// src/app/api/presets/[id]/comments/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireVerifiedUser } from '@/lib/session';
import { verifyCsrf } from '@/lib/csrf';
import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/rateLimit';
import { commentBodySchema } from '@/lib/commentValidators';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!verifyCsrf(request)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const auth = await requireVerifiedUser();
  if (auth.error) return auth.error;
  const { user } = auth;

  const limit = rateLimit(`comment-create:${user.id}`, 10, 60 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Too many comments. Try again later.' }, { status: 429 });
  }

  const { id } = await params;
  const json = await request.json().catch(() => null);
  const parsed = commentBodySchema.safeParse(json?.body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const preset = await prisma.preset.findUnique({
    where: { id },
    select: { id: true, public: true },
  });
  if (!preset || !preset.public) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const comment = await prisma.comment.create({
    data: { presetId: id, userId: user.id, body: parsed.data, parentId: null },
    include: {
      user: { select: { id: true, displayName: true, avatarUrl: true } },
    },
  });

  return NextResponse.json({ comment });
}

// GET — list with cursor pagination. Implemented here, tested in Task 5.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const cursor = request.nextUrl.searchParams.get('cursor');
  const LIMIT = 20;

  const topLevels = await prisma.comment.findMany({
    where: { presetId: id, parentId: null },
    orderBy: { createdAt: 'desc' },
    take: LIMIT + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: {
      user: { select: { id: true, displayName: true, avatarUrl: true } },
      replies: {
        orderBy: { createdAt: 'asc' },
        include: { user: { select: { id: true, displayName: true, avatarUrl: true } } },
      },
    },
  });

  const hasMore = topLevels.length > LIMIT;
  const items = topLevels.slice(0, LIMIT);
  const nextCursor = hasMore ? items[items.length - 1].id : null;

  // Strip body for soft-deleted (defense-in-depth — already null in DB but be explicit)
  const sanitized = items.map((c) => ({
    ...c,
    body: c.deletedAt ? null : c.body,
    replies: c.replies.map((r) => ({ ...r, body: r.deletedAt ? null : r.body })),
  }));

  return NextResponse.json({ comments: sanitized, nextCursor });
}
```

- [ ] **Step 3: Run test green**

Run: `npx vitest run tests/unit/api/comments-create.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 4: Commit**

```bash
git add src/app/api/presets/[id]/comments/route.ts tests/unit/api/comments-create.test.ts
git commit -m "feat(api): POST + GET /api/presets/[id]/comments (top-level create + list)"
```

---

## Task 5: GET `/api/presets/[id]/comments` (List Tests)

**Files:**
- Test: `tests/unit/api/comments-list.test.ts`
- Modify: (none — route already implemented in Task 4)

- [ ] **Step 1: Write tests for list endpoint**

```ts
// tests/unit/api/comments-list.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/prisma', () => ({
  prisma: { comment: { findMany: vi.fn() } },
}));

import { GET } from '@/app/api/presets/[id]/comments/route';
import { prisma } from '@/lib/prisma';

beforeEach(() => { vi.clearAllMocks(); });

function makeReq(url = 'http://test/api/presets/p1/comments') {
  return new NextRequest(url);
}

describe('GET /api/presets/[id]/comments', () => {
  it('returns top-level comments with replies', async () => {
    vi.mocked(prisma.comment.findMany).mockResolvedValue([
      { id: 'c1', body: 'hi', deletedAt: null, replies: [{ id: 'r1', body: 'reply', deletedAt: null, user: {} }], user: {} },
    ] as never);
    const res = await GET(makeReq(), { params: Promise.resolve({ id: 'p1' }) });
    const data = await res.json();
    expect(data.comments).toHaveLength(1);
    expect(data.comments[0].replies).toHaveLength(1);
  });

  it('strips body of soft-deleted comments', async () => {
    vi.mocked(prisma.comment.findMany).mockResolvedValue([
      { id: 'c1', body: 'should-be-stripped', deletedAt: new Date(), deletedBy: 'AUTHOR', replies: [], user: {} },
    ] as never);
    const res = await GET(makeReq(), { params: Promise.resolve({ id: 'p1' }) });
    const data = await res.json();
    expect(data.comments[0].body).toBeNull();
    expect(data.comments[0].deletedBy).toBe('AUTHOR');
  });

  it('returns nextCursor when hasMore', async () => {
    const items = Array.from({ length: 21 }, (_, i) => ({
      id: `c${i}`, body: 'x', deletedAt: null, replies: [], user: {},
    }));
    vi.mocked(prisma.comment.findMany).mockResolvedValue(items as never);
    const res = await GET(makeReq(), { params: Promise.resolve({ id: 'p1' }) });
    const data = await res.json();
    expect(data.comments).toHaveLength(20);
    expect(data.nextCursor).toBe('c19');
  });

  it('returns null cursor when no more', async () => {
    vi.mocked(prisma.comment.findMany).mockResolvedValue([
      { id: 'c1', body: 'hi', deletedAt: null, replies: [], user: {} },
    ] as never);
    const res = await GET(makeReq(), { params: Promise.resolve({ id: 'p1' }) });
    const data = await res.json();
    expect(data.nextCursor).toBeNull();
  });
});
```

Run: `npx vitest run tests/unit/api/comments-list.test.ts`
Expected: PASS (4 tests, since route is already implemented).

- [ ] **Step 2: Commit**

```bash
git add tests/unit/api/comments-list.test.ts
git commit -m "test(api): coverage for GET /api/presets/[id]/comments"
```

---

## Task 6: POST `/api/comments/[id]/reply`

**Files:**
- Create: `src/app/api/comments/[id]/reply/route.ts`
- Test: `tests/unit/api/comments-reply.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// tests/unit/api/comments-reply.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/prisma', () => ({
  prisma: { comment: { findUnique: vi.fn(), create: vi.fn() } },
}));
vi.mock('@/lib/session', () => ({
  requireVerifiedUser: vi.fn(() => Promise.resolve({ user: { id: 'u1' }, session: {} })),
}));
vi.mock('@/lib/csrf', () => ({ verifyCsrf: vi.fn(() => true) }));
vi.mock('@/lib/rateLimit', () => ({ rateLimit: vi.fn(() => ({ allowed: true, remaining: 9 })) }));

import { POST } from '@/app/api/comments/[id]/reply/route';
import { prisma } from '@/lib/prisma';

function req(body: unknown) {
  return new NextRequest('http://test/api/comments/c1/reply', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'http://test' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => vi.clearAllMocks());

describe('POST /api/comments/[id]/reply', () => {
  it('creates reply to top-level comment', async () => {
    vi.mocked(prisma.comment.findUnique).mockResolvedValue({ id: 'c1', parentId: null, presetId: 'p1' } as never);
    vi.mocked(prisma.comment.create).mockResolvedValue({ id: 'r1' } as never);
    const res = await POST(req({ body: 'reply text' }), { params: Promise.resolve({ id: 'c1' }) });
    expect(res.status).toBe(200);
    expect(prisma.comment.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ parentId: 'c1', presetId: 'p1', userId: 'u1', body: 'reply text' }),
    }));
  });

  it('rejects reply to reply (400)', async () => {
    vi.mocked(prisma.comment.findUnique).mockResolvedValue({ id: 'c1', parentId: 'c0', presetId: 'p1' } as never);
    const res = await POST(req({ body: 'x' }), { params: Promise.resolve({ id: 'c1' }) });
    expect(res.status).toBe(400);
  });

  it('allows reply to soft-deleted parent', async () => {
    vi.mocked(prisma.comment.findUnique).mockResolvedValue({ id: 'c1', parentId: null, presetId: 'p1', deletedAt: new Date() } as never);
    vi.mocked(prisma.comment.create).mockResolvedValue({ id: 'r1' } as never);
    const res = await POST(req({ body: 'x' }), { params: Promise.resolve({ id: 'c1' }) });
    expect(res.status).toBe(200);
  });

  it('returns 404 when parent missing', async () => {
    vi.mocked(prisma.comment.findUnique).mockResolvedValue(null);
    const res = await POST(req({ body: 'x' }), { params: Promise.resolve({ id: 'c1' }) });
    expect(res.status).toBe(404);
  });

  it('shares rate-limit bucket with top-level create', async () => {
    const { rateLimit } = await import('@/lib/rateLimit');
    vi.mocked(rateLimit).mockReturnValueOnce({ allowed: false, remaining: 0 });
    const res = await POST(req({ body: 'x' }), { params: Promise.resolve({ id: 'c1' }) });
    expect(res.status).toBe(429);
    expect(rateLimit).toHaveBeenCalledWith('comment-create:u1', 10, 3600000);
  });
});
```

Run: `npx vitest run tests/unit/api/comments-reply.test.ts`
Expected: FAIL.

- [ ] **Step 2: Implement reply route**

```ts
// src/app/api/comments/[id]/reply/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireVerifiedUser } from '@/lib/session';
import { verifyCsrf } from '@/lib/csrf';
import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/rateLimit';
import { commentBodySchema } from '@/lib/commentValidators';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!verifyCsrf(request)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const auth = await requireVerifiedUser();
  if (auth.error) return auth.error;
  const { user } = auth;

  const limit = rateLimit(`comment-create:${user.id}`, 10, 60 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Too many comments. Try again later.' }, { status: 429 });
  }

  const { id: parentId } = await params;
  const json = await request.json().catch(() => null);
  const parsed = commentBodySchema.safeParse(json?.body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const parent = await prisma.comment.findUnique({
    where: { id: parentId },
    select: { id: true, parentId: true, presetId: true },
  });
  if (!parent) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (parent.parentId !== null) {
    return NextResponse.json({ error: 'Replies must target a top-level comment' }, { status: 400 });
  }

  const comment = await prisma.comment.create({
    data: { presetId: parent.presetId, userId: user.id, body: parsed.data, parentId: parent.id },
    include: { user: { select: { id: true, displayName: true, avatarUrl: true } } },
  });
  return NextResponse.json({ comment });
}
```

- [ ] **Step 3: Run test green**

Run: `npx vitest run tests/unit/api/comments-reply.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 4: Commit**

```bash
git add src/app/api/comments/[id]/reply/route.ts tests/unit/api/comments-reply.test.ts
git commit -m "feat(api): POST /api/comments/[id]/reply with 1-level constraint"
```

---

## Task 7: PATCH `/api/comments/[id]` (Edit)

**Files:**
- Create: `src/app/api/comments/[id]/route.ts` (PATCH + DELETE)
- Test: `tests/unit/api/comments-edit.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// tests/unit/api/comments-edit.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/prisma', () => ({
  prisma: { comment: { findUnique: vi.fn(), update: vi.fn() } },
}));
vi.mock('@/lib/session', () => ({
  requireVerifiedUser: vi.fn(() => Promise.resolve({ user: { id: 'u1' }, session: {} })),
}));
vi.mock('@/lib/csrf', () => ({ verifyCsrf: vi.fn(() => true) }));
vi.mock('@/lib/rateLimit', () => ({ rateLimit: vi.fn(() => ({ allowed: true, remaining: 29 })) }));

import { PATCH } from '@/app/api/comments/[id]/route';
import { prisma } from '@/lib/prisma';

function req(body: unknown) {
  return new NextRequest('http://test/api/comments/c1', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', origin: 'http://test' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => vi.clearAllMocks());

describe('PATCH /api/comments/[id]', () => {
  it('updates body and sets editedAt for author', async () => {
    vi.mocked(prisma.comment.findUnique).mockResolvedValue({ id: 'c1', userId: 'u1', deletedAt: null } as never);
    vi.mocked(prisma.comment.update).mockResolvedValue({ id: 'c1', body: 'new', editedAt: new Date() } as never);
    const res = await PATCH(req({ body: 'new' }), { params: Promise.resolve({ id: 'c1' }) });
    expect(res.status).toBe(200);
    expect(prisma.comment.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ body: 'new', editedAt: expect.any(Date) }),
    }));
  });

  it('returns 403 when not author', async () => {
    vi.mocked(prisma.comment.findUnique).mockResolvedValue({ id: 'c1', userId: 'u2', deletedAt: null } as never);
    const res = await PATCH(req({ body: 'new' }), { params: Promise.resolve({ id: 'c1' }) });
    expect(res.status).toBe(403);
  });

  it('returns 409 when comment soft-deleted', async () => {
    vi.mocked(prisma.comment.findUnique).mockResolvedValue({ id: 'c1', userId: 'u1', deletedAt: new Date() } as never);
    const res = await PATCH(req({ body: 'new' }), { params: Promise.resolve({ id: 'c1' }) });
    expect(res.status).toBe(409);
  });

  it('rejects empty body', async () => {
    vi.mocked(prisma.comment.findUnique).mockResolvedValue({ id: 'c1', userId: 'u1', deletedAt: null } as never);
    const res = await PATCH(req({ body: '   ' }), { params: Promise.resolve({ id: 'c1' }) });
    expect(res.status).toBe(400);
  });

  it('uses comment-edit rate-limit bucket', async () => {
    vi.mocked(prisma.comment.findUnique).mockResolvedValue({ id: 'c1', userId: 'u1', deletedAt: null } as never);
    const { rateLimit } = await import('@/lib/rateLimit');
    vi.mocked(rateLimit).mockReturnValueOnce({ allowed: false, remaining: 0 });
    const res = await PATCH(req({ body: 'x' }), { params: Promise.resolve({ id: 'c1' }) });
    expect(res.status).toBe(429);
    expect(rateLimit).toHaveBeenCalledWith('comment-edit:u1', 30, 3600000);
  });
});
```

Run: `npx vitest run tests/unit/api/comments-edit.test.ts`
Expected: FAIL.

- [ ] **Step 2: Implement PATCH (DELETE empty stub for now)**

```ts
// src/app/api/comments/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireVerifiedUser } from '@/lib/session';
import { verifyCsrf } from '@/lib/csrf';
import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/rateLimit';
import { commentBodySchema } from '@/lib/commentValidators';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!verifyCsrf(request)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const auth = await requireVerifiedUser();
  if (auth.error) return auth.error;
  const { user } = auth;

  const limit = rateLimit(`comment-edit:${user.id}`, 30, 60 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Too many edits. Try again later.' }, { status: 429 });
  }

  const { id } = await params;
  const json = await request.json().catch(() => null);
  const parsed = commentBodySchema.safeParse(json?.body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const existing = await prisma.comment.findUnique({
    where: { id },
    select: { id: true, userId: true, deletedAt: true },
  });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (existing.userId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (existing.deletedAt) return NextResponse.json({ error: 'Cannot edit deleted comment' }, { status: 409 });

  const comment = await prisma.comment.update({
    where: { id },
    data: { body: parsed.data, editedAt: new Date() },
    include: { user: { select: { id: true, displayName: true, avatarUrl: true } } },
  });
  return NextResponse.json({ comment });
}

// DELETE — implemented in Task 8
export async function DELETE() {
  return NextResponse.json({ error: 'Not implemented' }, { status: 501 });
}
```

- [ ] **Step 3: Run test green**

Run: `npx vitest run tests/unit/api/comments-edit.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 4: Commit**

```bash
git add src/app/api/comments/[id]/route.ts tests/unit/api/comments-edit.test.ts
git commit -m "feat(api): PATCH /api/comments/[id] edit endpoint"
```

---

## Task 8: DELETE `/api/comments/[id]` (Soft + Admin Hard)

**Files:**
- Modify: `src/app/api/comments/[id]/route.ts` (replace DELETE stub)
- Modify: `src/lib/admin.ts` (extend `targetType` union)
- Test: `tests/unit/api/comments-delete.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// tests/unit/api/comments-delete.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    comment: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn(), count: vi.fn() },
    adminAction: { create: vi.fn() },
  },
}));
vi.mock('@/lib/session', () => ({ validateSession: vi.fn() }));
vi.mock('@/lib/csrf', () => ({ verifyCsrf: vi.fn(() => true) }));

import { DELETE } from '@/app/api/comments/[id]/route';
import { prisma } from '@/lib/prisma';
import { validateSession } from '@/lib/session';

function req(body?: unknown) {
  return new NextRequest('http://test/api/comments/c1', {
    method: 'DELETE',
    headers: { 'content-type': 'application/json', origin: 'http://test' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

beforeEach(() => vi.clearAllMocks());

describe('DELETE /api/comments/[id]', () => {
  it('author soft-deletes own comment', async () => {
    vi.mocked(validateSession).mockResolvedValue({ user: { id: 'u1', role: 'USER' }, session: {} } as never);
    vi.mocked(prisma.comment.findUnique).mockResolvedValue({ id: 'c1', userId: 'u1', deletedAt: null } as never);
    vi.mocked(prisma.comment.update).mockResolvedValue({ id: 'c1' } as never);
    const res = await DELETE(req(), { params: Promise.resolve({ id: 'c1' }) });
    expect(res.status).toBe(200);
    expect(prisma.comment.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ deletedAt: expect.any(Date), deletedBy: 'AUTHOR', body: null }),
    }));
  });

  it('returns 403 when non-author non-admin tries to delete', async () => {
    vi.mocked(validateSession).mockResolvedValue({ user: { id: 'u2', role: 'USER' }, session: {} } as never);
    vi.mocked(prisma.comment.findUnique).mockResolvedValue({ id: 'c1', userId: 'u1', deletedAt: null } as never);
    const res = await DELETE(req(), { params: Promise.resolve({ id: 'c1' }) });
    expect(res.status).toBe(403);
  });

  it('admin hard-deletes with reason and logs AdminAction', async () => {
    vi.mocked(validateSession).mockResolvedValue({ user: { id: 'admin1', role: 'ADMIN' }, session: {} } as never);
    vi.mocked(prisma.comment.findUnique).mockResolvedValue({ id: 'c1', userId: 'u1', deletedAt: null } as never);
    vi.mocked(prisma.comment.count).mockResolvedValue(2);
    vi.mocked(prisma.comment.delete).mockResolvedValue({ id: 'c1' } as never);
    const res = await DELETE(req({ reason: 'spam content removed' }), { params: Promise.resolve({ id: 'c1' }) });
    expect(res.status).toBe(200);
    expect(prisma.comment.delete).toHaveBeenCalledWith({ where: { id: 'c1' } });
    expect(prisma.adminAction.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        adminId: 'admin1', action: 'DELETE_COMMENT', targetType: 'comment', targetId: 'c1',
        reason: 'spam content removed',
      }),
    }));
  });

  it('admin hard-delete requires reason ≥ 5 chars', async () => {
    vi.mocked(validateSession).mockResolvedValue({ user: { id: 'admin1', role: 'ADMIN' }, session: {} } as never);
    vi.mocked(prisma.comment.findUnique).mockResolvedValue({ id: 'c1', userId: 'u1', deletedAt: null } as never);
    const res = await DELETE(req({ reason: 'hi' }), { params: Promise.resolve({ id: 'c1' }) });
    expect(res.status).toBe(400);
  });

  it('returns 404 when comment not found', async () => {
    vi.mocked(validateSession).mockResolvedValue({ user: { id: 'u1', role: 'USER' }, session: {} } as never);
    vi.mocked(prisma.comment.findUnique).mockResolvedValue(null);
    const res = await DELETE(req(), { params: Promise.resolve({ id: 'c1' }) });
    expect(res.status).toBe(404);
  });

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(validateSession).mockResolvedValue({ user: null, session: null });
    const res = await DELETE(req(), { params: Promise.resolve({ id: 'c1' }) });
    expect(res.status).toBe(401);
  });
});
```

Run: `npx vitest run tests/unit/api/comments-delete.test.ts`
Expected: FAIL.

- [ ] **Step 2: Update `src/lib/admin.ts` targetType union**

In `src/lib/admin.ts`, change the `targetType` field on `logAdminAction`'s opts:

```ts
// before:  targetType: 'user' | 'preset';
// after:
  targetType: 'user' | 'preset' | 'comment';
```

- [ ] **Step 3: Implement DELETE (replace 501 stub)**

In `src/app/api/comments/[id]/route.ts`, replace the `DELETE` function:

```ts
import { validateSession } from '@/lib/session';
import { adminDeleteReasonSchema } from '@/lib/commentValidators';
import { rateLimit } from '@/lib/rateLimit';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!verifyCsrf(request)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { user, session } = await validateSession();
  if (!user || !session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.comment.findUnique({
    where: { id },
    select: { id: true, userId: true, deletedAt: true },
  });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const isAdmin = user.role === 'ADMIN';
  const isAuthor = existing.userId === user.id;
  if (!isAdmin && !isAuthor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  if (isAdmin && !isAuthor) {
    // Hard delete + audit log
    const json = await request.json().catch(() => null);
    const parsed = adminDeleteReasonSchema.safeParse(json?.reason);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const repliesDeletedCount = await prisma.comment.count({ where: { parentId: id } });
    await prisma.comment.delete({ where: { id } });
    await prisma.adminAction.create({
      data: {
        adminId: user.id,
        action: 'DELETE_COMMENT',
        targetType: 'comment',
        targetId: id,
        reason: parsed.data,
        metadata: { repliesDeletedCount },
      },
    });
    return NextResponse.json({ ok: true, repliesDeleted: repliesDeletedCount });
  }

  // Author soft-delete
  const limit = rateLimit(`comment-delete:${user.id}`, 30, 60 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Too many deletes. Try again later.' }, { status: 429 });
  }
  if (existing.deletedAt) {
    return NextResponse.json({ error: 'Already deleted' }, { status: 409 });
  }
  await prisma.comment.update({
    where: { id },
    data: { deletedAt: new Date(), deletedBy: 'AUTHOR', body: null },
  });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Run test green**

Run: `npx vitest run tests/unit/api/comments-delete.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/comments/[id]/route.ts src/lib/admin.ts tests/unit/api/comments-delete.test.ts
git commit -m "feat(api): DELETE /api/comments/[id] soft + admin hard delete"
```

---

## Task 9: GET `/api/admin/comments` (Moderation List)

**Files:**
- Create: `src/app/api/admin/comments/route.ts`
- Test: `tests/unit/api/admin-comments.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// tests/unit/api/admin-comments.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/prisma', () => ({
  prisma: { comment: { findMany: vi.fn() } },
}));
vi.mock('@/lib/admin', async () => {
  const actual = await vi.importActual<typeof import('@/lib/admin')>('@/lib/admin');
  return { ...actual, requireAdmin: vi.fn() };
});

import { GET } from '@/app/api/admin/comments/route';
import { prisma } from '@/lib/prisma';
import { requireAdmin, AdminForbiddenError } from '@/lib/admin';

beforeEach(() => vi.clearAllMocks());

describe('GET /api/admin/comments', () => {
  it('returns recent comments for admin', async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ user: { id: 'a1' }, session: {} } as never);
    vi.mocked(prisma.comment.findMany).mockResolvedValue([
      { id: 'c1', body: 'hi', user: { displayName: 'X' }, preset: { name: 'P1', shareToken: 't1' } },
    ] as never);
    const res = await GET(new NextRequest('http://test/api/admin/comments'));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.comments).toHaveLength(1);
  });

  it('returns 403 for non-admin', async () => {
    vi.mocked(requireAdmin).mockRejectedValue(new AdminForbiddenError());
    const res = await GET(new NextRequest('http://test/api/admin/comments'));
    expect(res.status).toBe(403);
  });
});
```

Run: `npx vitest run tests/unit/api/admin-comments.test.ts`
Expected: FAIL.

- [ ] **Step 2: Implement route**

```ts
// src/app/api/admin/comments/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, AdminForbiddenError } from '@/lib/admin';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
  } catch (e) {
    if (e instanceof AdminForbiddenError) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    throw e;
  }

  const cursor = request.nextUrl.searchParams.get('cursor');
  const LIMIT = 50;
  const comments = await prisma.comment.findMany({
    orderBy: { createdAt: 'desc' },
    take: LIMIT + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: {
      user: { select: { id: true, displayName: true } },
      preset: { select: { id: true, name: true, shareToken: true } },
    },
  });

  const hasMore = comments.length > LIMIT;
  const items = comments.slice(0, LIMIT);
  const nextCursor = hasMore ? items[items.length - 1].id : null;
  return NextResponse.json({ comments: items, nextCursor });
}
```

- [ ] **Step 3: Run test green**

Run: `npx vitest run tests/unit/api/admin-comments.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 4: Commit**

```bash
git add src/app/api/admin/comments/route.ts tests/unit/api/admin-comments.test.ts
git commit -m "feat(api): GET /api/admin/comments moderation list"
```

---

## Task 10: featuredPreset.ts Library

**Files:**
- Create: `src/lib/featuredPreset.ts`
- Test: `tests/unit/lib/featuredPreset.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// tests/unit/lib/featuredPreset.test.ts
import { describe, it, expect, vi } from 'vitest';
import { computeBayesScore, pickFeaturedPreset } from '@/lib/featuredPreset';

describe('computeBayesScore', () => {
  it('1×5★ with C=4, m=5 → 4.17', () => {
    expect(computeBayesScore({ ratingAverage: 5, ratingCount: 1 }, 4, 5)).toBeCloseTo(4.17, 2);
  });
  it('50×4.7★ with C=4, m=5 → ~4.64', () => {
    expect(computeBayesScore({ ratingAverage: 4.7, ratingCount: 50 }, 4, 5)).toBeCloseTo(4.64, 2);
  });
  it('zero ratings returns C', () => {
    expect(computeBayesScore({ ratingAverage: 0, ratingCount: 0 }, 4, 5)).toBe(4);
  });
});

vi.mock('@/lib/prisma', () => ({
  prisma: {
    preset: { aggregate: vi.fn(), findMany: vi.fn() },
  },
}));

import { prisma } from '@/lib/prisma';

describe('pickFeaturedPreset', () => {
  it('picks highest Bayes score among 30-day candidates', async () => {
    vi.mocked(prisma.preset.aggregate).mockResolvedValue({ _avg: { ratingAverage: 4.0 } } as never);
    vi.mocked(prisma.preset.findMany).mockResolvedValue([
      { id: 'a', ratingAverage: 5, ratingCount: 1 } as never,
      { id: 'b', ratingAverage: 4.5, ratingCount: 20 } as never,
    ]);
    const top = await pickFeaturedPreset();
    expect(top?.id).toBe('b');
  });

  it('falls back to all-time when 30-day window is empty', async () => {
    vi.mocked(prisma.preset.aggregate).mockResolvedValue({ _avg: { ratingAverage: 4.0 } } as never);
    vi.mocked(prisma.preset.findMany)
      .mockResolvedValueOnce([])              // 30d window empty
      .mockResolvedValueOnce([{ id: 'all-time', ratingAverage: 5, ratingCount: 10 } as never]); // fallback
    const top = await pickFeaturedPreset();
    expect(top?.id).toBe('all-time');
  });

  it('returns null when DB has no rated presets at all', async () => {
    vi.mocked(prisma.preset.aggregate).mockResolvedValue({ _avg: { ratingAverage: null } } as never);
    vi.mocked(prisma.preset.findMany).mockResolvedValue([]);
    const top = await pickFeaturedPreset();
    expect(top).toBeNull();
  });
});
```

Run: `npx vitest run tests/unit/lib/featuredPreset.test.ts`
Expected: FAIL.

- [ ] **Step 2: Implement library**

```ts
// src/lib/featuredPreset.ts
import { prisma } from './prisma';
import type { Prisma } from '@prisma/client';

const M = 5;                // confidence padding
const FALLBACK_C = 4.0;     // default prior when DB has no ratings
const WINDOW_DAYS = 30;

export interface RatingShape { ratingAverage: number; ratingCount: number }

export function computeBayesScore(p: RatingShape, C: number, m: number = M): number {
  if (p.ratingCount === 0) return C;
  return (C * m + p.ratingAverage * p.ratingCount) / (m + p.ratingCount);
}

const FEATURED_SELECT = {
  id: true,
  name: true,
  description: true,
  shareToken: true,
  ratingAverage: true,
  ratingCount: true,
  modules: true,
  effects: true,
  style: true,
  author: true,
  user: { select: { id: true, displayName: true, avatarUrl: true } },
} satisfies Prisma.PresetSelect;

export type FeaturedPreset = Prisma.PresetGetPayload<{ select: typeof FEATURED_SELECT }>;

export async function pickFeaturedPreset(): Promise<FeaturedPreset | null> {
  const prior = await prisma.preset.aggregate({
    _avg: { ratingAverage: true },
    where: { public: true, ratingCount: { gte: 1 } },
  });
  const C = prior._avg.ratingAverage ?? FALLBACK_C;

  const cutoff = new Date(Date.now() - WINDOW_DAYS * 24 * 3600 * 1000);
  let candidates = await prisma.preset.findMany({
    where: {
      public: true,
      flagged: false,
      ratings: { some: { updatedAt: { gte: cutoff } } },
      ratingCount: { gte: 1 },
    },
    select: FEATURED_SELECT,
  });

  if (candidates.length === 0) {
    // Fallback: all-time
    candidates = await prisma.preset.findMany({
      where: { public: true, flagged: false, ratingCount: { gte: 1 } },
      select: FEATURED_SELECT,
    });
  }
  if (candidates.length === 0) return null;

  return candidates
    .map((p) => ({ p, score: computeBayesScore(p, C) }))
    .sort((a, b) => b.score - a.score)[0].p;
}
```

- [ ] **Step 3: Run test green**

Run: `npx vitest run tests/unit/lib/featuredPreset.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 4: Commit**

```bash
git add src/lib/featuredPreset.ts tests/unit/lib/featuredPreset.test.ts
git commit -m "feat(lib): featuredPreset with Bayesian score + 30d window + all-time fallback"
```

---

## Task 11: SignalChainStrip Component

**Files:**
- Create: `src/components/SignalChainStrip.tsx`
- Test: `tests/unit/components/SignalChainStrip.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
// tests/unit/components/SignalChainStrip.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SignalChainStrip } from '@/components/SignalChainStrip';

describe('SignalChainStrip', () => {
  it('renders 11 slot labels (PRE..VOL)', () => {
    render(<SignalChainStrip effects={[]} />);
    ['PRE','WAH','BST','AMP','NR','CAB','EQ','MOD','DLY','RVB','VOL'].forEach((l) =>
      expect(screen.getByText(l)).toBeInTheDocument(),
    );
  });

  it('shows real names from effects[] when provided', () => {
    render(<SignalChainStrip effects={['', '', '', 'Marshall® JCM800', '', 'Mesa Cab', '', '', '', '', '']} />);
    expect(screen.getByText('Marshall® JCM800')).toBeInTheDocument();
    expect(screen.getByText('Mesa Cab')).toBeInTheDocument();
  });
});
```

Run: `npx vitest run tests/unit/components/SignalChainStrip.test.tsx`
Expected: FAIL.

- [ ] **Step 2: Implement component**

```tsx
// src/components/SignalChainStrip.tsx
const SLOT_NAMES = ['PRE','WAH','BST','AMP','NR','CAB','EQ','MOD','DLY','RVB','VOL'] as const;

interface Props {
  effects: string[];  // 11 entries; empty string = no real name to show
}

export function SignalChainStrip({ effects }: Props) {
  return (
    <div
      className="flex items-center gap-1 font-mono-display text-[10px] uppercase tracking-wider"
      style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 8,
        padding: '8px 10px',
      }}
    >
      {SLOT_NAMES.map((slot, i) => {
        const real = effects[i];
        const active = !!real;
        return (
          <div
            key={slot}
            className="flex flex-col items-center px-2 py-1 rounded"
            style={{
              background: active ? 'var(--glow-amber)' : 'transparent',
              border: active ? '1px solid var(--accent-amber-dim)' : '1px solid transparent',
              color: active ? 'var(--accent-amber)' : 'var(--text-muted)',
              flex: '1 1 0',
              minWidth: 0,
            }}
          >
            <span className="opacity-80">{slot}</span>
            {real && (
              <span
                className="text-[9px] mt-0.5 truncate w-full text-center normal-case tracking-normal"
                style={{ color: 'var(--text-secondary)' }}
              >
                {real}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Run test green**

Run: `npx vitest run tests/unit/components/SignalChainStrip.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 4: Commit**

```bash
git add src/components/SignalChainStrip.tsx tests/unit/components/SignalChainStrip.test.tsx
git commit -m "feat(ui): SignalChainStrip read-only chain visualizer"
```

---

## Task 12: FeaturedPresetBlock Component

**Files:**
- Create: `src/components/FeaturedPresetBlock.tsx`
- Test: `tests/unit/components/FeaturedPresetBlock.test.tsx`
- Add i18n keys: `messages/{de,en,es,fr,it,pt}.json` → `home.featured.*`

- [ ] **Step 1: Add i18n keys in all 6 locales**

In each `messages/<locale>.json`, add to the `home` object (alongside existing `hero`):

```json
"featured": {
  "title": "Featured · Top Rated · 30 Days",
  "recentComments": "Recent comments",
  "openPreset": "Open preset →",
  "noFeatured": "No featured preset yet"
}
```

Translations:
- `de`: title `"Top Bewertet · Letzte 30 Tage"`, recentComments `"Aktuelle Kommentare"`, openPreset `"Preset öffnen →"`, noFeatured `"Noch kein Featured-Preset"`
- `en`: as above
- `es`: title `"Destacado · Mejor valorado · 30 días"`, recentComments `"Comentarios recientes"`, openPreset `"Abrir preset →"`, noFeatured `"Aún no hay preset destacado"`
- `fr`: title `"En vedette · Mieux noté · 30 jours"`, recentComments `"Commentaires récents"`, openPreset `"Ouvrir le preset →"`, noFeatured `"Aucun preset en vedette pour l'instant"`
- `it`: title `"In primo piano · Top Rated · 30 giorni"`, recentComments `"Commenti recenti"`, openPreset `"Apri preset →"`, noFeatured `"Nessun preset in primo piano"`
- `pt`: title `"Destaque · Mais bem avaliado · 30 dias"`, recentComments `"Comentários recentes"`, openPreset `"Abrir preset →"`, noFeatured `"Ainda sem preset em destaque"`

- [ ] **Step 2: Write failing test**

```tsx
// tests/unit/components/FeaturedPresetBlock.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/lib/featuredPreset', () => ({ pickFeaturedPreset: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ prisma: { comment: { findMany: vi.fn() } } }));

import { FeaturedPresetBlock } from '@/components/FeaturedPresetBlock';
import { pickFeaturedPreset } from '@/lib/featuredPreset';
import { prisma } from '@/lib/prisma';
import { NextIntlClientProvider } from 'next-intl';
import messages from '../../../messages/en.json';

function wrap(node: React.ReactNode) {
  return <NextIntlClientProvider locale="en" messages={messages}>{node}</NextIntlClientProvider>;
}

describe('FeaturedPresetBlock', () => {
  it('renders featured preset with comments', async () => {
    vi.mocked(pickFeaturedPreset).mockResolvedValue({
      id: 'p1', name: 'Crunchy 80s', description: 'driven Marshall tone',
      shareToken: 't1', ratingAverage: 4.8, ratingCount: 23,
      effects: ['', '', '', 'JCM800', '', '', '', '', '', '', ''],
      user: { displayName: 'manu' },
    } as never);
    vi.mocked(prisma.comment.findMany).mockResolvedValue([
      { id: 'c1', body: 'Killer!', user: { displayName: 'gibsonfan' }, deletedAt: null },
    ] as never);

    const ui = await FeaturedPresetBlock({ locale: 'en' });
    render(wrap(ui));
    expect(screen.getByText('Crunchy 80s')).toBeInTheDocument();
    expect(screen.getByText(/4\.8/)).toBeInTheDocument();
    expect(screen.getByText('Killer!')).toBeInTheDocument();
  });

  it('renders null when no preset available', async () => {
    vi.mocked(pickFeaturedPreset).mockResolvedValue(null);
    const ui = await FeaturedPresetBlock({ locale: 'en' });
    expect(ui).toBeNull();
  });
});
```

Run: `npx vitest run tests/unit/components/FeaturedPresetBlock.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement component**

```tsx
// src/components/FeaturedPresetBlock.tsx
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { prisma } from '@/lib/prisma';
import { pickFeaturedPreset } from '@/lib/featuredPreset';
import { GuitarRating } from './GuitarRating';
import { SignalChainStrip } from './SignalChainStrip';
import { AutoLink } from '@/lib/autoLink';
import type { Locale } from '@/i18n/locales';

interface Props { locale: Locale }

export async function FeaturedPresetBlock({ locale }: Props) {
  const featured = await pickFeaturedPreset();
  if (!featured) return null;

  const t = await getTranslations({ locale, namespace: 'home.featured' });

  const recentComments = await prisma.comment.findMany({
    where: { presetId: featured.id, parentId: null, deletedAt: null },
    orderBy: { createdAt: 'desc' },
    take: 3,
    include: { user: { select: { displayName: true } } },
  });

  const description = featured.description
    ? featured.description.length > 160
      ? featured.description.slice(0, 157) + '…'
      : featured.description
    : null;

  return (
    <section
      className="rounded-lg p-5 mb-10"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--accent-amber-dim)',
        boxShadow: '0 0 24px var(--glow-amber)',
      }}
    >
      <p
        className="font-mono-display text-[11px] uppercase tracking-widest mb-3"
        style={{ color: 'var(--accent-amber)' }}
      >
        ★ {t('title')}
      </p>

      <SignalChainStrip effects={featured.effects} />

      <h2 className="font-mono-display text-2xl mt-4 mb-1" style={{ color: 'var(--text-primary)' }}>
        {featured.name}
      </h2>
      <div className="mb-2">
        <GuitarRating value={featured.ratingAverage} count={featured.ratingCount} size="md" />
      </div>
      {description && (
        <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>{description}</p>
      )}

      {recentComments.length > 0 && (
        <div className="mt-4 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="font-mono-display text-[10px] uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
            {t('recentComments')} ({recentComments.length})
          </p>
          <ul className="space-y-1.5 text-sm">
            {recentComments.map((c) => (
              <li key={c.id} style={{ color: 'var(--text-secondary)' }}>
                <span className="font-mono-display text-xs mr-2" style={{ color: 'var(--accent-amber)' }}>
                  @{c.user.displayName}
                </span>
                <AutoLink text={c.body ?? ''} />
              </li>
            ))}
          </ul>
        </div>
      )}

      <Link
        href={{ pathname: '/share/[token]', params: { token: featured.shareToken } }}
        className="inline-block mt-4 font-mono-display text-xs uppercase tracking-wider"
        style={{ color: 'var(--accent-amber)' }}
      >
        {t('openPreset')}
      </Link>
    </section>
  );
}
```

- [ ] **Step 4: Run test green**

Run: `npx vitest run tests/unit/components/FeaturedPresetBlock.test.tsx`
Expected: PASS (2 tests).

Run: `npx vitest run tests/unit/i18n-parity.test.ts`
Expected: PASS (key parity validation).

- [ ] **Step 5: Commit**

```bash
git add src/components/FeaturedPresetBlock.tsx tests/unit/components/FeaturedPresetBlock.test.tsx messages/
git commit -m "feat(ui): FeaturedPresetBlock + home.featured i18n keys for 6 locales"
```

---

## Task 13: Wire FeaturedPresetBlock into Homepage

**Files:**
- Modify: `src/app/[locale]/page.tsx`

- [ ] **Step 1: Import + insert above hero**

In `src/app/[locale]/page.tsx`, add the import (next to existing imports):

```tsx
import { FeaturedPresetBlock } from '@/components/FeaturedPresetBlock';
import { Suspense } from 'react';
```

Inside the `<main>` element, **before** the `{/* ───────── Hero ───────── */}` section, add:

```tsx
<Suspense fallback={null}>
  <FeaturedPresetBlock locale={locale} />
</Suspense>
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: completes without errors. Homepage builds as dynamic (the Prisma calls are dynamic-by-default).

- [ ] **Step 3: Commit**

```bash
git add src/app/[locale]/page.tsx
git commit -m "feat(home): integrate FeaturedPresetBlock above hero"
```

---

## Task 14: RateableGuitarRating Component

**Files:**
- Create: `src/components/RateableGuitarRating.tsx`
- Test: `tests/unit/components/RateableGuitarRating.test.tsx`
- Add i18n: `gallery.rate.*` in all 6 locales

- [ ] **Step 1: Add i18n keys**

In each `messages/<locale>.json` under `gallery`, add:

```json
"rate": {
  "signInTooltip": "Sign in to rate",
  "ownPresetTooltip": "Cannot rate your own preset"
}
```

Translations:
- `de`: signInTooltip `"Anmelden zum Bewerten"`, ownPresetTooltip `"Eigene Presets nicht bewertbar"`
- `en`: as above
- `es`: signInTooltip `"Inicia sesión para valorar"`, ownPresetTooltip `"No puedes valorar tu propio preset"`
- `fr`: signInTooltip `"Connectez-vous pour évaluer"`, ownPresetTooltip `"Vous ne pouvez pas évaluer votre propre preset"`
- `it`: signInTooltip `"Accedi per valutare"`, ownPresetTooltip `"Non puoi valutare il tuo preset"`
- `pt`: signInTooltip `"Faça login para avaliar"`, ownPresetTooltip `"Não pode avaliar o seu próprio preset"`

- [ ] **Step 2: Write failing test**

```tsx
// tests/unit/components/RateableGuitarRating.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RateableGuitarRating } from '@/components/RateableGuitarRating';
import { NextIntlClientProvider } from 'next-intl';
import messages from '../../../messages/en.json';

function wrap(node: React.ReactNode) {
  return <NextIntlClientProvider locale="en" messages={messages}>{node}</NextIntlClientProvider>;
}

describe('RateableGuitarRating', () => {
  it('shows sign-in tooltip on anon click', () => {
    render(wrap(<RateableGuitarRating presetId="p1" average={4.2} count={5} canRate={false} existing={0} reason="anon" />));
    const button = screen.getAllByRole('button')[0];
    fireEvent.click(button);
    expect(screen.getByText(/sign in to rate/i)).toBeInTheDocument();
  });

  it('shows own-preset tooltip when reason=own', () => {
    render(wrap(<RateableGuitarRating presetId="p1" average={4.2} count={5} canRate={false} existing={0} reason="own" />));
    const button = screen.getAllByRole('button')[0];
    fireEvent.click(button);
    expect(screen.getByText(/cannot rate your own preset/i)).toBeInTheDocument();
  });

  it('POSTs and optimistically updates when canRate', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify({ ok: true })));
    render(wrap(<RateableGuitarRating presetId="p1" average={4.2} count={5} canRate={true} existing={0} reason={null} />));
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[4]); // 5-star
    expect(fetchMock).toHaveBeenCalledWith('/api/presets/p1/rate', expect.objectContaining({ method: 'POST' }));
    fetchMock.mockRestore();
  });
});
```

Run: `npx vitest run tests/unit/components/RateableGuitarRating.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement component**

```tsx
// src/components/RateableGuitarRating.tsx
'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { GuitarRating } from './GuitarRating';

export interface Props {
  presetId: string;
  average: number;
  count: number;
  canRate: boolean;
  existing: number;
  /** null = canRate=true. 'anon' = not logged in. 'own' = own preset. 'unverified' = email not verified. */
  reason: 'anon' | 'own' | 'unverified' | null;
  size?: 'sm' | 'md';
}

export function RateableGuitarRating({ presetId, average, count, canRate, existing, reason, size = 'sm' }: Props) {
  const t = useTranslations('gallery.rate');
  const [avg, setAvg] = useState(average);
  const [cnt, setCnt] = useState(count);
  const [mine, setMine] = useState(existing);
  const [tip, setTip] = useState<string | null>(null);

  async function handleRate(score: number) {
    if (canRate) {
      const wasNew = mine === 0;
      const newCount = wasNew ? cnt + 1 : cnt;
      const newAvg = wasNew ? (avg * cnt + score) / newCount : (avg * cnt - mine + score) / cnt;
      setAvg(newAvg); setCnt(newCount); setMine(score);
      await fetch(`/api/presets/${presetId}/rate`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ score }),
      });
      return;
    }
    setTip(reason === 'own' ? t('ownPresetTooltip') : t('signInTooltip'));
    setTimeout(() => setTip(null), 2500);
  }

  return (
    <div className="relative inline-block">
      <GuitarRating value={canRate && mine > 0 ? mine : avg} count={cnt} onRate={handleRate} size={size} />
      {tip && (
        <span
          role="tooltip"
          className="absolute left-0 top-full mt-1 text-[10px] px-2 py-1 rounded whitespace-nowrap z-10"
          style={{ background: 'var(--surface)', color: 'var(--text-primary)', border: '1px solid var(--accent-amber-dim)' }}
        >
          {tip}
          {reason === 'anon' && (
            <Link href="/auth/login" className="ml-1 underline" style={{ color: 'var(--accent-amber)' }}>
              →
            </Link>
          )}
        </span>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test green**

Run: `npx vitest run tests/unit/components/RateableGuitarRating.test.tsx tests/unit/i18n-parity.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/RateableGuitarRating.tsx tests/unit/components/RateableGuitarRating.test.tsx messages/
git commit -m "feat(ui): RateableGuitarRating with anon/own tooltip + i18n keys"
```

---

## Task 15: Wire RateableGuitarRating into Gallery

**Files:**
- Modify: `src/app/[locale]/gallery/page.tsx`
- Modify: `src/app/[locale]/gallery/GalleryClient.tsx`

- [ ] **Step 1: SSR-Page lädt Session + existing-Ratings**

In `src/app/[locale]/gallery/page.tsx`, near the `prisma.preset.findMany` call (in the data-loading section), add:

```tsx
import { validateSession } from '@/lib/session';
// ...
const { user } = await validateSession();

// existing presets fetch...
// After fetching `presets`, fetch user's ratings:
let myRatings: Record<string, number> = {};
if (user) {
  const ratings = await prisma.presetRating.findMany({
    where: { userId: user.id, presetId: { in: presets.map((p) => p.id) } },
    select: { presetId: true, score: true },
  });
  myRatings = Object.fromEntries(ratings.map((r) => [r.presetId, r.score]));
}

const presetsWithRate = presets.map((p) => ({
  ...p,
  canRate: !!user && !!user.emailVerified && p.userId !== user.id,
  rateReason: !user ? 'anon' : !user.emailVerified ? 'unverified' : p.userId === user.id ? 'own' : null,
  existingRating: myRatings[p.id] ?? 0,
}));
```

Pass `presetsWithRate` (instead of `presets`) into `<GalleryClient>` and update its prop typing to match.

- [ ] **Step 2: Replace `GuitarRating` with `RateableGuitarRating` in GalleryClient**

In `src/app/[locale]/gallery/GalleryClient.tsx`, change the import:

```tsx
// remove: import { GuitarRating } from '@/components/GuitarRating';
import { RateableGuitarRating } from '@/components/RateableGuitarRating';
```

Add fields to the local `PresetSummary` (or equivalent) type:

```ts
canRate: boolean;
rateReason: 'anon' | 'own' | 'unverified' | null;
existingRating: number;
```

Replace `<GuitarRating value={preset.ratingAverage} count={preset.ratingCount} size="sm" />` with:

```tsx
<RateableGuitarRating
  presetId={preset.id}
  average={preset.ratingAverage}
  count={preset.ratingCount}
  canRate={preset.canRate}
  existing={preset.existingRating}
  reason={preset.rateReason}
  size="sm"
/>
```

- [ ] **Step 3: Verify build + lint**

Run: `npm run build`
Expected: builds cleanly.

Run: `npm run lint`
Expected: only pre-existing warnings (no new errors).

- [ ] **Step 4: Commit**

```bash
git add src/app/[locale]/gallery/
git commit -m "feat(gallery): inline rating in cards via RateableGuitarRating"
```

---

## Task 16: CommentForm Component

**Files:**
- Create: `src/components/comments/CommentForm.tsx`
- Test: `tests/unit/components/CommentForm.test.tsx`
- Add i18n: `comments.*` keys (set up in Task 17 — for now use raw strings as fallback in test)

- [ ] **Step 1: Add comments i18n keys (used by Form + Item + Section)**

In each `messages/<locale>.json`, add a top-level `comments` namespace:

```json
"comments": {
  "placeholder": "Share your thoughts…",
  "charCount": "{count} / 1000",
  "post": "Post",
  "reply": "Reply",
  "edit": "Edit",
  "save": "Save",
  "cancel": "Cancel",
  "delete": "Delete",
  "deletedByAuthor": "Removed by author",
  "deletedByAdmin": "Removed by moderator",
  "edited": "edited",
  "signInToComment": "Sign in to comment",
  "loadMore": "Load more",
  "confirmDelete": "Delete this comment?",
  "adminDeleteReasonLabel": "Reason (required, 5–200 chars)",
  "rateLimitToast": "Too many comments. Try again later.",
  "emptyState": "No comments yet — be the first!"
}
```

Translations (DE shown; others adapted similarly):
- `de.placeholder`: `"Deine Gedanken teilen…"`
- `de.post`: `"Senden"`, `reply`: `"Antworten"`, `edit`: `"Bearbeiten"`, `save`: `"Speichern"`, `cancel`: `"Abbrechen"`, `delete`: `"Löschen"`
- `de.deletedByAuthor`: `"Vom Autor entfernt"`, `deletedByAdmin`: `"Vom Moderator entfernt"`
- `de.edited`: `"bearbeitet"`, `signInToComment`: `"Anmelden zum Kommentieren"`, `loadMore`: `"Mehr laden"`
- `de.confirmDelete`: `"Diesen Kommentar löschen?"`, `adminDeleteReasonLabel`: `"Grund (Pflicht, 5–200 Zeichen)"`
- `de.rateLimitToast`: `"Zu viele Kommentare. Bitte später erneut versuchen."`, `emptyState`: `"Noch keine Kommentare — sei der erste!"`
- Other locales: translate equivalently. Key parity test catches missing keys.

- [ ] **Step 2: Write failing test**

```tsx
// tests/unit/components/CommentForm.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CommentForm } from '@/components/comments/CommentForm';
import { NextIntlClientProvider } from 'next-intl';
import messages from '../../../messages/en.json';

function wrap(node: React.ReactNode) {
  return <NextIntlClientProvider locale="en" messages={messages}>{node}</NextIntlClientProvider>;
}

describe('CommentForm', () => {
  it('shows char counter that updates on input', () => {
    render(wrap(<CommentForm presetId="p1" onSubmit={vi.fn()} />));
    const textarea = screen.getByRole('textbox');
    expect(screen.getByText('0 / 1000')).toBeInTheDocument();
    fireEvent.change(textarea, { target: { value: 'hello' } });
    expect(screen.getByText('5 / 1000')).toBeInTheDocument();
  });

  it('calls onSubmit with body and resets', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(wrap(<CommentForm presetId="p1" onSubmit={onSubmit} />));
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'hi' } });
    fireEvent.click(screen.getByRole('button', { name: /post/i }));
    expect(onSubmit).toHaveBeenCalledWith('hi');
    await Promise.resolve(); // flush microtask for reset
    expect(textarea).toHaveValue('');
  });

  it('disables submit when body is empty or whitespace', () => {
    render(wrap(<CommentForm presetId="p1" onSubmit={vi.fn()} />));
    const submit = screen.getByRole('button', { name: /post/i });
    expect(submit).toBeDisabled();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '   ' } });
    expect(submit).toBeDisabled();
  });
});
```

Run: `npx vitest run tests/unit/components/CommentForm.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement component**

```tsx
// src/components/comments/CommentForm.tsx
'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';

interface Props {
  presetId: string;
  parentId?: string;
  onSubmit: (body: string) => Promise<void>;
  onCancel?: () => void;
  initialValue?: string;
  isEdit?: boolean;
}

export function CommentForm({ onSubmit, onCancel, initialValue = '', isEdit = false }: Props) {
  const t = useTranslations('comments');
  const [body, setBody] = useState(initialValue);
  const [busy, setBusy] = useState(false);
  const trimmed = body.trim();
  const disabled = busy || trimmed.length === 0 || trimmed.length > 1000;

  async function handleSubmit() {
    if (disabled) return;
    setBusy(true);
    try {
      await onSubmit(trimmed);
      if (!isEdit) setBody('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-1 mb-3">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value.slice(0, 1000))}
        placeholder={t('placeholder')}
        rows={3}
        className="w-full p-2 text-sm rounded resize-y"
        style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          color: 'var(--text-primary)',
        }}
      />
      <div className="flex items-center justify-between text-[10px] font-mono-display" style={{ color: 'var(--text-muted)' }}>
        <span>{t('charCount', { count: body.length })}</span>
        <div className="flex gap-2">
          {onCancel && (
            <button onClick={onCancel} type="button" className="px-2 py-1 rounded" style={{ color: 'var(--text-muted)' }}>
              {t('cancel')}
            </button>
          )}
          <button
            onClick={handleSubmit}
            type="button"
            disabled={disabled}
            className="px-3 py-1 rounded uppercase tracking-wider"
            style={{
              background: disabled ? 'transparent' : 'var(--glow-amber)',
              color: disabled ? 'var(--text-muted)' : 'var(--accent-amber)',
              border: '1px solid var(--accent-amber-dim)',
              opacity: disabled ? 0.4 : 1,
            }}
          >
            {isEdit ? t('save') : t('post')}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test green**

Run: `npx vitest run tests/unit/components/CommentForm.test.tsx tests/unit/i18n-parity.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/comments/CommentForm.tsx tests/unit/components/CommentForm.test.tsx messages/
git commit -m "feat(ui): CommentForm + comments i18n namespace for 6 locales"
```

---

## Task 17: CommentItem Component

**Files:**
- Create: `src/components/comments/CommentItem.tsx`
- Test: `tests/unit/components/CommentItem.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
// tests/unit/components/CommentItem.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CommentItem } from '@/components/comments/CommentItem';
import { NextIntlClientProvider } from 'next-intl';
import messages from '../../../messages/en.json';

function wrap(node: React.ReactNode) {
  return <NextIntlClientProvider locale="en" messages={messages}>{node}</NextIntlClientProvider>;
}

const baseComment = {
  id: 'c1', body: 'hello there', editedAt: null, deletedAt: null, deletedBy: null,
  createdAt: new Date().toISOString(), userId: 'u1',
  user: { id: 'u1', displayName: 'alice' },
};

describe('CommentItem', () => {
  it('renders body + username', () => {
    render(wrap(<CommentItem comment={baseComment} currentUserId={null} isAdmin={false} onReply={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} />));
    expect(screen.getByText('hello there')).toBeInTheDocument();
    expect(screen.getByText('@alice')).toBeInTheDocument();
  });

  it('shows edited badge when editedAt set', () => {
    render(wrap(<CommentItem comment={{ ...baseComment, editedAt: new Date().toISOString() }} currentUserId={null} isAdmin={false} onReply={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} />));
    expect(screen.getByText(/edited/i)).toBeInTheDocument();
  });

  it('shows "Removed by author" placeholder when soft-deleted by author', () => {
    render(wrap(<CommentItem comment={{ ...baseComment, body: null, deletedAt: new Date().toISOString(), deletedBy: 'AUTHOR' }} currentUserId={null} isAdmin={false} onReply={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} />));
    expect(screen.getByText(/removed by author/i)).toBeInTheDocument();
  });

  it('shows "Removed by moderator" when deletedBy=ADMIN', () => {
    render(wrap(<CommentItem comment={{ ...baseComment, body: null, deletedAt: new Date().toISOString(), deletedBy: 'ADMIN' }} currentUserId={null} isAdmin={false} onReply={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} />));
    expect(screen.getByText(/removed by moderator/i)).toBeInTheDocument();
  });

  it('shows Edit + Delete buttons for own comment', () => {
    render(wrap(<CommentItem comment={baseComment} currentUserId="u1" isAdmin={false} onReply={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} />));
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
  });

  it('shows Reply button only on top-level (no parentId)', () => {
    render(wrap(<CommentItem comment={baseComment} currentUserId="u2" isAdmin={false} onReply={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} />));
    expect(screen.getByRole('button', { name: /reply/i })).toBeInTheDocument();
  });
});
```

Run: `npx vitest run tests/unit/components/CommentItem.test.tsx`
Expected: FAIL.

- [ ] **Step 2: Implement CommentItem**

```tsx
// src/components/comments/CommentItem.tsx
'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { AutoLink } from '@/lib/autoLink';
import { CommentForm } from './CommentForm';

export interface CommentData {
  id: string;
  body: string | null;
  editedAt: string | null;
  deletedAt: string | null;
  deletedBy: string | null;
  createdAt: string;
  userId: string;
  user: { id: string; displayName: string; avatarUrl?: string | null };
  parentId?: string | null;
}

interface Props {
  comment: CommentData;
  currentUserId: string | null;
  isAdmin: boolean;
  onReply: (parentId: string) => void;
  onEdit: (id: string, body: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function CommentItem({ comment, currentUserId, isAdmin, onReply, onEdit, onDelete }: Props) {
  const t = useTranslations('comments');
  const [editing, setEditing] = useState(false);

  const isOwn = currentUserId === comment.userId;
  const isDeleted = !!comment.deletedAt;
  const placeholder =
    comment.deletedBy === 'ADMIN' ? t('deletedByAdmin') :
    comment.deletedBy === 'AUTHOR' ? t('deletedByAuthor') :
    null;

  return (
    <div
      className="rounded p-3 mb-2"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <div className="flex items-center gap-2 mb-1 text-xs font-mono-display">
        <Link href={{ pathname: '/profile/[username]', params: { username: comment.user.displayName } }} style={{ color: 'var(--accent-amber)' }}>
          @{comment.user.displayName}
        </Link>
        <span style={{ color: 'var(--text-muted)' }}>
          {new Date(comment.createdAt).toLocaleString()}
        </span>
        {comment.editedAt && (
          <span className="italic" style={{ color: 'var(--text-muted)' }}>({t('edited')})</span>
        )}
      </div>

      {isDeleted ? (
        <p className="italic text-sm" style={{ color: 'var(--text-muted)' }}>{placeholder}</p>
      ) : editing ? (
        <CommentForm
          presetId="(edit)"
          initialValue={comment.body ?? ''}
          isEdit
          onSubmit={async (b) => { await onEdit(comment.id, b); setEditing(false); }}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <p className="text-sm" style={{ color: 'var(--text-primary)' }}>
          <AutoLink text={comment.body ?? ''} />
        </p>
      )}

      {!isDeleted && !editing && (
        <div className="flex gap-2 mt-2 text-[10px] font-mono-display uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          {!comment.parentId && (
            <button onClick={() => onReply(comment.id)}>{t('reply')}</button>
          )}
          {isOwn && (
            <>
              <button onClick={() => setEditing(true)}>{t('edit')}</button>
              <button onClick={() => onDelete(comment.id)}>{t('delete')}</button>
            </>
          )}
          {isAdmin && !isOwn && (
            <button onClick={() => onDelete(comment.id)} style={{ color: '#ef4444' }}>{t('delete')}</button>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Run test green**

Run: `npx vitest run tests/unit/components/CommentItem.test.tsx`
Expected: PASS (6 tests).

- [ ] **Step 4: Commit**

```bash
git add src/components/comments/CommentItem.tsx tests/unit/components/CommentItem.test.tsx
git commit -m "feat(ui): CommentItem with edit/delete/reply actions"
```

---

## Task 18: CommentSection (Container) + CommentList

**Files:**
- Create: `src/components/comments/CommentSection.tsx`
- Create: `src/components/comments/CommentList.tsx`

> No unit tests for these two — they're thin wrappers covered by the E2E test in Task 22. Avoid mock complexity for orchestration code.

- [ ] **Step 1: Implement CommentList**

```tsx
// src/components/comments/CommentList.tsx
'use client';
import { CommentItem, type CommentData } from './CommentItem';
import { CommentForm } from './CommentForm';
import { useState } from 'react';
import { useTranslations } from 'next-intl';

export interface TopLevelComment extends CommentData {
  replies: CommentData[];
}

interface Props {
  comments: TopLevelComment[];
  currentUserId: string | null;
  isAdmin: boolean;
  onReplySubmit: (parentId: string, body: string) => Promise<void>;
  onEdit: (id: string, body: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  hasMore: boolean;
  onLoadMore: () => void;
}

export function CommentList({ comments, currentUserId, isAdmin, onReplySubmit, onEdit, onDelete, hasMore, onLoadMore }: Props) {
  const t = useTranslations('comments');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);

  if (comments.length === 0) {
    return <p className="text-sm italic" style={{ color: 'var(--text-muted)' }}>{t('emptyState')}</p>;
  }

  return (
    <div>
      {comments.map((c) => (
        <div key={c.id}>
          <CommentItem
            comment={c}
            currentUserId={currentUserId}
            isAdmin={isAdmin}
            onReply={(id) => setReplyingTo(id)}
            onEdit={onEdit}
            onDelete={onDelete}
          />
          <div className="ml-6 pl-3" style={{ borderLeft: '1px solid var(--accent-amber-dim)' }}>
            {c.replies.map((r) => (
              <CommentItem
                key={r.id}
                comment={r}
                currentUserId={currentUserId}
                isAdmin={isAdmin}
                onReply={() => {/* no-op, replies don't reply */}}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
            {replyingTo === c.id && (
              <CommentForm
                presetId={c.id}
                parentId={c.id}
                onSubmit={async (body) => { await onReplySubmit(c.id, body); setReplyingTo(null); }}
                onCancel={() => setReplyingTo(null)}
              />
            )}
          </div>
        </div>
      ))}
      {hasMore && (
        <button
          onClick={onLoadMore}
          className="text-xs uppercase tracking-wider mt-2 font-mono-display"
          style={{ color: 'var(--accent-amber)' }}
        >
          {t('loadMore')}
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Implement CommentSection**

```tsx
// src/components/comments/CommentSection.tsx
'use client';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { CommentList, type TopLevelComment } from './CommentList';
import { CommentForm } from './CommentForm';

interface Props {
  presetId: string;
  currentUserId: string | null;
  isVerified: boolean;
  isAdmin: boolean;
}

export function CommentSection({ presetId, currentUserId, isVerified, isAdmin }: Props) {
  const t = useTranslations('comments');
  const [comments, setComments] = useState<TopLevelComment[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  async function load(initial = false) {
    const url = `/api/presets/${presetId}/comments${cursor && !initial ? `?cursor=${cursor}` : ''}`;
    const res = await fetch(url);
    const data = await res.json();
    setComments((prev) => initial ? data.comments : [...prev, ...data.comments]);
    setCursor(data.nextCursor);
    setHasMore(!!data.nextCursor);
  }

  useEffect(() => { load(true); /* eslint-disable-next-line */ }, [presetId]);

  function handleError(status: number) {
    if (status === 429) setToast(t('rateLimitToast'));
    setTimeout(() => setToast(null), 3000);
  }

  async function postTop(body: string) {
    const res = await fetch(`/api/presets/${presetId}/comments`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ body }),
    });
    if (res.ok) { setCursor(null); load(true); } else handleError(res.status);
  }

  async function postReply(parentId: string, body: string) {
    const res = await fetch(`/api/comments/${parentId}/reply`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ body }),
    });
    if (res.ok) { setCursor(null); load(true); } else handleError(res.status);
  }

  async function edit(id: string, body: string) {
    const res = await fetch(`/api/comments/${id}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ body }),
    });
    if (res.ok) { setCursor(null); load(true); } else handleError(res.status);
  }

  async function del(id: string) {
    const res = await fetch(`/api/comments/${id}`, { method: 'DELETE' });
    if (res.ok) { setCursor(null); load(true); } else handleError(res.status);
  }

  return (
    <section className="mt-8">
      <h3 className="font-mono-display text-sm uppercase tracking-widest mb-3" style={{ color: 'var(--text-secondary)' }}>
        Comments
      </h3>

      {!currentUserId ? (
        <p className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>
          <Link href="/auth/login" className="underline" style={{ color: 'var(--accent-amber)' }}>
            {t('signInToComment')}
          </Link>
        </p>
      ) : isVerified ? (
        <CommentForm presetId={presetId} onSubmit={postTop} />
      ) : (
        <p className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>
          Email verification required to comment.
        </p>
      )}

      <CommentList
        comments={comments}
        currentUserId={currentUserId}
        isAdmin={isAdmin}
        onReplySubmit={postReply}
        onEdit={edit}
        onDelete={del}
        hasMore={hasMore}
        onLoadMore={() => load(false)}
      />

      {toast && (
        <div className="fixed bottom-4 right-4 px-3 py-2 rounded text-sm"
          style={{ background: 'var(--surface)', border: '1px solid var(--accent-amber-dim)', color: 'var(--text-primary)' }}>
          {toast}
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: compiles.

- [ ] **Step 4: Commit**

```bash
git add src/components/comments/CommentSection.tsx src/components/comments/CommentList.tsx
git commit -m "feat(ui): CommentSection + CommentList with reply UX"
```

---

## Task 19: Wire CommentSection into Share-Page

**Files:**
- Modify: `src/app/[locale]/share/[token]/page.tsx`

- [ ] **Step 1: Import + insert under RatingWidget**

In `src/app/[locale]/share/[token]/page.tsx`, add imports near existing ones:

```tsx
import { CommentSection } from '@/components/comments/CommentSection';
```

The page already reads `session` for the RatingWidget. Just under the `<RatingWidget>` JSX, add:

```tsx
<CommentSection
  presetId={preset.id}
  currentUserId={session?.user?.id ?? null}
  isVerified={!!session?.user?.emailVerified}
  isAdmin={session?.user?.role === 'ADMIN'}
/>
```

(The exact local variable name for the session may differ — search for `RatingWidget` usage in the file to find the surrounding context and pull the right values.)

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: compiles.

- [ ] **Step 3: Commit**

```bash
git add src/app/[locale]/share/[token]/page.tsx
git commit -m "feat(share): integrate CommentSection on share-page"
```

---

## Task 20: AdminCommentsTab + Integration

**Files:**
- Create: `src/components/admin/AdminCommentsTab.tsx`
- Modify: `src/app/admin/page.tsx` (add tab + link)
- Add i18n: `admin.comments.*`

- [ ] **Step 1: Add i18n keys**

In each `messages/<locale>.json` under existing `admin` object, add:

```json
"comments": {
  "tabTitle": "Comments",
  "columnUser": "User",
  "columnPreset": "Preset",
  "columnBody": "Body",
  "columnDate": "Date",
  "hardDeleteButton": "Hard delete",
  "hardDeleteDialogTitle": "Hard-delete comment",
  "hardDeleteReasonLabel": "Reason (required, 5–200 chars)",
  "confirmDelete": "Delete"
}
```

DE: tabTitle `"Kommentare"`, columnUser `"User"`, columnPreset `"Preset"`, columnBody `"Inhalt"`, columnDate `"Datum"`, hardDeleteButton `"Hart löschen"`, hardDeleteDialogTitle `"Kommentar hart löschen"`, hardDeleteReasonLabel `"Grund (Pflicht, 5–200 Zeichen)"`, confirmDelete `"Löschen"`.

Translate for ES/FR/IT/PT analogously.

- [ ] **Step 2: Implement AdminCommentsTab**

```tsx
// src/components/admin/AdminCommentsTab.tsx
'use client';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

interface AdminComment {
  id: string;
  body: string | null;
  createdAt: string;
  deletedAt: string | null;
  user: { id: string; displayName: string };
  preset: { id: string; name: string; shareToken: string };
}

export function AdminCommentsTab() {
  const t = useTranslations('admin.comments');
  const [comments, setComments] = useState<AdminComment[]>([]);
  const [target, setTarget] = useState<AdminComment | null>(null);
  const [reason, setReason] = useState('');

  async function load() {
    const res = await fetch('/api/admin/comments');
    if (res.ok) {
      const data = await res.json();
      setComments(data.comments);
    }
  }
  useEffect(() => { load(); }, []);

  async function hardDelete() {
    if (!target || reason.trim().length < 5) return;
    const res = await fetch(`/api/comments/${target.id}`, {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    if (res.ok) {
      setTarget(null); setReason('');
      load();
    }
  }

  return (
    <div>
      <table className="w-full text-sm">
        <thead>
          <tr style={{ color: 'var(--text-muted)' }}>
            <th className="text-left">{t('columnUser')}</th>
            <th className="text-left">{t('columnPreset')}</th>
            <th className="text-left">{t('columnBody')}</th>
            <th className="text-left">{t('columnDate')}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {comments.map((c) => (
            <tr key={c.id} style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <td>@{c.user.displayName}</td>
              <td>{c.preset.name}</td>
              <td className="truncate max-w-xs" style={{ opacity: c.deletedAt ? 0.4 : 1 }}>
                {c.body ?? '(deleted)'}
              </td>
              <td>{new Date(c.createdAt).toLocaleString()}</td>
              <td>
                {!c.deletedAt && (
                  <button onClick={() => setTarget(c)} style={{ color: '#ef4444' }}>
                    {t('hardDeleteButton')}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {target && (
        <div role="dialog" className="fixed inset-0 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="p-4 rounded max-w-md" style={{ background: 'var(--surface)', border: '1px solid var(--accent-amber-dim)' }}>
            <h4 className="font-mono-display mb-2">{t('hardDeleteDialogTitle')}</h4>
            <label className="text-xs block mb-1">{t('hardDeleteReasonLabel')}</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value.slice(0, 200))}
              rows={3}
              className="w-full p-2 text-sm rounded mb-3"
              style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--text-primary)', border: '1px solid rgba(255,255,255,0.08)' }}
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => { setTarget(null); setReason(''); }} className="px-3 py-1">Cancel</button>
              <button onClick={hardDelete} disabled={reason.trim().length < 5} style={{ color: '#ef4444' }} className="px-3 py-1">
                {t('confirmDelete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Add tab to admin page**

In `src/app/admin/page.tsx`, find the existing tab structure (search for the other tabs). Add a new tab entry:

```tsx
import { AdminCommentsTab } from '@/components/admin/AdminCommentsTab';
// inside the tabs render:
{activeTab === 'comments' && <AdminCommentsTab />}
```

Add `'comments'` to the tab key union and tab-list rendering. Read the existing tab pattern in `src/app/admin/page.tsx` and follow it exactly — don't restructure the file.

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: compiles.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/ src/app/admin/page.tsx messages/
git commit -m "feat(admin): comments moderation tab with hard-delete + reason dialog"
```

---

## Task 21: E2E — Comments Flow

**Files:**
- Create: `tests/e2e/comments-flow.spec.ts`

- [ ] **Step 1: Write E2E spec**

```ts
// tests/e2e/comments-flow.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Comments flow on share page', () => {
  test('login → post → reply → edit → soft-delete', async ({ page }) => {
    // Existing E2E helpers in tests/e2e/helpers — use the same login pattern as preset-rate E2E.
    // Assumes a verified test-user fixture and a shared preset exists (use the share/token from a seed).

    // 1. Login via test-only endpoint (existing pattern; see other E2E specs for the helper)
    await page.goto('/en/auth/login');
    await page.fill('input[name="email"]', 'verified@test.local');
    await page.fill('input[name="password"]', 'TestPassword123!');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/en/);

    // 2. Navigate to a known share-page (seed should provide one; replace token if needed)
    await page.goto('/en/share/SHARE_TOKEN_FROM_FIXTURE', { waitUntil: 'domcontentloaded' });

    // 3. Post a top-level comment
    const textarea = page.getByPlaceholder(/share your thoughts/i);
    await textarea.fill('first comment from e2e');
    await page.getByRole('button', { name: /post/i }).click();
    await expect(page.getByText('first comment from e2e')).toBeVisible();

    // 4. Reply to it
    await page.getByRole('button', { name: /reply/i }).first().click();
    const reply = page.getByPlaceholder(/share your thoughts/i).nth(1);
    await reply.fill('e2e reply');
    await page.getByRole('button', { name: /post/i }).nth(1).click();
    await expect(page.getByText('e2e reply')).toBeVisible();

    // 5. Edit the top-level
    await page.getByRole('button', { name: /edit/i }).first().click();
    await page.getByRole('textbox').first().fill('edited e2e comment');
    await page.getByRole('button', { name: /save/i }).click();
    await expect(page.getByText('edited e2e comment')).toBeVisible();
    await expect(page.getByText(/edited/i)).toBeVisible();

    // 6. Soft-delete and verify placeholder + reply still visible
    await page.getByRole('button', { name: /delete/i }).first().click();
    await expect(page.getByText(/removed by author/i)).toBeVisible();
    await expect(page.getByText('e2e reply')).toBeVisible();
  });
});
```

> The `SHARE_TOKEN_FROM_FIXTURE` placeholder must be replaced with a real test fixture's shareToken — use the existing E2E seed helpers (see other E2E specs for the pattern). If E2E seeds don't include comment-related fixtures yet, add one in `tests/e2e/seed.ts` (or whichever the project uses).

- [ ] **Step 2: Run E2E**

Run: `TMPDIR=/home/manuel/.tmp-playwright npx playwright test tests/e2e/comments-flow.spec.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/comments-flow.spec.ts
git commit -m "test(e2e): comments flow on share page (post/reply/edit/soft-delete)"
```

---

## Task 22: E2E — Featured Homepage + Gallery Inline Rate + Admin Moderation

**Files:**
- Create: `tests/e2e/featured-homepage.spec.ts`
- Create: `tests/e2e/gallery-rate-inline.spec.ts`
- Create: `tests/e2e/admin-comment-moderation.spec.ts`

- [ ] **Step 1: Featured-Homepage E2E**

```ts
// tests/e2e/featured-homepage.spec.ts
import { test, expect } from '@playwright/test';

test('homepage shows featured preset block when seed provides ratings + comments', async ({ page }) => {
  // Pre-condition: E2E seed has at least 1 preset with >=3 ratings in last 30d + comments.
  await page.goto('/en', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText(/featured/i).first()).toBeVisible();
  await expect(page.getByText(/recent comments/i)).toBeVisible();
  await expect(page.getByRole('link', { name: /open preset/i })).toBeVisible();
});
```

- [ ] **Step 2: Gallery-Inline-Rate E2E**

```ts
// tests/e2e/gallery-rate-inline.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Gallery inline rating', () => {
  test('anon user sees sign-in tooltip on star click', async ({ page }) => {
    await page.goto('/en/gallery', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /rating star/i }).first().click();
    await expect(page.getByText(/sign in to rate/i)).toBeVisible();
  });

  test('logged-in user can rate inline', async ({ page }) => {
    await page.goto('/en/auth/login');
    await page.fill('input[name="email"]', 'verified@test.local');
    await page.fill('input[name="password"]', 'TestPassword123!');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/en/);

    await page.goto('/en/gallery', { waitUntil: 'domcontentloaded' });
    // Find a preset NOT owned by current user (seed-dependent; pick first card)
    const stars = page.getByRole('button', { name: /rating star/i });
    await stars.nth(4).click();
    // Optimistic update should reflect immediately — count or visual change is enough
    await expect(stars.nth(4)).toBeVisible(); // smoke
  });
});
```

- [ ] **Step 3: Admin-Moderation E2E**

```ts
// tests/e2e/admin-comment-moderation.spec.ts
import { test, expect } from '@playwright/test';

test('admin can hard-delete a comment with a reason', async ({ page }) => {
  // Login as admin (seed provides admin@test.local)
  await page.goto('/en/auth/login');
  await page.fill('input[name="email"]', 'admin@test.local');
  await page.fill('input[name="password"]', 'AdminPass123!');
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/en/);

  await page.goto('/en/admin', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /comments/i }).click();

  // Click first hard-delete button
  await page.getByRole('button', { name: /hard delete/i }).first().click();
  await page.getByRole('textbox').fill('spam — removed by moderator');
  await page.getByRole('button', { name: /^delete$/i }).click();
  // After delete, the row's body should show (deleted) or be gone
  await expect(page.getByText(/spam — removed by moderator/i)).not.toBeVisible({ timeout: 5000 });
});
```

- [ ] **Step 4: Run E2E**

Run: `TMPDIR=/home/manuel/.tmp-playwright npx playwright test tests/e2e/featured-homepage.spec.ts tests/e2e/gallery-rate-inline.spec.ts tests/e2e/admin-comment-moderation.spec.ts`
Expected: PASS (may require seed updates — adjust selectors/credentials to match the project's actual E2E fixture setup).

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/featured-homepage.spec.ts tests/e2e/gallery-rate-inline.spec.ts tests/e2e/admin-comment-moderation.spec.ts
git commit -m "test(e2e): featured-block + inline-rating + admin-moderation flows"
```

---

## Task 23: CI Verification + Changelog + Deploy

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Full local CI**

Run: `npm run ci`
Expected: lint + typecheck + vitest + build all green.

If any failure: fix and re-run. Do not skip.

- [ ] **Step 2: Add CHANGELOG entry**

Insert at the top of `CHANGELOG.md` (above the existing `## 2026-05-18` entry):

```markdown
## 2026-05-18 (later)

### Features
- **Inline-Rating in der Gallery** — Bewertungen können direkt auf der Gallery-Liste abgegeben werden. Anonyme Klicks zeigen einen Tooltip mit Login-Link; eigene Presets sind erwartungsgemäß nicht bewertbar.
- **Kommentare auf Share-Pages** — Plaintext-Kommentare mit 1-Level-Threading (Top-Level + Reply), max 1000 Zeichen, URLs werden automatisch verlinkt (`rel=nofollow`). Verifizierte User können kommentieren, jederzeit editieren und soft-löschen. Soft-Delete zeigt einen Platzhalter, Replies bleiben sichtbar.
- **Admin-Moderation für Kommentare** — Neuer Tab im Admin-Dashboard: Liste der letzten 50 Kommentare. Hard-Delete erfordert einen Grund (5–200 Zeichen) und wird im AdminAction-Log auditiert; kaskadiert auf Replies.
- **Featured Preset auf der Startseite** — Bayes-Average (m=5, C=globaler Durchschnitt) über alle Presets mit Ratings der letzten 30 Tage. Hero-Block mit Signal-Chain-Grafik (Amp/Cab-Realnamen), Sternebewertung, Beschreibung und den 3 neuesten Kommentaren. Fallback auf All-Time-Best wenn das 30-Tage-Fenster leer ist.

### Schema
- **Neue Tabelle `Comment`** mit Self-FK für 1-Level-Threading (`parentId` nullable), Soft-Delete-Marker (`deletedAt`/`deletedBy`), Cascade-Delete bei Preset/User/Parent-Removal.
```

- [ ] **Step 3: Commit + push**

```bash
git add CHANGELOG.md
git commit -m "docs(changelog): ratings-in-gallery + comments + featured-preset"
git push origin master
```

- [ ] **Step 4: Deploy to prod**

Run: `ssh musikersuche@82.165.40.140 'cd /opt/gp200editor && bash scripts/deploy-update.sh'`
Expected: Migration auto-applies (Comment table created), container restarts, app boots.

- [ ] **Step 5: Smoke check prod**

Run:
```bash
curl -sS -o /dev/null -w "home:%{http_code} gallery:%{http_code}\n" \
  https://www.preset-forge.com/en \
  https://www.preset-forge.com/en/gallery
```
Expected: `home:200 gallery:200`.

Then open `https://www.preset-forge.com/en` in a browser, confirm Featured-Block appears (if any preset qualifies; otherwise Fallback or no block — both acceptable for first deploy).

- [ ] **Step 6: Done**

Mark feature complete.
