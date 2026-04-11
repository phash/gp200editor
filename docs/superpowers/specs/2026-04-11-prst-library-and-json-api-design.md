# PRST Library + JSON API — Design Spec

**Date:** 2026-04-11
**Status:** Approved (brainstorming), ready for plan
**Author:** phash + Claude
**Goal:** bootstrap a searchable library of Valeton GP-200 `.prst` presets, expose each preset as SEO-friendly HTML and as a round-trip JSON document, so Google indexes the real-world amp and effect names behind Valeton's rebranded fake names.

---

## Problem

Preset Forge ships with 305 effect-ID → fake-name mappings and 255 fake-name → real-name mappings (e.g. `UK 800` → `Marshall JCM800`). That data exists in `src/core/effectNames.ts` and `src/core/effectDescriptions.ts` but is only visible inside the editor UI — never in crawlable HTML. Google cannot find the site when people search for real-world tones ("Valeton GP-200 Marshall JCM800 preset", "GP-200 Tube Screamer").

The site also has no seed content: the gallery is empty until users upload, and users won't upload until the gallery has content.

We solve both problems at once: curate a small library of real `.prst` files, ingest them into the existing gallery as a dedicated `factory-library` system user, and expose each preset in two new ways — as enriched crawlable HTML (extended share page) and as a round-trip JSON document served at `/api/share/[token]/json`.

## Out of scope

- Automatic scheduled ingest (cron). Ingest stays a manual script.
- Reddit / Discord API integration. Community-shared presets are curated into a hand-maintained JSON list (`manual-sources.json`).
- User-submission flow for the library (users proposing sources).
- Admin UI for editing `sourceUrl` / `sourceLabel` — SQL if ever needed.
- Multi-language preset summaries — everything stays English.
- Takedown automation — library is small enough to handle by hand.
- Versioning of library presets — each ingest is a fresh row, old rows stay.
- `JSON-LD` / `schema.org` structured data markup (no matching `@type` exists for audio effect presets).
- RSS feed.
- Refactoring the existing share-page tests.
- Changes to the regular user-upload flow (orthogonal).

## Architecture overview

Four cooperating pieces, all layered on top of the existing `Preset` gallery:

```
┌────────────────────────────────────┐      ┌────────────────────────┐
│ scripts/ingest-presets.ts          │      │ src/core/              │
│  ├── sources/guitarpatches.ts      │      │  PRSTJsonCodec.ts      │
│  ├── sources/github.ts             │ ───▶ │  (pure, no DB)         │
│  ├── sources/valeton-factory.ts    │      │                        │
│  └── sources/manual.ts             │      │                        │
└────────────┬───────────────────────┘      └──────────┬─────────────┘
             │                                          │
             │ validates + decodes + dedups             │ decodeFromJson
             │ writes via prisma + garage               │ encodeToJson
             ▼                                          ▼
      ┌────────────────────────┐            ┌──────────────────────────┐
      │ Preset table + garage  │ ─────────▶ │ GET /api/share/[token]   │
      │  + new columns:        │            │ GET /api/share/[token]/  │
      │   sourceUrl            │            │     json   ← new         │
      │   sourceLabel          │            │                          │
      │   ingestedAt           │            └──────────┬───────────────┘
      │   contentHash          │                       │
      └────────────────────────┘                       ▼
                                         ┌─────────────────────────────┐
                                         │ /[locale]/share/[token]     │
                                         │  ├─ existing header         │
                                         │  ├─ <SignalChainSection>    │
                                         │  │  (NEW — crawlable HTML)  │
                                         │  └─ source attribution      │
                                         └─────────────────────────────┘
```

Each piece ships as its own commit with green local CI.

## Data model

Four new columns on `Preset` and two new indexes. Additive, no downtime risk.

```prisma
model Preset {
  // existing columns unchanged

  sourceUrl   String?   // dedup key for ingested rows; null for regular user uploads
  sourceLabel String?   // human-readable, shown on share page ("Valeton GP-200 Factory v1.8.0", "github.com/foo/bar")
  contentHash String?   // sha256 of the .prst bytes, dedups identical files under different URLs
  ingestedAt  DateTime? // set only by the ingest script; distinguishes curated from user rows

  @@index([sourceLabel]) // fast filter for the future "library only" view in the gallery
  @@index([contentHash]) // fast dedup lookup during ingest
}
```

