# Public Preset Gallery Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a public preset gallery where anyone can browse, search, filter by effect modules, and download presets without logging in.

**Architecture:** Add `public` and `modules` fields to the Preset model. Extract module names from the decoded effect chain at upload time. New `/api/gallery` endpoint serves paginated, filterable public presets. New `/[locale]/gallery` page renders the gallery with search, module filter chips, and sort toggle. Preset owners can toggle publish status from their preset list.

**Tech Stack:** Next.js 14 App Router, Prisma 5, PostgreSQL 16, Tailwind CSS, next-intl, Zod, Vitest

---

### Task 1: Prisma Schema Migration

**Files:**
- Modify: `prisma/schema.prisma` (Preset model, ~line 26)
- Create: `prisma/migrations/<timestamp>_add_gallery_fields/migration.sql` (auto-generated)

- [ ] **Step 1: Add fields to Preset model**

In `prisma/schema.prisma`, add two fields to the Preset model after `downloadCount`:

```prisma
  public        Boolean  @default(false)
  modules       String[]
```

- [ ] **Step 2: Generate and apply migration**

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/gp200 npx prisma migrate dev --name add_gallery_fields
```

Expected: Migration created and applied, Prisma Client regenerated.

- [ ] **Step 3: Verify migration**

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/gp200 npx prisma migrate status
```

Expected: All migrations applied, no pending.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add public and modules fields to Preset model"
```

---

### Task 2: Module Extraction Helper

**Files:**
- Create: `src/core/extractModules.ts`
- Create: `tests/unit/extractModules.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/extractModules.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { extractModules } from '@/core/extractModules';
import type { GP200Preset } from '@/core/types';

