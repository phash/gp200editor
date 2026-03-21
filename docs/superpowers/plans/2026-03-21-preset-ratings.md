# Preset Ratings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 5-guitar ratings to public presets — logged-in users can rate any preset they didn't upload; ratings show in the gallery (with new "top rated" sort) and on the share page; the editor shows a rating widget when a gallery preset is loaded.

**Architecture:** Denormalized `ratingAverage` + `ratingCount` on `Preset` for fast gallery queries. A separate `PresetRating` model stores individual ratings with a unique `(presetId, userId)` constraint (upsert semantics). A shared `GuitarRating` component renders 🎸 emojis, used in three places: gallery cards, share page, editor.

**Tech Stack:** Prisma 5 (PostgreSQL), Next.js 14 App Router, TypeScript strict, Zod, Tailwind/inline styles (match existing dark theme), Vitest (unit tests), next-intl (DE/EN).

---

## File Map

| File | Action | What changes |
|---|---|---|
| `prisma/schema.prisma` | Modify | Add `PresetRating` model; add `ratingAverage`, `ratingCount`, `ratings` to `Preset` |
| `src/lib/validators.ts` | Modify | Add `ratePresetSchema`; extend `galleryQuerySchema` sort enum with `top-rated` |
| `src/components/GuitarRating.tsx` | Create | Reusable 🎸 rating widget (display + interactive mode) |
| `src/app/api/presets/[id]/rate/route.ts` | Create | `POST` — upsert rating, update denormalized fields in transaction |
| `src/app/api/gallery/route.ts` | Modify | Include `ratingAverage`, `ratingCount` in select; handle `top-rated` sort |
| `src/app/[locale]/gallery/GalleryClient.tsx` | Modify | Add rating display to cards; add "Top Rated" sort option |
| `src/app/[locale]/share/[token]/page.tsx` | Modify | Show avg rating + interactive widget (fetch user's existing rating) |
| `src/app/[locale]/editor/page.tsx` | Modify | Show rating widget when `sourcePreset` is set and not own preset |
| `src/components/Footer.tsx` | Modify | Add contact mailto link |
| `messages/en.json` | Modify | Add rating strings |
| `messages/de.json` | Modify | Add rating strings (DE) |
| `tests/unit/validators.rating.test.ts` | Create | Unit tests for `ratePresetSchema` |
| `tests/unit/GuitarRating.test.ts` | Create | Unit tests for GuitarRating component |

---

## Task 1: Prisma Schema

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] Add `PresetRating` model and update `Preset`:

```prisma
model PresetRating {
  id        String   @id @default(cuid())
  presetId  String
  userId    String
  score     Int      // 1–5
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  preset Preset @relation(fields: [presetId], references: [id], onDelete: Cascade)
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([presetId, userId])
  @@index([presetId])
}
```

- [ ] Add to `Preset` model:
```prisma
  ratingAverage Float    @default(0)
  ratingCount   Int      @default(0)
  ratings       PresetRating[]
```

- [ ] Add to `User` model:
```prisma
  ratings PresetRating[]
```

- [ ] Run migration:
```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/gp200" npx prisma migrate dev --name add-preset-ratings
```
Expected: migration file created, client regenerated.

- [ ] Commit:
```bash
git add prisma/
git commit -m "feat(db): add PresetRating model with denormalized avg/count on Preset"
```

---

## Task 2: Validator

**Files:**
- Modify: `src/lib/validators.ts`
- Create: `tests/unit/validators.rating.test.ts`

- [ ] Write failing tests first:

```typescript
// tests/unit/validators.rating.test.ts
import { describe, it, expect } from 'vitest';
import { ratePresetSchema } from '@/lib/validators';

describe('ratePresetSchema', () => {
  it('accepts score 1–5', () => {
    for (const score of [1, 2, 3, 4, 5]) {
      expect(ratePresetSchema.safeParse({ score }).success).toBe(true);
    }
  });

  it('rejects score 0', () => {
    expect(ratePresetSchema.safeParse({ score: 0 }).success).toBe(false);
  });

  it('rejects score 6', () => {
    expect(ratePresetSchema.safeParse({ score: 6 }).success).toBe(false);
  });

  it('rejects non-integer', () => {
    expect(ratePresetSchema.safeParse({ score: 3.5 }).success).toBe(false);
  });

  it('rejects missing score', () => {
    expect(ratePresetSchema.safeParse({}).success).toBe(false);
  });
});
```

- [ ] Run to verify failure:
```bash
npx vitest run tests/unit/validators.rating.test.ts
```
Expected: FAIL — `ratePresetSchema` not exported.

