import crypto from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { PRSTDecoder, PRST_MAGIC } from '@/core/PRSTDecoder';
import { normalizePresetName } from '@/core/normalizePresetName';
import { extractModules, extractEffects } from '@/core/extractModules';
import { uploadPreset } from '@/lib/storage';
import { generateDescription } from './description';
import { autoTag } from './autoTag';
import type { PresetCandidate, IngestSource, IngestCounters } from './types';

export type PipelineDeps = {
  prisma: PrismaClient;
  libraryUserId: string;
  uploadFn?: (key: string, buffer: Buffer) => Promise<void>;
  log?: (level: 'info' | 'warn' | 'error', msg: string) => void;
  dryRun?: boolean;
};

const defaultLog: PipelineDeps['log'] = (level, msg) => {
  const prefix = level === 'info' ? '  ' : level === 'warn' ? '! ' : 'x ';
  console.log(`${prefix}${msg}`);
};

export async function runIngest(
  source: IngestSource,
  deps: PipelineDeps,
): Promise<IngestCounters> {
  const log = (deps.log ?? defaultLog) as NonNullable<PipelineDeps['log']>;
  const upload = deps.uploadFn ?? uploadPreset;
  const counters: IngestCounters = { accepted: 0, rejected: 0, duplicates: 0 };

  log('info', `Source ${source.id}: ${source.description}`);
  if (deps.dryRun) log('info', 'DRY RUN — nothing will be written');

  for await (const candidate of source.fetch()) {
    const result = await ingestOne(candidate, deps, upload, log);
    counters[result]++;
  }

  log(
    'info',
    `Source ${source.id} done: ${counters.accepted} accepted, ${counters.rejected} rejected, ${counters.duplicates} duplicates`,
  );
  return counters;
}

/** Allow only http(s) sourceUrls — no javascript:/data:/file: etc. */
function isSafeSourceUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

async function ingestOne(
  candidate: PresetCandidate,
  deps: PipelineDeps,
  upload: (key: string, buffer: Buffer) => Promise<void>,
  log: NonNullable<PipelineDeps['log']>,
): Promise<'accepted' | 'rejected' | 'duplicates'> {
  // 0. sourceUrl safety — must be http(s) and absolute. Reject candidates
  // with javascript:/data:/file: URLs so they never land in the DB and
  // leak into the public /api/share/[token]/json response or share pages.
  if (!isSafeSourceUrl(candidate.sourceUrl)) {
    log('warn', `${candidate.sourceUrl}: unsafe or invalid sourceUrl, skip`);
    return 'rejected';
  }
  if (candidate.sourceUrl.length > 2048) {
    log('warn', `${candidate.sourceUrl.slice(0, 80)}…: sourceUrl too long, skip`);
    return 'rejected';
  }
  if (candidate.sourceLabel.length > 100) {
    log('warn', `${candidate.sourceUrl}: sourceLabel too long, skip`);
    return 'rejected';
  }

  // 1. Size check
  if (candidate.buffer.length !== 1224 && candidate.buffer.length !== 1176) {
    log('warn', `${candidate.sourceUrl}: wrong size ${candidate.buffer.length}`);
    return 'rejected';
  }

  // 2. TSRP magic
  if (candidate.buffer.toString('ascii', 0, 4) !== PRST_MAGIC) {
    log('warn', `${candidate.sourceUrl}: missing TSRP magic`);
    return 'rejected';
  }

  // 3. Decode (validates checksum + all effect IDs)
  let decoded;
  try {
    decoded = new PRSTDecoder(candidate.buffer).decode();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log('warn', `${candidate.sourceUrl}: decode failed: ${msg}`);
    return 'rejected';
  }

  // 4. sourceUrl dedup
  const bySourceUrl = await deps.prisma.preset.findFirst({
    where: { sourceUrl: candidate.sourceUrl },
    select: { id: true },
  });
  if (bySourceUrl) {
    log('info', `${candidate.sourceUrl}: already ingested, skip`);
    return 'duplicates';
  }

  // 5. contentHash dedup
  const contentHash = crypto.createHash('sha256').update(candidate.buffer).digest('hex');
  const byHash = await deps.prisma.preset.findFirst({
    where: { contentHash },
    select: { id: true, sourceUrl: true },
  });
  if (byHash) {
    log('info', `${candidate.sourceUrl}: same bytes as ${byHash.sourceUrl}, skip`);
    return 'duplicates';
  }

  const rawName = decoded.patchName.trim() || candidate.suggestedName || 'Untitled';
  const name = normalizePresetName(rawName).slice(0, 32) || 'Untitled';
  const description = generateDescription(decoded, candidate.hint);
  const tags = autoTag({ preset: decoded, sourceLabel: candidate.sourceLabel, name });

  if (deps.dryRun) {
    log('info', `+ DRY: ${name} from ${candidate.sourceLabel}`);
    return 'accepted';
  }

  // 6. Upload to garage
  const key = `preset-${deps.libraryUserId}-${crypto.randomUUID().replace(/-/g, '')}.prst`;
  await upload(key, candidate.buffer);

  // 7. Create DB row
  await deps.prisma.preset.create({
    data: {
      userId: deps.libraryUserId,
      presetKey: key,
      name,
      description,
      tags,
      author: decoded.author?.trim() || null,
      shareToken: crypto.randomUUID().replace(/-/g, ''),
      public: true,
      modules: extractModules(decoded),
      effects: extractEffects(decoded),
      sourceUrl: candidate.sourceUrl,
      sourceLabel: candidate.sourceLabel,
      contentHash,
      ingestedAt: new Date(),
    },
  });

  log('info', `+ ${name} from ${candidate.sourceLabel}`);
  return 'accepted';
}