Migration name: `preset_source_attribution`.

The library user is seeded separately via `scripts/seed-factory-library-user.ts`:

```ts
// email: factory-library@preset-forge.com
// username: factory-library
// role: USER
// emailVerified: true
// suspended: false
// passwordHash: UNUSABLE sentinel string so login is impossible
```

## JSON schema

The JSON served at `/api/share/[token]/json`:

```json
{
  "schemaVersion": 1,
  "name": "Brit Crunch",
  "author": "Galtone Studio",
  "description": "Classic British crunch tone.",
  "sourceUrl": "https://github.com/example/gp200-presets/blob/main/brit-crunch.prst",
  "sourceLabel": "github.com/example/gp200-presets",

  "summary": "Ibanez TS808 overdrive into a Marshall JCM800 head, routed to a Celestion V30 2x12 cabinet, plate reverb, and a slap delay.",

  "signalChain": [
    { "slot": 0, "module": "PRE", "active": true,  "valetonName": "COMP Bass", "realName": "Boss CS-3",          "category": "Compressor" },
    { "slot": 1, "module": "DST", "active": true,  "valetonName": "Scream OD", "realName": "Ibanez TS808",       "category": "Overdrive" },
    { "slot": 2, "module": "AMP", "active": true,  "valetonName": "UK 800",    "realName": "Marshall JCM800",    "category": "Amp head" },
    { "slot": 3, "module": "CAB", "active": true,  "valetonName": "UK GRN 2",  "realName": "Celestion V30 2x12", "category": "Cabinet" }
  ],

  "highlights": {
    "amp":   { "valetonName": "UK 800",   "realName": "Marshall JCM800" },
    "cab":   { "valetonName": "UK GRN 2", "realName": "Celestion V30 2x12" },
    "drive": { "valetonName": "Scream OD","realName": "Ibanez TS808" }
  },

  "raw": {
    "patchName": "Brit Crunch",
    "author": "Galtone Studio",
    "effects": [
      { "slotIndex": 0, "active": true,  "effectId": 65, "params": [0.5, 0.3, 0.5] }
    ],
    "fileSize": 1224,
    "checksum": "0x7a3f"
  },

  "urls": {
    "download": "/api/share/abc123/download",
    "openInEditor": "/en/editor?share=abc123",
    "html": "/en/share/abc123"
  }
}
```

Field-by-field decisions:

- `schemaVersion: 1` — any future breaking change bumps this; consumers can branch.
- `signalChain` contains all 11 slots including `active: false` ones, because round-tripping needs the full slot array. Order is slot-index ascending.
- `highlights` is a convenience shortcut over `signalChain` filtered to the first active `AMP`, `CAB`, `DST` respectively. Any of them can be `null`.
- `summary` is produced by a rule-based template, **not** an LLM. Deterministic — same inputs, same output. Used both on the HTML share page (as `<p class="sr-only">`) and in the JSON.
- `raw` is everything `PRSTEncoder` needs to rebuild the `.prst`. This is the round-trip surface. Everything else in the JSON is derived and can be regenerated from `raw`.
- `urls` are paths, not absolute URLs, so the JSON document is domain-portable. The API endpoint hardcodes `locale: 'en'` for canonical URLs; the share page passes its own locale when it calls the codec internally (SSR), but the public `/api/share/[token]/json` is locale-independent.

**Round-trip contract:** `decodeFromJson(encodeToJson(decode(buffer)))` produces a `GP200Preset` that is deeply equal to `decode(buffer)`. Byte-identical re-encoding is **not** a goal — `PRSTEncoder` already recomputes the checksum, so if the source `.prst` had an anomaly the re-encoded file is valid but not byte-identical.

## New helper: `downloadPresetBuffer` in `src/lib/storage.ts`

Today `storage.ts` exports `getPresetStream(key): Promise<Readable>` and both existing download routes manually stream-to-buffer via a `chunks.push` loop. The JSON API endpoint and the extended share page need the same thing. A small helper removes the duplication at the three call sites:

```ts
// src/lib/storage.ts  (new export)
export async function downloadPresetBuffer(key: string): Promise<Buffer> {
  const stream = await getPresetStream(key);
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}
```

