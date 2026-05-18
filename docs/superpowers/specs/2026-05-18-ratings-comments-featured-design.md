# Ratings in Gallery · Comments · Featured Preset — Design Spec

**Date:** 2026-05-18
**Status:** Approved, ready for implementation plan
**Scope:** Bewertungen direkt in der Gallery-Liste abgeben, Kommentar-System mit 1-Level-Threading (Soft-Delete durch Autor, Hard-Delete durch Admin), Featured-Preset-Block auf der Homepage (30-Tage-Fenster, Bayesian-Average) mit Signal-Chain-Grafik, Beschreibung und Kommentar-Vorschau.

## Goal

Die `PresetRating`-Infrastruktur existiert schon (Schema, API, Widget auf der Share-Page), wird aber in der Gallery-Liste nur read-only angezeigt. Kommentare und ein Featured-Preset auf der Startseite fehlen komplett. Dieses Feature schließt diese Lücken so, dass eingeloggte User in der Gallery direkt voten können, auf jeder Share-Page diskutieren können, und Besucher auf der Homepage sofort den aktuell besten Community-Preset sehen.

## Non-Goals

- Markdown-Rendering in Kommentaren
- Reply-auf-Reply (Threading > 1 Level)
- `@username`-Mentions und Notifications
- Email-Benachrichtigung bei Replies
- Voting/Likes auf einzelne Kommentare
- Audio-Previews im Featured-Block
- Featured-Carousel oder Top-3 (Single Hero only)

## User-Entscheidungen (Quelle: AskUserQuestion 2026-05-18)

1. Rating-Scope: Auch in der Gallery-Liste (inline voting).
2. Kommentar-System: Flach + Threading (genau 1 Level Replies).
3. Featured-Logik: Letzte 30 Tage, Bayesian-Average.
4. Tone-Repräsentation: Signal-Chain-Grafik + Amp/Cab-Realnamen (kein Audio).
5. Featured-Caching: Live-Query mit Next.js ISR (`revalidate=3600`).
6. Delete-Cascade: Soft-Delete des Top-Levels lässt Replies sichtbar; Admin-Hard-Delete kaskadiert auf Replies.
7. Anon-Rate-Click: Tooltip mit Login-Link, kein hartes Redirect.
8. Detail-Verlinkung: bestehende `/share/[token]` Page (keine zweite Detail-Page).
9. Comment-Permissions: verifizierte User, Edit unbegrenzt, Soft-Delete jederzeit.
10. Comment-Format: Plaintext, max 1000 Zeichen, Auto-Link für URLs.

## Architecture Overview

### Neue API-Routes

| Method | Path | Auth | Zweck |
|---|---|---|---|
| `GET` | `/api/presets/[id]/comments?cursor=...` | öffentlich | Top-Level + Replies paginiert (20/Page, Cursor-basiert), neueste zuerst |
| `POST` | `/api/presets/[id]/comments` | verifiziert | Top-Level Kommentar erstellen |
| `POST` | `/api/comments/[id]/reply` | verifiziert | Reply auf Top-Level erstellen — lehnt ab, wenn `parent.parentId != null` |
| `PATCH` | `/api/comments/[id]` | Autor | Edit (kein Zeitfenster), setzt `editedAt` |
| `DELETE` | `/api/comments/[id]` | Autor (soft) / Admin (hard) | Autor: Soft-Delete (Body wird auf null gesetzt). Admin: Hard-Delete mit `reason` → kaskadiert Replies, schreibt AdminAction-Log |
| `GET` | `/api/admin/comments?cursor=...` | Admin | Moderations-Liste der letzten Kommentare (sortiert: neueste) |

Bestehende Routes bleiben unverändert. `/api/gallery` Response wird **nicht** verändert — der Login-State und das eigene Rating werden über die SSR-Page (`requireUser` im Server Component) ermittelt und in die `presets[]` zur Card-Komponente weitergereicht.

### Rate-Limits

Eingebettet über bestehendes `src/lib/rateLimit.ts`:

- Comment-Create (POST top-level + reply, kombiniert): 10 / Stunde / User
- Comment-Edit (PATCH): 30 / Stunde / User
- Comment-Delete (DELETE soft): 30 / Stunde / User
- Admin-Hard-Delete: unlimited (auditiert via AdminAction)
- Rating (POST `/api/presets/[id]/rate`): bestehender Limit (60 / Minute) bleibt

### Featured-Berechnung

Server Component liest direkt aus Prisma. Kein eigener API-Endpoint. Cache: Next.js ISR via `export const revalidate = 3600` auf der Homepage. Logik liegt in `src/lib/featuredPreset.ts`:

