# Content Roadmap (GEO/AEO follow-up)

Tracks the long-form / multilingual content deferred from the 2026-05 SEO/UI
review. **Shipped** in that pass:

- `/guides` index + `/guides/gp-200-on-linux` (EN + DE) — TechArticle +
  BreadcrumbList JSON-LD, hreflang limited to translated locales, in the sitemap.
- All `/amp/[slug]` category pages localized across the 7 locales.

**Shipped 2026-10-17** (from the October GSC report, see PR #101 for the
metadata side):

- `/guides/valeton-gp-200-editor`: landing page for the main non-brand
  query "gp 200 editor" (about 65 impressions, position 5, CTR 3%). It
  compares the official Valeton editor with Preset Forge.
- `/guides/prst-file`: what a .prst file is and how to open it. The query
  "prst file" ranked at position 12 with no page that matched it.
- All three guides in EN, DE, ES and PT-BR. Brazil sends the most search
  clicks of any country (85 in 3 months), and the Spanish-speaking countries
  together send about as many. Guide sections can now carry internal
  `links`.

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
- Translate the `src/content/guides/` entries into FR / IT / PT (ES and PT-BR done).
  Adding a locale to `GUIDES` auto-joins it to hreflang + the sitemap, and the
  index drops the "English" fallback badge for that locale.

### Brazil
- Curate a gallery collection of presets that match what Brazilian players
  search for (for example, styles popular in Brazilian rock and worship
  music). This needs input from someone who knows the scene; the data alone
  does not say which presets to pick.

### Infra (only when needed)
- **Sitemap-index split** — `src/app/sitemap.ts` caps at 5000 presets
  (`SITEMAP_PRESET_LIMIT`) and `console.warn`s when hit. The public library is
  currently ≈ 178 presets, so this is premature; revisit with Next
  `generateSitemaps()` before the library approaches ~5k.

### Amp pages — content depth
- Optionally add 2–3 sentences of real tone / history context per amp model
  (data-driven from a new field on the amp category), localized. Today the
  pages rely on the localized template intro plus the community preset list.