The two existing download routes are refactored to call this helper in the same commit where it is introduced (commit 2 of the rollout). This is a deliberately in-scope DRY cleanup because we are adding a third caller — three duplicates is where the abstraction pays back. Buffering a 1224-byte preset is not a memory concern.

## New module: `src/core/PRSTJsonCodec.ts`

Pure TypeScript, no DB, no network. Exports:

```ts
export const PRESET_JSON_SCHEMA_VERSION = 1;

export type PresetJson = {
  schemaVersion: 1;
  name: string;
  author: string | null;
  description: string | null;
  sourceUrl: string | null;
  sourceLabel: string | null;
  summary: string;
  signalChain: SignalChainEntry[];
  highlights: { amp: NameRef | null; cab: NameRef | null; drive: NameRef | null };
  raw: RawPresetData;
  urls: { download: string; openInEditor: string; html: string };
};

export type SignalChainEntry = {
  slot: number;
  module: string;           // 'PRE' | 'DST' | 'AMP' | 'CAB' | 'MOD' | 'DLY' | 'RVB' | 'EQ' | 'NR' | 'WAH' | 'VOL'
  active: boolean;
  valetonName: string;      // 'UK 800' — from effectNames.ts
  realName: string | null;  // 'Marshall JCM800' — from effectDescriptions.ts, null if no mapping exists
  category: string;         // 'Amp head' | 'Cabinet' | 'Overdrive' | ... — derived from module
};

type NameRef = { valetonName: string; realName: string | null };

type RawPresetData = {
  patchName: string;
  author: string | null;
  effects: Array<{ slotIndex: number; active: boolean; effectId: number; params: number[] }>;
  fileSize: number;
  checksum: string;
};

export function encodeToJson(
  preset: GP200Preset,
  opts: {
    shareToken: string;
    locale: 'de' | 'en';
    sourceUrl: string | null;
    sourceLabel: string | null;
    description: string | null;
    checksum: number;
    fileSize: number;
  },
): PresetJson;

export function decodeFromJson(json: PresetJson): GP200Preset;

// Internal helpers (exported for unit-test visibility)
export function buildSignalChain(preset: GP200Preset): SignalChainEntry[];
export function pickHighlights(chain: SignalChainEntry[]): PresetJson['highlights'];
export function generateSummary(chain: SignalChainEntry[]): string;
```

**Unknown-effect handling:** if `effectId` is not in `effectNames.ts`, the entry gets `valetonName: "Unknown #{effectId}"` and `realName: null`. Never throws — the encoder must tolerate future firmware that adds effects we don't yet map.

**Summary template** (simplified):

```
<drive-real> into a <amp-real> amp, routed to a <cab-real> cabinet<, modulated with <mod-real>><, with <dly-real> delay><, and <rvb-real> reverb>.
```

Missing modules are silently dropped from the sentence. If neither AMP, CAB, nor DST is active: `"Valeton GP-200 preset ‘<name>’."`. No English punctuation corner cases — good enough for SEO.

## New endpoint: `GET /api/share/[token]/json`

```ts
// src/app/api/share/[token]/json/route.ts
export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const preset = await prisma.preset.findUnique({
    where: { shareToken: token, public: true },
    select: { /* everything needed for JSON + presetKey for the buffer */ },
  });
  if (!preset) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const buffer = await downloadPresetBuffer(preset.presetKey);          // garage
  const decoded = new PRSTDecoder(buffer).decode();
  const checksum = buffer.readUInt16BE(0x4C6);
  const json = encodeToJson(decoded, {
    shareToken: token,
    locale: 'en',
    sourceUrl: preset.sourceUrl,
    sourceLabel: preset.sourceLabel,
    description: preset.description,
    checksum,
    fileSize: buffer.length,
  });

  return NextResponse.json(json, {
    headers: {
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
}
```

- Public (no auth), same as `/api/share/[token]/download`.
- 404 on both missing-token and `public: false`, so private presets cannot be probed via this endpoint (no info leak).
- `Cache-Control` matches the share page revalidate window (1 h). Library presets change almost never, so this is conservative.

## Share-page HTML extension

`src/app/[locale]/share/[token]/page.tsx` grows two new pieces:

**1. A new Server Component `SignalChainSection` that renders crawlable HTML.**

