# Changelog

## 2026-04-11

### Features
- **PRST Library + JSON API** — 145 curated Valeton GP-200 presets ingested from guitarpatches.com, each served with real-world amp/cab names (e.g. "Marshall® JCM800", "Fender® '65 Twin Reverb"). New `/api/share/[token]/json` endpoint serves a round-trip JSON document with signal chain, highlights, and raw preset data.
- **SEO-crawlable signal chain on share pages** — every share page now renders the full effect chain as semantic HTML with both Valeton fake names and real-world brand names. Google rich results supported via schema.org/Product markup per preset.
- **Amp category landing pages** — 64 new pages at `/[locale]/amp/[slug]` (e.g. `/en/amp/marshall-jcm800`, `/en/amp/mesa-boogie-dual-rectifier-modern-mode`), each listing all presets using that amp. Pre-rendered for both locales.
- **hreflang + canonical + JSON-LD** — every share page gets `<link rel="alternate" hreflang>` for de/en/x-default, `<link rel="canonical">`, schema.org/Product JSON-LD with auto-extracted brand, Open Graph + Twitter Card metadata.
- **Dynamic Open Graph images** — 1200×630 PNG per share page generated on demand via Next.js 15 `ImageResponse`, showing preset name + amp + cab real names with Preset Forge branding.
- **Ingest pipeline** — new `scripts/ingest-presets.ts` CLI with four source adapters: guitarpatches.com (polite 10s crawl delay), GitHub Code Search, Valeton factory folder, and a manual curated-URL list. Automatic validation (TSRP magic + checksum), dedup by source URL + sha256 content hash, auto-generated descriptions + tags.
- **Sitemap coverage** — 586 URLs including 128 amp category pages, 450 preset URLs (de/en/json), and 8 static pages. Force-dynamic so newly-ingested presets become indexable without redeploying.

### Bugfixes
- **Decoder NaN handling** — real .prst files from guitarpatches.com carry NaN bytes in unused effect params; the decoder now substitutes 0 so validation doesn't drop ~10% of the library.
- **Factory-size checksum** — 1176-byte factory presets no longer trip the out-of-bounds read at offset 0x4C6.
- **Description generator** — `generateDescription` no longer produces "cabinet cabinet" when the real name already contains the module label.
- **metadataBase** — Open Graph image URLs now resolve to `https://preset-forge.com/...` instead of `http://localhost:3000/...`.

### Local CI
- **GitHub Actions removed** — replaced with `scripts/local-ci.sh` running lint + typecheck + vitest + next build locally. New `npm run ci` entry point.

### Performance + Security (pre-library)
- Paginated `GET /api/presets` and `/presets` SSR page (default 100, max 500) — previously unbounded.
- Capped `sitemap.xml` query at 10 000 rows with `orderBy: updatedAt desc`.
- Memoized `getEffectParams` lookup in `EffectParams`.
- Middleware regex compilation moved to module scope (single pattern instead of three per request).
- `next-intl` upgraded to 4.9.1 (GHSA-8f24-v5vv-gm5j open redirect).
- `DELETE /api/admin/users/[id]` refuses to delete admins — forces an auditable PATCH demotion first.
- Per-IP rate limit on `/api/auth/forgot-password` alongside the existing per-email limit, closing the account enumeration side-channel.

## 2026-03-24

### Features
- **Live param updates from hardware** — When the user turns knobs on the GP-200 (Volume, Gain, Presence, Bass, Middle, Treble), sliders update in real-time in the webapp. New sub=0x10 D→H knob notification parsing with discriminator (bytes[29:37]=all zeros = knob, otherwise = toggle).
- **AMP Head Panel** — New `AmpHeadPanel` component showing the AMP block's main knobs (Gain/Presence/Volume + Bass/Middle/Treble) prominently at the top of the editor. Auto-detects AMP model from preset.
- **Collapsible head sections** — AMP Head, Preset Info + Patch Settings, and Controller sections can be independently toggled via a button bar at the top of the editor.
- **Auto-load preset names** — After device connect, all 256 preset names load automatically in the background. Previously required opening the slot browser first.

### Bugfixes
- **Correct initial slot detection** — State dump decoded[8:10] LE16 contains the active slot. Previously always returned slot 0. Verified via captures 084047 (slot 13/04-B) and 084156 (slot 0/01-A).
- **Bank switching on device slot change** — When device changes to a slot in a different bank, editor now pulls the entire new bank and switches tab. Previously loaded wrong preset into wrong tab.
- **MIDI operation serialization** — Background `loadPresetNames` no longer conflicts with `pullPreset`/`pushPreset`. Added `pauseNameLoading()` that aborts name loader before any pull/push/write operation.
- **Nibble-encode slot for slots > 127** — SysEx data bytes must be 0-127. Slot 252 (64-A) was sent as raw 0xFC (invalid). Now nibble-encoded at [25:26] in `buildPresetChange` and decoded in `onMidiMessage`.
- **Status bar shows editor preset name** — `currentPresetName` from editor takes priority over stale cached `presetNames`.
- **ControllerPanel visible when disconnected** — Shows at 50% opacity instead of hidden.
- **Cache-Control no-store in dev mode** — Prevents browser from serving stale JS after code changes.

### Protocol
- **State dump header decoded** — decoded[0:10]: constants + active slot at [8:10] LE16. Verified via captures 084047 (slot 13/04-B) and 084156 (slot 0/01-A).
- **D→H Knob notification (sub=0x10)** — byte[22]=block, byte[24]=param, [29:37]=zeros discriminator, [37:45]=nibble float32 value. AMP block=3: param 0=Gain, 1=Presence, 2=Volume, 3=Bass, 4=Middle, 5=Treble.

## 2026-03-23

### Features
- **EXP controller assignments** — Hardware-verified EXP1/EXP2 parameter selection + min/max via SysEx (sub=0x14 + sub=0x18).
- **NAM upload analysis** — Captured IR upload protocol (sub=0x1C, multi-chunk).
- **Patch Settings** — VOL/PAN/Tempo live editing via sub=0x10.

### Protocol
- **Save-to-Slot sub-slot index** — decoded[4] = A(0)/B(1)/C(2)/D(3). Without this, save always wrote to slot A.
- **Effekt-Change-Response (sub=0x0C)** — Block index, effect ID decoded from D→H notification.
- **EXP/Controller Assignment** — Navigation (sub=0x18) + Min/Max write (sub=0x14), hardware-verified.