```ts
const m = 5;           // Confidence-Polster
const cutoffDays = 30;

// 1. Globaler Prior C: Durchschnitt aller public Presets mit >= 1 Rating
const prior = await prisma.preset.aggregate({
  _avg: { ratingAverage: true },
  where: { public: true, ratingCount: { gte: 1 } },
});
const C = prior._avg.ratingAverage ?? 4.0;

// 2. Kandidaten: public, !flagged, mit >= 1 Rating in den letzten 30 Tagen
const cutoff = new Date(Date.now() - cutoffDays * 86400_000);
const candidates = await prisma.preset.findMany({
  where: {
    public: true,
    flagged: false,
    ratings: { some: { updatedAt: { gte: cutoff } } },
    ratingCount: { gte: 1 },
  },
  select: { id, name, description, /* ... */ ratingAverage, ratingCount, shareToken, effects, modules },
});

// 3. Bayes-Score pro Kandidat: (C * m + ratingAverage * ratingCount) / (m + ratingCount)
const scored = candidates.map(p => ({
  preset: p,
  score: (C * m + p.ratingAverage * p.ratingCount) / (m + p.ratingCount),
}));

// 4. Top 1
const top = scored.sort((a, b) => b.score - a.score)[0];
```

**Fallback** wenn `candidates` leer: gleiche Query ohne 30d-Filter (all-time best). Wenn auch das null ist → Block wird nicht gerendert.

### Komponentenbaum

```
app/[locale]/page.tsx (Homepage, revalidate=3600)
├── <Suspense fallback={<FeaturedSkeleton />}>
│   └── <FeaturedPresetBlock />         (Server Component)
│       ├── <SignalChainStrip />        (Server, wiederverwendbar)
│       ├── <GuitarRating />            (read-only)
│       └── 3× Comment-Snippets (server-rendered, plain)
└── (bestehender Hero-Block bleibt)

app/[locale]/gallery/page.tsx (SSR)
└── <GalleryClient> (existing, modifiziert)
    └── Card pro Preset:
        └── <RateableGuitarRating />    (NEW, Client)

app/[locale]/share/[token]/page.tsx (existing, ergänzt)
├── <RatingWidget />                    (unverändert)
└── <CommentSection presetId={...} />   (NEW, Client)
    ├── <CommentForm parentId={null} />
    └── <CommentList>
        └── <CommentItem> (× n)
            └── <CommentItem> (replies, × m)
            └── <CommentForm parentId={parent.id} /> (on Reply-Click)

app/admin/page.tsx (existing, neuer Tab)
└── <AdminCommentsTab />                (NEW)
```

## Data Model

### Neue Tabelle `Comment`

```prisma
model Comment {
  id          String    @id @default(cuid())
  presetId    String
  userId      String
  parentId    String?   // null = top-level, set = reply. 1-Level-Constraint API-seitig.
  body        String?   @db.VarChar(1000) // nullable, weil Soft-Delete body auf null setzt
  editedAt    DateTime?
  deletedAt   DateTime?
  deletedBy   String?   // 'AUTHOR' | 'ADMIN' — bestimmt Platzhalter-Text
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  preset   Preset    @relation(fields: [presetId], references: [id], onDelete: Cascade)
  user     User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  parent   Comment?  @relation("CommentReplies", fields: [parentId], references: [id], onDelete: Cascade)
  replies  Comment[] @relation("CommentReplies")

  @@index([presetId, parentId, createdAt])
  @@index([userId])
}
```

### Backlinks (Existing Tables)

```prisma
model Preset {
  // ...
  comments Comment[]
}

model User {
  // ...
  comments Comment[]
}
```

### Constraints (API-enforced)

- POST `/api/comments/[id]/reply`: lade Parent. Wenn `parent.parentId !== null` → `400 Bad Request: "Replies must target a top-level comment"`. Wenn `parent.deletedAt !== null` → Reply trotzdem erlaubt (Soft-Delete-Platzhalter dient als Anker).
- PATCH `/api/comments/[id]`: wenn `comment.deletedAt !== null` → `409 Conflict: "Cannot edit deleted comment"`.
- Comment-Body Validierung: Zod-Schema `commentBodySchema = z.string().trim().min(1).max(1000)`.

### Migration

Eine Prisma-Migration: `prisma migrate dev --name add_comments`. Erstellt nur die neue Tabelle + Indizes. Kein Daten-Backfill. Wird auf prod automatisch durch `docker-entrypoint.sh` beim Container-Start angewandt (bestehender Mechanismus).

## UI / Components

### Neue Komponenten