```tsx
// src/app/[locale]/share/[token]/SignalChainSection.tsx  (NEW)
import type { PresetJson } from '@/core/PRSTJsonCodec';

export function SignalChainSection({ json }: { json: PresetJson }) {
  const activeSlots = json.signalChain.filter((s) => s.active);
  if (activeSlots.length === 0) return null;

  return (
    <section aria-labelledby="signal-chain-heading" className="mb-6">
      <h2 id="signal-chain-heading" className="font-mono-display text-sm uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
        Signal Chain
      </h2>

      {/* Highlights chips */}
      <div className="flex flex-wrap gap-2 mb-4">
        {json.highlights.amp && <HighlightChip label="AMP" ref={json.highlights.amp} />}
        {json.highlights.cab && <HighlightChip label="CAB" ref={json.highlights.cab} />}
        {json.highlights.drive && <HighlightChip label="DRIVE" ref={json.highlights.drive} />}
      </div>

      {/* Full ordered list */}
      <ol className="space-y-1.5 text-sm">
        {activeSlots.map((s) => (
          <li key={s.slot} className="flex gap-3 items-baseline">
            <span className="slot-num">{s.slot + 1}.</span>
            <span className="module-badge">{s.module}</span>
            <span className="valeton-name">{s.valetonName}</span>
            {s.realName && (
              <>
                <span aria-hidden="true">→</span>
                <span className="real-name" style={{ color: 'var(--text-muted)' }}>{s.realName}</span>
              </>
            )}
          </li>
        ))}
      </ol>

      {/* Screen-reader friendly summary, also crawled by Google */}
      <p className="sr-only">{json.summary}</p>
    </section>
  );
}
```

Zero client-side JavaScript. The page is fully server-rendered HTML.

**2. `generateMetadata()` is extended to inline highlights into the `<meta>` description.**

```ts
const amp = highlights.amp?.realName ?? highlights.amp?.valetonName;
const cab = highlights.cab?.realName ?? highlights.cab?.valetonName;
const drive = highlights.drive?.realName ?? highlights.drive?.valetonName;

const description = [
  preset.description,
  amp && `${amp}`,
  cab && `through ${cab}`,
  drive && `with ${drive}`,
].filter(Boolean).join(' · ') + ' — Free Valeton GP-200 preset, open in browser editor.';
```

The title gains the amp real name:

```ts
const title = `${preset.name}${amp ? ` — ${amp} preset` : ''} by @${user} | Preset Forge`;
```

**3. Attribution footer** when `sourceLabel` is set:

```tsx
{preset.sourceLabel && (
  <p className="text-xs mt-6" style={{ color: 'var(--text-muted)' }}>
    Source:{' '}
    {preset.sourceUrl ? (
      <a href={preset.sourceUrl} rel="nofollow noopener">{preset.sourceLabel}</a>
    ) : (
      preset.sourceLabel
    )}
  </p>
)}
```

`rel="nofollow"` is important: we don't want to leak PageRank to random Dropbox/forum links.

**4. Server-side data loading:**

The existing `page.tsx` currently loads the `Preset` row only. It now also:

- Calls `downloadPresetBuffer(preset.presetKey)` to get the bytes
- Decodes via `PRSTDecoder`
- Builds a `PresetJson` via `encodeToJson(...)` (the same code the API endpoint uses — single source of truth)
- Passes the `PresetJson` to both `SignalChainSection` and `generateMetadata`

**Cache strategy:** `export const revalidate = 3600` on the share page. Next.js caches the rendered HTML + the S3 fetch for 1 h. Acceptable because library presets change approximately never and user-uploaded presets are edited rarely.

**Feature flag:** initially, the `SignalChainSection` is rendered for **all** public share pages (library and user uploads alike). Rationale: the marginal cost is one S3 GET + 1 ms of decode per request per hour; the SEO benefit applies to every preset on the site. No separate feature gate.

## Ingest pipeline: `scripts/ingest-presets.ts`

CLI entry point:

```bash
tsx scripts/ingest-presets.ts <source> [options]
#   source ∈ {github, valeton-factory, manual, all}
```

**Source interface** (`scripts/ingest/sources/types.ts`):