describe('extractModules', () => {
  it('returns unique module names for active effects', () => {
    const preset: GP200Preset = {
      version: '1',
      patchName: 'Test',
      effects: [
        { slotIndex: 0, enabled: true, effectId: 0x03000000, params: [] },  // DST
        { slotIndex: 1, enabled: true, effectId: 0x07000000, params: [] },  // AMP
        { slotIndex: 2, enabled: false, effectId: 0x0B000000, params: [] }, // DLY (inactive)
        { slotIndex: 3, enabled: true, effectId: 0x0C000000, params: [] },  // RVB
        { slotIndex: 4, enabled: true, effectId: 0x03000001, params: [] },  // DST (duplicate)
      ],
      checksum: 0,
    };
    const modules = extractModules(preset);
    expect(modules).toEqual(['DST', 'AMP', 'RVB']);
  });

  it('returns empty array for no active effects', () => {
    const preset: GP200Preset = {
      version: '1',
      patchName: 'Empty',
      effects: [
        { slotIndex: 0, enabled: false, effectId: 0x03000000, params: [] },
      ],
      checksum: 0,
    };
    expect(extractModules(preset)).toEqual([]);
  });

  it('excludes Unknown modules', () => {
    const preset: GP200Preset = {
      version: '1',
      patchName: 'Test',
      effects: [
        { slotIndex: 0, enabled: true, effectId: 0xFFFFFFFF, params: [] },  // Unknown
        { slotIndex: 1, enabled: true, effectId: 0x07000000, params: [] },  // AMP
      ],
      checksum: 0,
    };
    expect(extractModules(preset)).toEqual(['AMP']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test -- tests/unit/extractModules.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write implementation**

Create `src/core/extractModules.ts`:

```typescript
import type { GP200Preset } from '@/core/types';
import { getModuleName } from '@/core/effectNames';

/** Extract unique module names from active effects in a preset. */
export function extractModules(preset: GP200Preset): string[] {
  const modules = new Set<string>();
  for (const slot of preset.effects) {
    if (!slot.enabled) continue;
    const mod = getModuleName(slot.effectId);
    if (mod !== 'Unknown') modules.add(mod);
  }
  return [...modules];
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm run test -- tests/unit/extractModules.test.ts
```

Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/extractModules.ts tests/unit/extractModules.test.ts
git commit -m "feat: add extractModules helper for preset effect chain"
```

---

### Task 3: Wire Module Extraction into Upload & Patch APIs

**Files:**
- Modify: `src/app/api/presets/route.ts` (POST handler)
- Modify: `src/app/api/presets/[id]/route.ts` (PATCH handler)

- [ ] **Step 1: Modify POST /api/presets to store modules**

In `src/app/api/presets/route.ts`, add import at top:

```typescript
import { extractModules } from '@/core/extractModules';
```

In the `prisma.preset.create` call (~line 73), add `modules` to data:

```typescript
data: {
  userId: user.id,
  presetKey: key,
  name: decoded.patchName.trim() || file.name.replace(/\.prst$/i, '').slice(0, 32) || 'Untitled',
  description: parsed.data.description ?? null,
  tags: parsed.data.tags ?? [],
  modules: extractModules(decoded),
},
```

Also add `modules` to the `select` block in the response and in the GET handler.

- [ ] **Step 2: Modify PATCH /api/presets/[id] to update modules on file replace**

In `src/app/api/presets/[id]/route.ts`, add import at top:

```typescript
import { extractModules } from '@/core/extractModules';
```

Inside the file replacement block (after `decoded` is available, ~line 108), add:

```typescript
updateData.modules = extractModules(decoded);
```

- [ ] **Step 3: Run full test suite**

```bash
npm run test
```

Expected: 102+ tests pass. No regressions.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/presets/route.ts src/app/api/presets/\[id\]/route.ts
git commit -m "feat: extract and store effect modules on preset upload/replace"
```

---

### Task 4: Gallery API Endpoint

**Files:**
- Create: `src/app/api/gallery/route.ts`
- Create: `tests/unit/validators.gallery.test.ts`
- Modify: `src/lib/validators.ts` (add gallery query schema)

- [ ] **Step 1: Write gallery query validator test**

Create `tests/unit/validators.gallery.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { galleryQuerySchema } from '@/lib/validators';

describe('galleryQuerySchema', () => {
  it('accepts empty query', () => {
    expect(galleryQuerySchema.safeParse({}).success).toBe(true);
  });

  it('accepts valid params', () => {
    const result = galleryQuerySchema.safeParse({
      q: 'rock',
      modules: 'DST,AMP',
      sort: 'popular',
      page: '2',
      limit: '12',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.modules).toEqual(['DST', 'AMP']);
      expect(result.data.page).toBe(2);
    }
  });

  it('defaults sort to newest', () => {
    const result = galleryQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sort).toBe('newest');
      expect(result.data.page).toBe(1);
      expect(result.data.limit).toBe(20);
    }
  });

  it('rejects invalid sort', () => {
    expect(galleryQuerySchema.safeParse({ sort: 'random' }).success).toBe(false);
  });

  it('clamps limit to max 50', () => {
    const result = galleryQuerySchema.safeParse({ limit: '100' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.limit).toBe(50);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test -- tests/unit/validators.gallery.test.ts
```

Expected: FAIL — galleryQuerySchema not found.

- [ ] **Step 3: Add galleryQuerySchema to validators.ts**

In `src/lib/validators.ts`, add:

```typescript
export const galleryQuerySchema = z.object({
  q: z.string().max(100).optional(),
  modules: z.string().optional().transform((v) => v ? v.split(',').filter(Boolean) : undefined),
  sort: z.enum(['newest', 'popular']).default('newest'),
  page: z.string().optional().transform((v) => Math.max(1, parseInt(v ?? '1', 10) || 1)),
  limit: z.string().optional().transform((v) => Math.min(50, Math.max(1, parseInt(v ?? '20', 10) || 20))),
});

export type GalleryQuery = z.infer<typeof galleryQuerySchema>;
```

- [ ] **Step 4: Run validator test**

```bash
npm run test -- tests/unit/validators.gallery.test.ts
```

Expected: PASS (5 tests).

- [ ] **Step 5: Create gallery API route**

Create `src/app/api/gallery/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { galleryQuerySchema } from '@/lib/validators';
import type { Prisma } from '@prisma/client';

export async function GET(request: NextRequest) {
  const params = Object.fromEntries(request.nextUrl.searchParams);
  const parsed = galleryQuerySchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { q, modules, sort, page, limit } = parsed.data;

  const where: Prisma.PresetWhereInput = { public: true };

  if (q) {
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { tags: { hasSome: [q] } },
    ];
  }

  if (modules && modules.length > 0) {
    where.modules = { hasSome: modules };
  }

  const orderBy: Prisma.PresetOrderByWithRelationInput =
    sort === 'popular' ? { downloadCount: 'desc' } : { createdAt: 'desc' };

  const [presets, total] = await Promise.all([
    prisma.preset.findMany({
      where,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        name: true,
        description: true,
        tags: true,
        modules: true,
        shareToken: true,
        downloadCount: true,
        createdAt: true,
        user: { select: { username: true } },
      },
    }),
    prisma.preset.count({ where }),
  ]);

  return NextResponse.json({ presets, total, page, limit });
}
```

- [ ] **Step 6: Run full tests**

```bash
npm run test
```

Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/lib/validators.ts src/app/api/gallery/route.ts tests/unit/validators.gallery.test.ts
git commit -m "feat: add gallery API endpoint with search, filter, sort, pagination"
```

---

### Task 5: Publish/Unpublish API

**Files:**
- Create: `src/app/api/presets/[id]/publish/route.ts`

- [ ] **Step 1: Create publish toggle route**

Create `src/app/api/presets/[id]/publish/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateSession, refreshSessionCookie } from '@/lib/session';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const { user, session } = await validateSession();
  if (!user || !session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  await refreshSessionCookie(session);

  const { id } = await context.params;

  const preset = await prisma.preset.findUnique({
    where: { id },
    select: { userId: true, public: true },
  });

  if (!preset) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (preset.userId !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const updated = await prisma.preset.update({
    where: { id },
    data: { public: !preset.public },
    select: { id: true, public: true },
  });

  return NextResponse.json(updated);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/presets/\[id\]/publish/route.ts
git commit -m "feat: add publish/unpublish toggle API for presets"
```

---

### Task 6: Translations

**Files:**
- Modify: `messages/de.json`
- Modify: `messages/en.json`

- [ ] **Step 1: Add gallery translations to de.json**

Add `"gallery"` namespace after `"presets"`:

```json
"gallery": {
  "title": "Preset-Galerie",
  "search": "Presets durchsuchen…",
  "sortNewest": "Neueste",
  "sortPopular": "Beliebteste",
  "allModules": "Alle Module",
  "noResults": "Keine Presets gefunden.",
  "downloads": "Downloads",
  "by": "von",
  "loadMore": "Mehr laden"
}
```

Add to `"presets"` namespace:

```json
"publish": "Veröffentlichen",
"unpublish": "Zurückziehen",
"published": "In Galerie"
```

- [ ] **Step 2: Add gallery translations to en.json**

Add `"gallery"` namespace:

```json
"gallery": {
  "title": "Preset Gallery",
  "search": "Search presets…",
  "sortNewest": "Newest",
  "sortPopular": "Most Popular",
  "allModules": "All Modules",
  "noResults": "No presets found.",
  "downloads": "downloads",
  "by": "by",
  "loadMore": "Load More"
}
```

Add to `"presets"` namespace:

```json
"publish": "Publish",
"unpublish": "Unpublish",
"published": "In Gallery"
```

- [ ] **Step 3: Commit**

```bash
git add messages/de.json messages/en.json
git commit -m "feat: add gallery and publish translations (DE/EN)"
```

---

### Task 7: Gallery Page

**Files:**
- Create: `src/app/[locale]/gallery/page.tsx`
- Create: `src/app/[locale]/gallery/GalleryClient.tsx`

- [ ] **Step 1: Create server page**

Create `src/app/[locale]/gallery/page.tsx`:

```typescript
import { getTranslations } from 'next-intl/server';
import { GalleryClient } from './GalleryClient';

export default async function GalleryPage() {
  const t = await getTranslations('gallery');

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      <h1
        className="font-mono-display text-xl font-bold tracking-tight mb-6"
        style={{ color: 'var(--accent-amber)' }}
      >
        {t('title')}
      </h1>
      <GalleryClient />
    </main>
  );
}
```

- [ ] **Step 2: Create gallery client component**

Create `src/app/[locale]/gallery/GalleryClient.tsx` — the interactive gallery with:

- Search input (debounced, 300ms)
- Module filter chips using MODULE_COLORS from `src/core/effectNames.ts`
- Sort toggle (newest / popular)
- Preset cards showing: name, @username, module badges, tags, download count, download link
- "Load more" pagination
- All styled with dark pedalboard theme (CSS variables)
- Download links use `/api/share/[token]/download` (existing public endpoint)

The component fetches from `/api/gallery?q=&modules=&sort=&page=&limit=` and renders results.

Key details:
- Module chips: `MODULE_COLORS` keys as filter options: PRE, DST, AMP, MOD, DLY, RVB, CAB, WAH, EQ, NR, VOL
- Active chip: filled with module glow color + accent border
- Inactive chip: border-only with text-muted
- Preset card layout matches the design from brainstorming
- Uses `useTranslations('gallery')` for all strings

- [ ] **Step 3: Verify page loads**

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/de/gallery
```

Expected: 200

- [ ] **Step 4: Commit**

```bash
git add src/app/\[locale\]/gallery/
git commit -m "feat: add public preset gallery page with search, module filter, sort"
```

---

### Task 8: Add Navbar Gallery Link

**Files:**
- Modify: `src/components/Navbar.tsx`
- Modify: `messages/de.json` (add nav.gallery)
- Modify: `messages/en.json` (add nav.gallery)

- [ ] **Step 1: Add gallery nav translations**

In `messages/de.json` nav namespace, add:
```json
"gallery": "Galerie"
```

In `messages/en.json` nav namespace, add:
```json
"gallery": "Gallery"
```

- [ ] **Step 2: Add gallery link to Navbar**

In `src/components/Navbar.tsx`, add a Gallery link between "Editor" and the auth section (visible to all users, not just logged in):

```typescript
<Link href="/gallery" className="transition-colors hover:text-[var(--accent-amber)]"
  style={{ color: pathname === '/gallery' ? 'var(--accent-amber)' : 'var(--text-secondary)' }}
  data-testid="nav-link-gallery">
  {t('gallery')}
</Link>
```

- [ ] **Step 3: Commit**

```bash
git add src/components/Navbar.tsx messages/de.json messages/en.json
git commit -m "feat: add Gallery link to navbar"
```

---

### Task 9: Publish Button in PresetList

**Files:**
- Modify: `src/app/[locale]/presets/PresetList.tsx`
- Modify: `src/app/[locale]/presets/page.tsx` (add `public` to select)

- [ ] **Step 1: Add `public` and `modules` to preset query**

In `src/app/[locale]/presets/page.tsx`, add `public: true` and `modules: true` to the `select` block.

- [ ] **Step 2: Add Preset type fields and publish handler in PresetList**

In `src/app/[locale]/presets/PresetList.tsx`:

Add `public: boolean` and `modules: string[]` to the `Preset` type.

Add publish toggle handler:

```typescript
async function handlePublish(preset: Preset) {
  const res = await fetch(`/api/presets/${preset.id}/publish`, { method: 'POST' });
  if (res.ok) {
    const { public: isPublic } = await res.json();
    setPresets((prev) =>
      prev.map((p) => (p.id === preset.id ? { ...p, public: isPublic } : p)),
    );
  }
}
```

Add a publish/unpublish button in the action buttons column, styled like the other action buttons but with green glow when published:

```typescript
<button
  onClick={() => handlePublish(preset)}
  className={actionBtnClass}
  style={{
    border: preset.public
      ? '1px solid var(--accent-green)'
      : '1px solid var(--border-active)',
    color: preset.public
      ? 'var(--accent-green)'
      : 'var(--text-secondary)',
    background: preset.public ? 'var(--glow-green)' : 'transparent',
  }}
>
  {preset.public ? t('published') : t('publish')}
</button>
```

- [ ] **Step 3: Run full tests**

```bash
npm run test
```

Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/app/\[locale\]/presets/
git commit -m "feat: add publish/unpublish toggle to preset list"
```

---

### Task 10: Docker Rebuild & E2E Verification

- [ ] **Step 1: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 2: Full test suite**

```bash
npm run test
```

Expected: All tests pass (102+ including new tests).

- [ ] **Step 3: Rebuild and restart Docker**

```bash
docker compose down && docker compose build app && docker compose up -d
```

Wait for all containers, then apply migration:

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/gp200 npx prisma migrate deploy
```

- [ ] **Step 4: E2E smoke test**

```bash
# Register, upload preset, publish, verify gallery
SESSION=$(curl -sv http://localhost:3000/api/auth/register -X POST \
  -H 'Content-Type: application/json' \
  -d '{"email":"gallery@test.com","username":"galleryuser","password":"testpass123"}' 2>&1 \
  | grep -o 'auth_session=[^;]*')

# Upload a preset
curl -s -b "$SESSION" http://localhost:3000/api/presets \
  -X POST -F "preset=@planung/ZZ-WokeUp.prst"

# Get preset ID
PRESET_ID=$(curl -s -b "$SESSION" http://localhost:3000/api/presets | python3 -c "import sys,json; print(json.load(sys.stdin)[0]['id'])")

# Publish it
curl -s -b "$SESSION" "http://localhost:3000/api/presets/$PRESET_ID/publish" -X POST

# Gallery should show it (no auth needed)
curl -s http://localhost:3000/api/gallery
```

Expected: Gallery returns the published preset with modules array.

- [ ] **Step 5: Commit all remaining changes**

```bash
git add -A
git commit -m "feat: public preset gallery with search, module filter, sort"
```
