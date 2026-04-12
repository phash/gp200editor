# PRST Library (Factory User + Ingest)

- **System-User:** `factory-library` (owned by seed script `scripts/seed-factory-library-user.ts`, unusable password)
- **145+ ingested presets** von guitarpatches.com (auf Prod), alle mit `sourceLabel`, `sourceUrl`, `contentHash`, `ingestedAt` Spalten
- **Ingest-CLI:** `tsx scripts/ingest-presets.ts <source>` — sources: `guitarpatches` (10s crawl-delay, 2.5h), `github` (needs `GITHUB_TOKEN`), `valeton-factory --path <folder>`, `manual --file <json>`, `all`
- **Description regen:** `tsx scripts/regen-library-descriptions.ts` nach jedem Description-Generator-Change
- **Amp-Category-Pages:** `/[locale]/amp/[slug]` — 64 real-world Amps × 6 locales via `generateStaticParams` (`src/core/ampCategories.ts`)
- **JSON-API:** `GET /api/share/[token]/json` liefert round-trip `PresetJson` mit signalChain, highlights, raw (siehe `src/core/PRSTJsonCodec.ts`)