```ts
export type PresetCandidate = {
  buffer: Buffer;
  sourceUrl: string;
  sourceLabel: string;
  suggestedName?: string;
  hint?: string;
};

export interface IngestSource {
  readonly id: string;
  readonly description: string;
  fetch(): AsyncIterable<PresetCandidate>;
}
```

**Four source implementations:**

1. **`sources/guitarpatches.ts`** — guitarpatches.com is the big win. This community site already aggregates hundreds of GP-200 patches and serves them as 1224-byte `.prst` downloads. Structure as probed 2026-04-11:
   - **Listing page:** `https://guitarpatches.com/patches.php?unit=GP200&sort=date&page={N}` paginated 1..N (observed ≥ 10 pages). Each card is HTML: `<div class="card ..." onclick="...ID=14655';">` with `<h1 class="title is-5">Name</h1>` and `<h2 class="subtitle is-6">Artist</h2>`.
   - **Detail page:** `https://guitarpatches.com/patches.php?mode=show&unit=GP200&ID={id}` — contains `<p class="title is-3">Name - Artist</...>` and `<p class="subtitle is-5">description</p>` plus an uploader `<h3>` and date `<h3>`.
   - **Download:** `https://guitarpatches.com/download.php?unit=GP200&mode=download&ID={id}` — returns `Content-Type: application/octet-stream` + `Content-Length: 1224` + `Content-Disposition: attachment; filename="..."`.
   - **Implementation:** walk the listing pages until a page returns zero card `<div>`s, extract IDs via regex, fetch each detail page for metadata, then fetch the download. `sourceUrl: "https://guitarpatches.com/patches.php?mode=show&unit=GP200&ID={id}"` (the canonical human-facing URL, not the download URL). `sourceLabel: "guitarpatches.com"`. `suggestedName: "{Name}"`, `hint: "Inspired by {Artist}. Originally uploaded by {uploader} on {date}."` — the hint is wired straight into `generateDescription`.
   - **Robots.txt compliance:** `https://guitarpatches.com/robots.txt` sets `Crawl-delay: 10` for the default user-agent and blocks `bot`, `GPTBot`, `Amazonbot`, and others. The ingest source:
     - Sends `User-Agent: PresetForge-Ingest/1.0 (+https://preset-forge.com; contact: phash@phash.de)` — descriptive, not pretending to be a browser, not matching any blocked substring
     - Sleeps 10 s between every request (listing, detail, download)
     - Respects `429` responses with exponential backoff and fails the source cleanly if rate-limited persistently
   - Roughly 200–300 candidates expected over ~10 pages × ~20 cards. At 3 requests per patch × 10 s delay this is ~2.5 hours — acceptable for a one-off curated ingest. Progress is logged to stdout so the operator can watch.

2. **`sources/github.ts`** — GitHub Code Search API (`GET /search/code?q=extension:prst+gp200`). Honours `GITHUB_TOKEN` env var for the higher rate limit. First 100 hits or 5 minutes, whichever comes first. `sourceLabel: "github.com/{owner}/{repo}"`.

3. **`sources/valeton-factory.ts`** — reads a local folder passed via `--path`. Iterates `.prst` files. `sourceUrl: "valeton://factory/v1.8.0/{filename}"` (synthetic deduplicable URL). Gracefully logs and skips if path does not exist.

4. **`sources/manual.ts`** — reads `scripts/ingest-data/manual-sources.json`:
   ```json
   [
     { "url": "https://example.com/foo.prst", "label": "r/guitarpedals via @user123", "name": "Metal Chug" }
   ]
   ```
   This is the right place for forum, Reddit and Dropbox links that don't warrant their own adapter. You curate this file by hand; the script does the downloading.

**Pipeline (shared across sources):**

```
for each candidate:
  1. size check (1224 or 1176 bytes)
  2. TSRP magic check
  3. PRSTDecoder.decode() catches checksum + effect-id errors
  4. sourceUrl dedup lookup (skip if already ingested)
  5. contentHash dedup lookup (skip if same bytes under different URL)
  6. upload to garage (preset-{libraryUserId}-{uuid}.prst)
  7. prisma.preset.create({ ...metadata, userId: libraryUser.id, public: true, sourceUrl, sourceLabel, contentHash, ingestedAt })
```

Each failure (decode, network, write) logs with the source-URL context and moves on to the next candidate. A corrupt file must never kill a batch.

