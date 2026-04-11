#!/usr/bin/env tsx
/**
 * Regenerates the `description` field for every library preset using the
 * current `generateDescription` helper + the stored .prst binary.
 *
 * Needed after the initial ingest used an older version of the description
 * generator (pre-"cabinet cabinet" fix) or any future description improvement.
 *
 * Usage: tsx scripts/regen-library-descriptions.ts [--dry-run]
 */
import { prisma } from '../src/lib/prisma';
import { downloadPresetBuffer } from '../src/lib/storage';
import { PRSTDecoder } from '../src/core/PRSTDecoder';
import { generateDescription } from './ingest/description';

const dryRun = process.argv.includes('--dry-run');

async function main() {
  const rows = await prisma.preset.findMany({
    where: { sourceUrl: { not: null } },
    select: {
      id: true,
      name: true,
      presetKey: true,
      description: true,
    },
  });

  console.log(`Found ${rows.length} library rows`);
  let updated = 0;
  let unchanged = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      const buffer = await downloadPresetBuffer(row.presetKey);
      const decoded = new PRSTDecoder(Buffer.from(buffer)).decode();
      // The hint is the part of the original description AFTER the canonical
      // "Valeton GP-200 preset: ..." sentence. Extract it via split.
      const existing = row.description ?? '';
      const hint = existing.match(/\. (Inspired by[^]*)$/)?.[1] ?? undefined;
      const next = generateDescription(decoded, hint);

      if (next === existing) {
        unchanged++;
        continue;
      }

      if (dryRun) {
        console.log(`DRY [${row.name}]`);
        console.log(`  old: ${existing.slice(0, 120)}`);
        console.log(`  new: ${next.slice(0, 120)}`);
      } else {
        await prisma.preset.update({
          where: { id: row.id },
          data: { description: next },
        });
      }
      updated++;
    } catch (err) {
      console.warn(`! ${row.name}: ${err instanceof Error ? err.message : err}`);
      failed++;
    }
  }

  console.log('');
  console.log(`${dryRun ? 'DRY RUN ' : ''}Done: ${updated} updated, ${unchanged} unchanged, ${failed} failed`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => { console.error(err); process.exit(1); });