| Komponente | Datei | Typ | Verantwortung |
|---|---|---|---|
| `FeaturedPresetBlock` | `src/components/FeaturedPresetBlock.tsx` | Server | Liest Featured-Preset + 3 neueste Top-Level-Kommentare. Rendert Signal-Chain-Strip, `GuitarRating` read-only, Description (max 160 Zeichen, ellipsiert), Kommentar-Vorschau, CTA-Link `/share/[shareToken]`. Im Layout über dem bestehenden Hero. |
| `SignalChainStrip` | `src/components/SignalChainStrip.tsx` | Server | Read-only Render der 11 Effekt-Slots (PRE…VOL) als LED-Style-Pills mit Realnamen (`effects[]`-Array). Wiederverwendbar in Featured + ggf. Share-Page-Header. |
| `RateableGuitarRating` | `src/components/RateableGuitarRating.tsx` | Client | Wrapper um `GuitarRating`: Login-Check (Anon → Tooltip mit Login-Link), Eigenes-Preset-Check (disabled + Tooltip), Optimistic POST `/api/presets/[id]/rate`. Erbt visuelle Größe `sm` für Gallery-Cards. |
| `CommentSection` | `src/components/comments/CommentSection.tsx` | Client | Container, initial-fetch via `/api/presets/[id]/comments`, state-management für Liste, Pass-Through für CommentForm/CommentList. |
| `CommentList` | `src/components/comments/CommentList.tsx` | Client | Rendert Top-Level + verschachtelte Replies. „Mehr laden" (Cursor-Pagination). Pro CommentItem konditional Edit/Delete/Reply-Buttons. |
| `CommentItem` | `src/components/comments/CommentItem.tsx` | Client | Einzelner Kommentar: Avatar (Link `/profile/[username]`), Username, relative Timestamp (`vor 2h`), Body mit Auto-Link-Parser, edited-Badge, Soft-Delete-Platzhalter. Inline-Edit (Textarea ersetzt Body bei Edit-Click). Admin sieht zusätzlich „Moderieren"-Button. |
| `CommentForm` | `src/components/comments/CommentForm.tsx` | Client | Textarea + Char-Counter (`x / 1000`), Submit-Button, Reset nach Success. Disabled wenn Rate-Limit-Toast aktiv. Props: `presetId` (required) + `parentId?` (für Reply). |
| `AdminCommentsTab` | `src/components/admin/AdminCommentsTab.tsx` | Client | Liste der letzten 50 Kommentare (mit Preset-Link + User-Link), Hard-Delete-Button öffnet `<ConfirmDialog>` mit Reason-Textarea. |

### Geänderte Komponenten

- `src/app/[locale]/gallery/GalleryClient.tsx`: Card ersetzt `<GuitarRating>` (read-only) durch `<RateableGuitarRating>`. Props erweitert um `canRate: boolean` + `existingRating: number`.
- `src/app/[locale]/gallery/page.tsx` (SSR-Server-Component): lädt Session, hängt pro Preset `canRate` (eingeloggt + verifiziert + nicht eigenes) und `existingRating` (0..5, aus `PresetRating`) an, gibt sie an `<GalleryClient>` weiter.
- `src/app/[locale]/share/[token]/page.tsx`: hängt `<CommentSection presetId={preset.id} />` unter den existierenden `<RatingWidget>`.
- `src/app/[locale]/page.tsx` (Homepage): am Anfang `<Suspense fallback={<FeaturedSkeleton />}>` mit `<FeaturedPresetBlock />`. Bestehender Hero bleibt darunter.
- `src/app/admin/page.tsx` (Admin-Dashboard): neuer Tab „Kommentare" → `<AdminCommentsTab />`.

### Visuelle Sprache

Konsistent zum bestehenden Pedalboard-Theme:

- **Featured-Header:** `font-mono-display`, amber-glow border, uppercase tracking-wider Label „FEATURED · TOP RATED · 30 DAYS".
- **Signal-Chain-Strip:** 11 LED-Style-Pills horizontal, Amber-Akzent für aktivierte Slots.
- **Comment-Bubbles:** dunkler Hintergrund (`bg-surface`), abgerundet 8px, schmaler `border-white/6`. Username + Timestamp in `font-mono-display`, Body in `font-sans`.
- **Reply-Einrückung:** 24px links + dünner amber-dim-Border-Left zur visuellen Hierarchie.
- **Delete-Platzhalter:** kursiv, `text-muted`, Text aus i18n basierend auf `deletedBy`.

## Permissions & Edge-Cases

### Permissions-Matrix