- [ ] Add to `src/lib/validators.ts`:
```typescript
export const ratePresetSchema = z.object({
  score: z.number().int().min(1).max(5),
});
export type RatePresetInput = z.infer<typeof ratePresetSchema>;
```

- [ ] Extend `galleryQuerySchema` sort:
```typescript
sort: z.enum(['newest', 'popular', 'top-rated']).default('newest'),
```

- [ ] Run tests:
```bash
npx vitest run tests/unit/validators.rating.test.ts tests/unit/validators.gallery.test.ts
```
Expected: all pass.

- [ ] Commit:
```bash
git add src/lib/validators.ts tests/unit/validators.rating.test.ts
git commit -m "feat(validators): add ratePresetSchema, extend gallery sort with top-rated"
```

---

## Task 3: Rating API Route

**Files:**
- Create: `src/app/api/presets/[id]/rate/route.ts`

- [ ] Create `src/app/api/presets/[id]/rate/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { validateSession } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { ratePresetSchema } from '@/lib/validators';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user } = await validateSession(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const parsed = ratePresetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const preset = await prisma.preset.findUnique({
    where: { id },
    select: { userId: true, public: true },
  });
  if (!preset || !preset.public) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (preset.userId === user.id) {
    return NextResponse.json({ error: 'Cannot rate your own preset' }, { status: 403 });
  }

  const { score } = parsed.data;

  // Upsert rating + update denormalized avg/count in a transaction
  await prisma.$transaction(async (tx) => {
    await tx.presetRating.upsert({
      where: { presetId_userId: { presetId: id, userId: user.id } },
      create: { presetId: id, userId: user.id, score },
      update: { score },
    });

    const agg = await tx.presetRating.aggregate({
      where: { presetId: id },
      _avg: { score: true },
      _count: { score: true },
    });

    await tx.preset.update({
      where: { id },
      data: {
        ratingAverage: agg._avg.score ?? 0,
        ratingCount: agg._count.score,
      },
    });
  });

  return NextResponse.json({ ok: true });
}
```

- [ ] Commit:
```bash
git add src/app/api/presets/[id]/rate/
git commit -m "feat(api): POST /api/presets/[id]/rate — upsert rating with denormalized update"
```

---

## Task 4: Gallery API Update

**Files:**
- Modify: `src/app/api/gallery/route.ts`

- [ ] Add `ratingAverage` and `ratingCount` to `select`:
```typescript
select: {
  // ...existing fields...
  ratingAverage: true,
  ratingCount: true,
},
```

- [ ] Handle `top-rated` sort:
```typescript
const orderBy: Prisma.PresetOrderByWithRelationInput =
  sort === 'popular'    ? { downloadCount: 'desc' } :
  sort === 'top-rated'  ? { ratingAverage: 'desc' } :
                          { createdAt: 'desc' };
```

- [ ] Commit:
```bash
git add src/app/api/gallery/route.ts
git commit -m "feat(api): gallery — add ratingAverage/Count to response, top-rated sort"
```

---

## Task 5: GuitarRating Component

**Files:**
- Create: `src/components/GuitarRating.tsx`
- Create: `tests/unit/GuitarRating.test.ts`

- [ ] Write failing tests:

```typescript
// tests/unit/GuitarRating.test.ts
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GuitarRating } from '@/components/GuitarRating';

describe('GuitarRating', () => {
  it('renders 5 guitars', () => {
    render(<GuitarRating value={3} />);
    const guitars = screen.getAllByRole('img', { hidden: true });
    expect(guitars).toHaveLength(5);
  });

  it('shows correct filled count for value=3', () => {
    render(<GuitarRating value={3} />);
    // First 3 guitars are filled (aria-label "filled"), last 2 are empty
    expect(screen.getAllByLabelText('filled guitar')).toHaveLength(3);
    expect(screen.getAllByLabelText('empty guitar')).toHaveLength(2);
  });

  it('calls onRate when interactive and guitar clicked', () => {
    const onRate = vi.fn();
    render(<GuitarRating value={0} onRate={onRate} />);
    fireEvent.click(screen.getAllByRole('button')[2]); // 3rd guitar
    expect(onRate).toHaveBeenCalledWith(3);
  });

  it('does not render buttons when no onRate provided', () => {
    render(<GuitarRating value={3} />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});
```

- [ ] Run to verify failure:
```bash
npx vitest run tests/unit/GuitarRating.test.ts
```

- [ ] Create `src/components/GuitarRating.tsx`:

```tsx
'use client';
import { useState } from 'react';

type Props = {
  value: number;          // 0–5, supports decimals for display (avg)
  count?: number;         // show rating count
  onRate?: (score: number) => void;  // if provided: interactive
  size?: 'sm' | 'md';
};

export function GuitarRating({ value, count, onRate, size = 'md' }: Props) {
  const [hover, setHover] = useState(0);
  const fontSize = size === 'sm' ? '0.85rem' : '1.1rem';
  const display = hover || Math.round(value);

  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= display;
        const guitar = filled ? '🎸' : '🎸';
        const opacity = filled ? 1 : 0.25;

        if (onRate) {
          return (
            <button
              key={n}
              onClick={() => onRate(n)}
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(0)}
              style={{ fontSize, opacity, lineHeight: 1, background: 'none', border: 'none', cursor: 'pointer', padding: '0 1px' }}
              aria-label={filled ? 'filled guitar' : 'empty guitar'}
            >
              <span role="img" aria-hidden>🎸</span>
            </button>
          );
        }

        return (
          <span
            key={n}
            style={{ fontSize, opacity, lineHeight: 1, padding: '0 1px' }}
            aria-label={filled ? 'filled guitar' : 'empty guitar'}
            role="img"
            aria-hidden
          >
            🎸
          </span>
        );
      })}
      {count !== undefined && count > 0 && (
        <span className="font-mono-display text-[10px] ml-1" style={{ color: 'var(--text-muted)' }}>
          ({count})
        </span>
      )}
    </span>
  );
}
```

- [ ] Run tests:
```bash
npx vitest run tests/unit/GuitarRating.test.ts
```

- [ ] Commit:
```bash
git add src/components/GuitarRating.tsx tests/unit/GuitarRating.test.ts
git commit -m "feat(ui): GuitarRating component — 5 guitars, display + interactive mode"
```

---

## Task 6: Gallery Client Integration

**Files:**
- Modify: `src/app/[locale]/gallery/GalleryClient.tsx`

- [ ] Add `ratingAverage` and `ratingCount` to `GalleryPreset` type:
```typescript
type GalleryPreset = {
  // ...existing fields...
  ratingAverage: number;
  ratingCount: number;
};
```

- [ ] Add `'top-rated'` to sort state type:
```typescript
const [sort, setSort] = useState<'newest' | 'popular' | 'top-rated'>('newest');
```

- [ ] Add "Top Rated" sort button next to existing sort buttons (find the sort toggle UI and add a third button).

- [ ] Import `GuitarRating` and add to each preset card (find where `downloadCount` is displayed):
```tsx
import { GuitarRating } from '@/components/GuitarRating';

// In preset card:
{preset.ratingCount > 0 && (
  <GuitarRating value={preset.ratingAverage} count={preset.ratingCount} size="sm" />
)}
```

- [ ] Add i18n string usage: `t('sortTopRated')` for the button label.

- [ ] Commit:
```bash
git add src/app/\[locale\]/gallery/GalleryClient.tsx
git commit -m "feat(gallery): show guitar ratings on cards, add top-rated sort"
```

---

## Task 7: Share Page — Rating Display + Interaction

**Files:**
- Modify: `src/app/[locale]/share/[token]/page.tsx`

The share page is a Server Component. For interactive rating, convert the rating widget part to a client component.

- [ ] Create `src/app/[locale]/share/[token]/RatingWidget.tsx` (Client Component):

