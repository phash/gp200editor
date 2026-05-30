# Content Roadmap (GEO/AEO follow-up)

Tracks the long-form / multilingual content deferred from the 2026-05 SEO/UI
review. **Shipped** in that pass:

- `/guides` index + `/guides/gp-200-on-linux` (EN + DE) — TechArticle +
  BreadcrumbList JSON-LD, hreflang limited to translated locales, in the sitemap.
- All `/amp/[slug]` category pages localized across the 7 locales.

## Deferred — next content batch

### New guides (author EN + DE first, then translate)
- **GP-200 vs Line6 HX Stomp** — feature / sound / price comparison; high
  research-intent query. Link it from the HX Stomp `.hlx` import feature card.
- **GP-200 effects glossary** — what a compressor / reverb / flanger / etc.
  does, mapped to the GP-200 modules. Many beginner entry points; a strong
  internal-linking hub to `/amp/*` and the gallery effect filter.
- **Building a live setlist with cue points** — expands the help "Playlists"
  section into a standalone how-to.

### Translations
- Translate the `src/content/guides.ts` entries into ES / FR / IT / PT / PT-BR.
  Adding a locale to `GUIDES` auto-joins it to hreflang + the sitemap, and the
  index drops the "English" fallback badge for that locale.

### Infra (only when needed)
- **Sitemap-index split** — `src/app/sitemap.ts` caps at 5000 presets
  (`SITEMAP_PRESET_LIMIT`) and `console.warn`s when hit. The public library is
  currently ≈ 178 presets, so this is premature; revisit with Next
  `generateSitemaps()` before the library approaches ~5k.

### Amp pages — content depth
- Optionally add 2–3 sentences of real tone / history context per amp model
  (data-driven from a new field on the amp category), localized. Today the
  pages rely on the localized template intro plus the community preset list.