**Name normalization:** GP-200 user presets are saved under a bank/slot coordinate such as `05-D Metallica` or `63-A American Idiot`. The `NN-[A-D] ` prefix reflects the device slot where the preset was last stored — it is meaningless once the file lives in our library and confusing in listings. The ingest pipeline strips the prefix via a dedicated helper:

```ts
// scripts/ingest/normalizeName.ts
const SLOT_PREFIX_RE = /^\d{1,2}-[A-D]\s+/;

export function normalizePresetName(raw: string): string {
  return raw.replace(SLOT_PREFIX_RE, '').trim();
}
```

Applied after `PRSTDecoder.decode()` but before the DB insert:

```ts
const name = normalizePresetName(
  decoded.patchName.trim() || candidate.suggestedName || 'Untitled',
).slice(0, 32);
```

Non-matching names pass through unchanged. A patch literally called `05-D Awesome` without a space is not matched (the regex requires trailing whitespace), which is the conservative side. User-uploaded presets (the regular upload flow) are **not** touched — that's a separate flow with its own tests and users may have intentionally kept the slot coordinate as a label. Extending this to user uploads can be a follow-up if the community asks for it.

Unit test in `tests/unit/normalizeName.test.ts`:

```
"05-D Metallica"         → "Metallica"
"63-A American Idiot"    → "American Idiot"
"3-B Clean"              → "Clean"
"01-A Cold Gin"          → "Cold Gin"
"Metallica"              → "Metallica"       (no prefix, unchanged)
"05-DAwesome"            → "05-DAwesome"     (no space, not stripped)
"05-E Weird"             → "05-E Weird"      (E is not a valid GP-200 slot letter)
"  05-D Metallica  "     → "Metallica"       (outer whitespace trimmed)
```

**Auto description** is generated by `generateDescription(preset, hint)`:

```ts
function generateDescription(preset: GP200Preset, hint?: string): string {
  const amp = findActiveInModule(preset, 'AMP');     // { valetonName, realName }
  const cab = findActiveInModule(preset, 'CAB');
  const drive = findActiveInModule(preset, 'DST');
  const parts: string[] = [];
  if (amp)   parts.push(`${amp.realName ?? amp.valetonName} amp`);
  if (cab)   parts.push(`${cab.realName ?? cab.valetonName} cabinet`);
  if (drive) parts.push(`with ${drive.realName ?? drive.valetonName} drive`);
  const base = parts.length > 0
    ? `Valeton GP-200 preset: ${parts.join(', ')}.`
    : 'Valeton GP-200 preset.';
  return hint ? `${base} ${hint}` : base;
}
```

Different code path from the JSON `summary` on purpose: the description is what's persisted in `Preset.description` and shown in many list contexts, so it should be short and stable; the summary is what's rendered into the SEO block and can be more verbose.

**Auto tags** via `autoTag(preset): string[]`:

- Always starts empty
- Adds `"factory"` if `sourceLabel.startsWith('Valeton')`
- Adds `"github"` if `sourceLabel.startsWith('github.com')`
- Adds a genre tag if the preset name matches a keyword regex:
  - `/metal|brutal|djent/i` → `"metal"`
  - `/clean|pristine|jazz/i` → `"clean"`
  - `/blues|bb king/i` → `"blues"`
  - `/ambient|shimmer|pad/i` → `"ambient"`
- Max 3 tags, genre tag last

Conservative by design. Bad tags are worse than missing tags.

**Dry-run flag:** `--dry-run` logs what would happen but does not write to S3 or DB. Used to validate a fresh source before committing rows.

**CLI shape:**

```bash
tsx scripts/ingest-presets.ts github                                    # needs GITHUB_TOKEN
tsx scripts/ingest-presets.ts valeton-factory --path "$HOME/.wine/.../Factory"
tsx scripts/ingest-presets.ts manual --file scripts/ingest-data/manual-sources.json
tsx scripts/ingest-presets.ts all --dry-run
```

## Sitemap

`src/app/sitemap.ts` already iterates public presets and emits share URLs. No change required to include library entries — they are just public presets.

One small addition: emit the `/api/share/[token]/json` URL as a second entry per preset, with `changeFrequency: "yearly"` (library JSON is effectively immutable). This ensures Google discovers the JSON endpoint even though it is not linked from any HTML page.