```tsx
'use client';
import { useState } from 'react';
import { GuitarRating } from '@/components/GuitarRating';
import { useTranslations } from 'next-intl';

type Props = {
  presetId: string;
  initialAverage: number;
  initialCount: number;
  canRate: boolean;       // logged in + not own preset
  existingRating: number; // 0 = not yet rated
};

export function RatingWidget({ presetId, initialAverage, initialCount, canRate, existingRating }: Props) {
  const t = useTranslations('presets');
  const [avg, setAvg] = useState(initialAverage);
  const [count, setCount] = useState(initialCount);
  const [myRating, setMyRating] = useState(existingRating);
  const [status, setStatus] = useState<'idle' | 'saving' | 'error'>('idle');

  async function handleRate(score: number) {
    setStatus('saving');
    const res = await fetch(`/api/presets/${presetId}/rate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ score }),
    });
    if (res.ok) {
      // Optimistic update
      const isNew = myRating === 0;
      const newCount = isNew ? count + 1 : count;
      const newAvg = isNew
        ? (avg * count + score) / newCount
        : (avg * count - myRating + score) / count;
      setAvg(newAvg);
      setCount(newCount);
      setMyRating(score);
      setStatus('idle');
    } else {
      setStatus('error');
    }
  }

  return (
    <div className="flex items-center gap-3 my-3">
      <GuitarRating
        value={canRate ? myRating : avg}
        count={count}
        onRate={canRate ? handleRate : undefined}
        size="md"
      />
      {canRate && myRating === 0 && (
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('rateThis')}</span>
      )}
      {canRate && myRating > 0 && (
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('yourRating')}: {myRating}/5</span>
      )}
      {status === 'error' && (
        <span className="text-xs" style={{ color: '#ef4444' }}>{t('ratingError')}</span>
      )}
    </div>
  );
}
```

- [ ] In `share/[token]/page.tsx` — fetch user session + existing rating:

```typescript
// After fetching preset:
const session = await validateSession(request);  // need cookies() here
// Check if user already rated this preset
let existingRating = 0;
let canRate = false;
if (session?.user) {
  canRate = preset.userId !== session.user.id;
  if (canRate) {
    const existing = await prisma.presetRating.findUnique({
      where: { presetId_userId: { presetId: preset.id, userId: session.user.id } },
      select: { score: true },
    });
    existingRating = existing?.score ?? 0;
  }
}
```

Note: `validateSession` in share page needs `cookies()` from `next/headers`, not `NextRequest`. Check `src/lib/session.ts` — may need a separate helper. If session reading in Server Components is already handled, use that pattern.

- [ ] Add `<RatingWidget>` to the share page JSX below the download count.

- [ ] Commit:
```bash
git add src/app/\[locale\]/share/\[token\]/
git commit -m "feat(share): guitar rating display + interactive rating widget"
```

---

## Task 8: Editor Rating Widget

**Files:**
- Modify: `src/app/[locale]/editor/page.tsx`

When a preset is loaded from the gallery (`sourcePreset` is set) and it belongs to someone else (`sourcePreset.username !== username`), show a rating widget.

- [ ] Add state near other state declarations:
```typescript
const [myRating, setMyRating] = useState(0);
```

- [ ] Add rating handler:
```typescript
async function handleRate(score: number) {
  if (!sourcePreset) return;
  await fetch(`/api/presets/${sourcePreset.id}/rate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ score }),
  });
  setMyRating(score);
}
```

- [ ] Add rating widget in the editor action buttons section, after the download button, only when conditions are met:
```tsx
import { GuitarRating } from '@/components/GuitarRating';

// In action buttons area:
{sourcePreset && sourcePreset.username !== username && isLoggedIn && (
  <div className="flex items-center gap-2">
    <span className="font-mono-display text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
      {t('ratePreset')}
    </span>
    <GuitarRating value={myRating} onRate={handleRate} size="md" />
  </div>
)}
```

- [ ] Commit:
```bash
git add src/app/\[locale\]/editor/page.tsx
git commit -m "feat(editor): show guitar rating widget when viewing others' gallery presets"
```

---

## Task 9: i18n Strings

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/de.json`

- [ ] Add to `gallery` namespace in both files:
```json
"sortTopRated": "Top Rated"
```

- [ ] Add to `presets` namespace in both files:

EN:
```json
"rateThis": "Rate this preset",
"yourRating": "Your rating",
"ratingError": "Could not save rating"
```

DE:
```json
"rateThis": "Preset bewerten",
"yourRating": "Deine Bewertung",
"ratingError": "Bewertung konnte nicht gespeichert werden"
```

- [ ] Add to `editor` namespace in both files:

EN: `"ratePreset": "Rate preset"`
DE: `"ratePreset": "Preset bewerten"`

- [ ] Commit:
```bash
git add messages/
git commit -m "feat(i18n): add rating strings (DE/EN)"
```

---

## Task 10: Contact Link in Footer

**Files:**
- Modify: `src/components/Footer.tsx`
- Modify: `messages/en.json`, `messages/de.json`

- [ ] Add to Footer after Buy Me a Coffee:
```tsx
<span style={{ margin: '0 8px' }}>·</span>
<a
  href="mailto:phash@phash.de"
  style={{ color: 'var(--text-muted)', textDecoration: 'none' }}
>
  {t('contact')}
</a>
```

- [ ] Add i18n string to `footer` namespace:
- EN: `"contact": "Contact"`
- DE: `"contact": "Kontakt"`

- [ ] Commit:
```bash
git add src/components/Footer.tsx messages/
git commit -m "feat(footer): add contact mailto link"
```

---

## Task 11: Run All Tests + Final Commit

- [ ] Run full test suite:
```bash
npx vitest run
```
Expected: all existing 271 tests + new rating/GuitarRating tests pass.

- [ ] Deploy:
```bash
# On VPS:
cd /opt/gp200editor && bash scripts/deploy-update.sh
```

- [ ] Verify live: open a public preset share page, check guitar emojis render, try rating as logged-in user.
