#!/usr/bin/env tsx
/**
 * PRST Library ingest CLI.
 *
 * Usage:
 *   tsx scripts/ingest-presets.ts <source> [options]
 *
 * Sources:
 *   guitarpatches        polite scrape of guitarpatches.com (10s delay)
 *   github               GitHub code search (needs GITHUB_TOKEN)
 *   valeton-factory      reads --path <folder> of .prst files
 *   manual               reads --file <json> of curated URLs
 *   all                  runs guitarpatches, github, manual (and valeton-factory if --path is given)
 *
 * Flags:
 *   --dry-run            validate + count but do not write to DB/S3
 *   --path <folder>      folder for valeton-factory
 *   --file <path>        JSON file for manual (default: scripts/ingest-data/manual-sources.json)
 */
import { prisma } from '../src/lib/prisma';
import { runIngest } from './ingest/pipeline';
import { guitarpatchesSource } from './ingest/sources/guitarpatches';
import { githubSource } from './ingest/sources/github';
import { valetonFactorySource } from './ingest/sources/valeton-factory';
import { manualSource } from './ingest/sources/manual';
import type { IngestSource, IngestCounters } from './ingest/types';

const args = process.argv.slice(2);
const which = args[0];
const dryRun = args.includes('--dry-run');

function readFlag(name: string): string | undefined {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}

async function resolveLibraryUserId(): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { username: 'factory-library' },
    select: { id: true },
  });
  if (!user) {
    console.error('x factory-library user not found. Run: tsx scripts/seed-factory-library-user.ts');
    process.exit(1);
  }
  return user.id;
}

function buildSources(): IngestSource[] {
  switch (which) {
    case 'guitarpatches':
      return [guitarpatchesSource()];
    case 'github':
      return [githubSource()];
    case 'valeton-factory': {
      const folder = readFlag('--path');
      if (!folder) {
        console.error('x valeton-factory requires --path <folder>');
        process.exit(1);
      }
      return [valetonFactorySource(folder)];
    }
    case 'manual': {
      const file = readFlag('--file') ?? 'scripts/ingest-data/manual-sources.json';
      return [manualSource(file)];
    }
    case 'all': {
      const valetonPath = readFlag('--path');
      const sources: IngestSource[] = [
        guitarpatchesSource(),
        githubSource(),
        manualSource(readFlag('--file') ?? 'scripts/ingest-data/manual-sources.json'),
      ];
      if (valetonPath) sources.push(valetonFactorySource(valetonPath));
      return sources;
    }
    default:
      console.error('Usage: tsx scripts/ingest-presets.ts <guitarpatches|github|valeton-factory|manual|all> [--dry-run] [--path ...] [--file ...]');
      process.exit(1);
  }
}

async function main() {
  const libraryUserId = await resolveLibraryUserId();
  const sources = buildSources();
  const total: IngestCounters = { accepted: 0, rejected: 0, duplicates: 0 };

  for (const source of sources) {
    const result = await runIngest(source, { prisma, libraryUserId, dryRun });
    total.accepted += result.accepted;
    total.rejected += result.rejected;
    total.duplicates += result.duplicates;
  }

  console.log('');
  console.log('==========================================');
  console.log(` Ingest finished:`);
  console.log(`   ${total.accepted} accepted`);
  console.log(`   ${total.rejected} rejected`);
  console.log(`   ${total.duplicates} duplicates`);
  console.log('==========================================');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