```ts
presetPages = publicPresets.flatMap((preset) => [
  { url: `${BASE_URL}/de/share/${preset.shareToken}`, lastModified: preset.updatedAt, changeFrequency: 'weekly', priority: 0.6 },
  { url: `${BASE_URL}/en/share/${preset.shareToken}`, lastModified: preset.updatedAt, changeFrequency: 'weekly', priority: 0.6 },
  { url: `${BASE_URL}/api/share/${preset.shareToken}/json`, lastModified: preset.updatedAt, changeFrequency: 'yearly', priority: 0.3 },
]);
```

Existing cap of 10 000 rows still applies; at 3 URLs per preset we are well below the sitemap 50 k hard limit.

## Tests

**Unit tests (vitest):**

1. `tests/unit/PRSTJsonCodec.test.ts`
   - Fixture round-trip: for every `.prst` in the `prst/` fixture folder, `decodeFromJson(encodeToJson(decode(file), opts))` deep-equals `decode(file)`
   - Schema validation: every `encodeToJson` output matches a Zod schema (`PresetJsonSchema` declared in the same module)
   - Unknown `effectId`: encoding `999` produces `valetonName: "Unknown #999"`, `realName: null`, no throw
   - `buildSignalChain` ordering: 11 entries, slot 0 first, `active: false` slots included
   - `pickHighlights` with no active AMP → `highlights.amp: null`
   - `generateSummary` determinism: same input → same string across 10 calls

2. `tests/unit/ingest-pipeline.test.ts`
   - Wrong size (e.g. 512 bytes) → candidate rejected
   - Missing TSRP magic → rejected
   - Corrupt body → decode throws → rejected, pipeline continues
   - Same `sourceUrl` ingested twice → second is skipped (prisma mocked)
   - Different `sourceUrl`, same `contentHash` → second is skipped
   - `generateDescription` for AMP+CAB+DST preset vs. AMP-only vs. none
   - `autoTag` for "Brutal Metal Djent" → includes `"metal"`, for "Jazz Club" → includes `"clean"`, for generic "Foo" → no genre tag
   - All prisma access mocked in the pattern established by `tests/unit/errorLog.test.ts`

3. `tests/unit/sitemap.test.ts`
   - Library presets appear in the emitted entries
   - JSON URL is emitted alongside HTML URLs
   - 10 000 cap is respected (mock Prisma with 10 001 rows)

4. `tests/unit/normalizeName.test.ts`
   - The eight cases listed in the Name Normalization section
   - Idempotency: `normalizePresetName(normalizePresetName(x)) === normalizePresetName(x)` for all cases

5. `tests/unit/guitarpatches-parser.test.ts`
   - Fixture: a captured copy of `patches.php?unit=GP200&sort=date&page=1` and one detail page (saved to `tests/fixtures/guitarpatches/`, committed as-is so the test is offline)
   - `parseListingPage(html)` extracts the expected number of patch IDs + names + artists
   - `parseDetailPage(html, id)` extracts name, artist, description, uploader, date
   - Tolerant of the `<p class="title is-3">Name - Artist</h4>` tag mismatch observed on the live site
   - No network calls — the `fetch` dependency is passed in as a parameter so the test can stub it

**API tests (vitest + mocked prisma):**

6. `tests/unit/api-share-json.test.ts`
   - Valid token + `public: true` → 200, JSON matches `PresetJsonSchema`
   - Unknown token → 404
   - Known token but `public: false` → 404 (no info leak — the error body is identical to the unknown-token case)
   - Response has `Content-Type: application/json; charset=utf-8`
   - Response has `Cache-Control: public, max-age=3600, s-maxage=3600`

**E2E test (Playwright — one new file):**

7. `tests/e2e/library-share-seo.spec.ts`
   - Setup: seed one library preset directly via prisma (bypasses the ingest pipeline). Use a fixture `.prst` whose active AMP is `UK 800` / Marshall JCM800
   - Navigate to `/de/share/<token>`
   - Assert: `h2#signal-chain-heading` exists
   - Assert: rendered HTML contains both `UK 800` and `Marshall JCM800` strings
   - Assert: `<meta name="description">` content contains `Marshall JCM800`
   - Assert: `GET /api/share/<token>/json` returns `application/json; charset=utf-8` with a body that parses as a valid `PresetJson`
   - Assert: the JSON `highlights.amp.realName` equals `"Marshall JCM800"`
   - Teardown: delete the seeded preset
   - No axe-a11y run needed — the existing `a11y.spec.ts` already covers the share page structure