| Aktion | Anon | Unverif. | Verif. | Autor | Admin |
|---|---|---|---|---|---|
| Comments lesen | ✓ | ✓ | ✓ | ✓ | ✓ |
| Rating-Average lesen | ✓ | ✓ | ✓ | ✓ | ✓ |
| Rating abgeben | Tooltip → Login | 403 | ✓ (own preset: 403) | – | ✓ |
| Comment erstellen | Tooltip → Login | 403 | ✓ | – | ✓ |
| Reply erstellen | Tooltip → Login | 403 | ✓ | – | ✓ |
| Comment editieren | – | – | – | ✓ (jederzeit) | – |
| Comment soft-delete | – | – | – | ✓ | – |
| Comment hard-delete | – | – | – | – | ✓ (mit `reason` + AdminAction-Log) |

### Edge-Cases

1. **Reply auf gelöschten Top-Level:** erlaubt. Platzhalter bleibt als Anker.
2. **Edit auf gelöschten Comment:** 409 Conflict.
3. **Hard-Delete auf Top-Level mit Replies (Admin):** kaskadiert via `onDelete: Cascade`. AdminAction-Log enthält `{ targetId, repliesDeletedCount, reason }`.
4. **Reply auf Reply (Versuch 2. Level):** 400 Bad Request.
5. **Rate-Limit überschritten:** 429 mit `Retry-After`-Header, UI-Toast mit verbleibender Wartezeit.
6. **Featured-Preset wird flagged während ISR-Cache aktiv:** max 60min stale akzeptiert. Bei Bedarf kann Admin `revalidatePath('/[locale]')` triggern (separater Admin-Button: out of scope für diese Iteration).
7. **Featured-Preset wird gelöscht (race):** Featured-Block fängt fehlende Daten ab und rendert all-time-Fallback.
8. **User wird suspended:** Comments bleiben sichtbar. Keine retroaktive Zensur.
9. **User-Account-Delete (DSGVO):** Comments cascade-deleted via `User.onDelete: Cascade`. Replies des gelöschten Users cascaden ebenfalls. Replies *anderer* User auf einen Comment des gelöschten Users werden via `parent.onDelete: Cascade` mitgelöscht.
10. **Autor des eigenen Presets kommentiert:** erlaubt — er darf nur nicht raten.
11. **URL-Auto-Link XSS-Härtung:** Body wird durchgängig als React-Text-Node gerendert (kein raw-HTML-Injection-Mechanismus). Der Auto-Link-Parser zerlegt den Body per Regex in Text-Segmente und URL-Segmente; URL-Segmente werden als `<a href={url} rel="nofollow noopener" target="_blank">` Knoten gerendert, alles andere als gewöhnliche Text-Children.
12. **CSRF:** Alle mutierenden Routes via `verifyCsrf()` (bestehender Helper, Pattern wie Rating-Route).

### Error-Handling-UX

| Status | UI-Reaktion |
|---|---|
| 401 | Inline-Toast „Bitte einloggen" mit Link `/auth/login?returnTo=current` |
| 403 (unverified) | Inline-Hinweis mit „Verifikationsmail erneut senden"-Link |
| 403 (own preset rate) | Stern disabled, Tooltip „Eigene Presets nicht bewertbar" |
| 409 (delete-then-edit) | Toast „Kommentar wurde bereits gelöscht" + Refresh der Liste |
| 429 | Toast mit `Retry-After`-Anzeige |
| 5xx | Toast „Konnte nicht speichern — erneut versuchen" + Retry-Button |

## i18n

Neue Translation-Keys in `messages/{de,en,es,fr,it,pt}.json`:

- `home.featured.*`: `title` („Featured · Top Rated · 30 Days"), `recent_comments` („Recent comments"), `open_preset` („Open preset →"), `no_featured` (Fallback-Text).
- `comments.*`: `post_button`, `placeholder`, `char_count` (`{count} / 1000`), `reply`, `edit`, `delete`, `deleted_by_author` („Vom Autor gelöscht"), `deleted_by_admin` („Vom Moderator entfernt"), `edited` („bearbeitet"), `sign_in_to_comment`, `load_more`, `your_comment`, `confirm_delete`, `admin_delete_reason`, `rate_limit_toast` (`Zu viele Kommentare – versuch's in {minutes}min`).
- `gallery.rate.sign_in_tooltip` („Anmelden zum Bewerten").
- `admin.comments.*`: `tab_title`, `column_user`, `column_preset`, `column_body`, `column_date`, `hard_delete_button`, `hard_delete_dialog_title`, `hard_delete_reason_label`.

Key-Parität wird durch bestehenden `tests/unit/i18n-parity.test.ts` erzwungen.

## Tests

### Unit (Vitest)

- `tests/unit/api/comments-create.test.ts` — Top-Level POST, Reply POST, 1-Level-Constraint Reject, verifizierter-User-Gate, eigenes-Preset OK, Maxlength 1000, Rate-Limit 10/h, CSRF.
- `tests/unit/api/comments-edit.test.ts` — Edit nur Autor, setzt `editedAt`, Edit auf soft-deleted → 409, Rate-Limit 30/h.
- `tests/unit/api/comments-delete.test.ts` — Author Soft-Delete setzt `deletedAt` + `deletedBy='AUTHOR'`, body auf null. Admin Hard-Delete entfernt Row, kaskadiert Replies, schreibt AdminAction-Log.
- `tests/unit/api/comments-list.test.ts` — Pagination (Cursor), Replies pro Top-Level eingehängt, Sortierung neueste zuerst, Soft-Delete-Items mit body=null und `deletedBy` zurückgegeben.
- `tests/unit/api/admin-comments.test.ts` — Liste, Admin-Gate, Reason-Validierung bei Hard-Delete.
- `tests/unit/lib/featuredPreset.test.ts` — Bayes-Formel-Korrektheit (1×5★ + m=5, C=4 → 4.17; 50×4.7★ → ~4.66), 30d-Filter, Fallback auf all-time, null bei leerer DB, ignoriert flagged.
- `tests/unit/components/CommentItem.test.tsx` — Render-States (normal, edited, soft-deleted by author, soft-deleted by admin, own-Actions, admin-Actions).
- `tests/unit/components/CommentForm.test.tsx` — Char-Counter, Submit + Reset, Disabled bei Rate-Limit.
- `tests/unit/components/FeaturedPresetBlock.test.tsx` — Render mit Featured + 3 Comments, Fallback all-time, kein Block bei null.
- `tests/unit/components/RateableGuitarRating.test.tsx` — Anon Click → Tooltip mit Login-Link, Own-Preset → disabled+Tooltip, Verifizierter → POST + Optimistic Update.
- `tests/unit/components/SignalChainStrip.test.tsx` — Render von 11 Slots, Realnamen aus `effects[]`, Amber-Akzent für active.
- `tests/unit/lib/autoLink.test.ts` — URL-Erkennung in Plaintext, rel/target Attribute, keine Cross-Site-Vektoren durch maliziöse URLs.
- `tests/unit/i18n-parity.test.ts` — bestehend, validiert neue Keys automatisch.

### E2E (Playwright)

- `tests/e2e/comments-flow.spec.ts` — Login → Share-Page → Kommentar posten → Reply → Edit → Soft-Delete (Platzhalter sichtbar, Reply weiterhin sichtbar).
- `tests/e2e/admin-comment-moderation.spec.ts` — Admin-Login → Admin-Dashboard → Comments-Tab → Hard-Delete mit Reason → AdminAction-Log-Eintrag verifizieren.
- `tests/e2e/featured-homepage.spec.ts` — DB-Fixture (1 Preset, ≥3 Ratings, 3 Comments) → Homepage zeigt Featured-Block korrekt, Link führt auf Share-Page.
- `tests/e2e/gallery-rate-inline.spec.ts` — Anon → Star-Click zeigt Tooltip mit Login-Link; nach Login → Star-Click rated und Update wird optimistic angezeigt.

## Deployment

1. `prisma migrate dev --name add_comments` lokal → committed.
2. Push auf master → automatischer Migrate beim Container-Start auf prod (bestehende `docker-entrypoint.sh`).
3. `npm run ci` muss grün sein.
4. CHANGELOG.md Eintrag (Features-Sektion).

## Open Risks

- **Featured-Query-Kosten:** mit aktuell ~145 öffentlichen Presets und wenigen Ratings ist die Query trivial. Bei Wachstum (10k+ Presets mit aktiven Ratings) muss auf materialisierte Spalte umgestellt werden — die Spec sieht das als spätere Migration vor (kein Re-Design nötig).
- **Spam-Risiko trotz Rate-Limit:** ein motivierter Spammer mit mehreren Accounts kann das Per-User-Limit umgehen. Mitigation: Admin-Moderation reicht für aktuelle Userzahl; flag-System auf Comments ist out-of-scope dieser Iteration aber leicht nachrüstbar.
- **ISR-Stale-Featured:** bis zu 60min veralteter Featured-Block. Akzeptabel für nicht-zeitkritischen Content. Manueller `revalidatePath`-Trigger durch Admin als Future-Enhancement notiert.