**Test fixtures:** the three `.prst` files already in `prst/` cover the round-trip tests. Two synthetic buffers (wrong size, wrong magic) are declared inline in `ingest-pipeline.test.ts`. One manipulated buffer with `effectId: 999` is built inline in `PRSTJsonCodec.test.ts`.

## Rollout order

Ten commits, each with a green local CI pass (`bash scripts/local-ci.sh`).

1. **Prisma migration** — `preset_source_attribution`. Add four columns and two indexes. No code changes outside `prisma/schema.prisma`.
2. **Storage helper + refactor** — add `downloadPresetBuffer` to `src/lib/storage.ts` and switch the two existing download routes to use it. No behaviour change; tests still pass.
3. **`PRSTJsonCodec` library** — `src/core/PRSTJsonCodec.ts` + unit tests. Pure TypeScript. The single source of truth the API endpoint and the share page both call into.
4. **JSON API endpoint** — `src/app/api/share/[token]/json/route.ts` + API tests.
5. **Share-page extension** — `SignalChainSection` component, `generateMetadata` rebuild, attribution footer, S3 fetch + decode in `page.tsx`.
6. **Sitemap update** — emit JSON URLs, add the new `sitemap.test.ts`.
7. **Factory-library user seed** — `scripts/seed-factory-library-user.ts`. Run once in the dev DB to verify, commit the script.
8. **Ingest pipeline** — `scripts/ingest-presets.ts` + all four source implementations + `ingest-pipeline.test.ts`. `--dry-run` flag works.
9. **First real ingest (local)** — run all sources against the local dev DB. Eyeball a few rendered share pages to confirm the SEO block looks right. Export the new library rows via `pg_dump --table=Preset --data-only --where="\"sourceUrl\" IS NOT NULL"` + the matching S3 objects.
10. **Prod import** — copy the SQL dump + S3 objects up to the VPS, `psql` import them into the prod DB and `aws s3 cp` into prod garage. Redeploy via `scripts/deploy-update.sh`, run the SEO E2E against `https://preset-forge.com` as a smoketest.

Commits 1–8 are pure development. Commits 9–10 are one-time data ops, not committed code.

## Risks and mitigations

- **Copyright on forum/Dropbox presets.** Mitigation: `sourceUrl` + `sourceLabel` attribution on every share page, takedown requests handled by SQL delete.
- **guitarpatches.com scraping policy.** The site's robots.txt blocks AI scrapers but allows default crawlers with a 10 s crawl delay. We honour the delay, send a descriptive User-Agent, link every ingested preset back to the source detail page, and commit to removing any preset on request. If the site owner objects, `DELETE FROM "Preset" WHERE "sourceLabel" = 'guitarpatches.com'` removes everything from that source in one statement.
- **Valeton firmware license.** The factory presets ship with the firmware the user has already licensed by owning the device. We redistribute them as a format-converted library with clear attribution. If Valeton ever objects, `DELETE FROM "Preset" WHERE "sourceLabel" LIKE 'Valeton%'` removes every row in one statement.
- **Google indexing empty or broken pages.** Mitigation: `SignalChainSection` returns `null` if no slots are active, so there is no empty `<h2>`; the rest of the share page still renders.
- **GitHub API rate limits.** Mitigation: respect the `X-RateLimit-*` headers, honour `GITHUB_TOKEN`, sleep-and-retry on 429.
- **Library rows filling the gallery feed and drowning user uploads.** Mitigation: the `sort=newest` default still surfaces user rows first by `createdAt`; library entries carry `ingestedAt` dates so we could filter later if needed. No change in the gallery query for v1.
- **S3 fetch on every share page load increases latency.** Mitigation: `revalidate: 3600` on the Route Handler. Library presets are effectively static; the cache absorbs nearly every request.
- **Schema drift between `PresetJson` and the stored `Preset` row.** Mitigation: the codec is called via the same `encodeToJson` function from both the API endpoint and the page; a single Zod schema validates both call sites; tests pin the schema.
