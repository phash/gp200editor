import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { runIngest } from '../../scripts/ingest/pipeline';
import { generateDescription } from '../../scripts/ingest/description';
import { autoTag } from '../../scripts/ingest/autoTag';
import type { IngestSource, PresetCandidate } from '../../scripts/ingest/types';
import type { GP200Preset } from '@/core/types';

const fixture = fs.readFileSync(
  path.join(process.cwd(), 'prst', "63-B American Idiot.prst"),
);

function makeSource(candidates: PresetCandidate[]): IngestSource {
  return {
    id: 'test',
    description: 'test source',
    async *fetch() {
      for (const c of candidates) yield c;
    },
  };
}

function mockPrisma() {
  return {
    preset: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'new' }),
    },
  };
}

const baseDeps = {
  libraryUserId: 'lib-1',
  uploadFn: vi.fn().mockResolvedValue(undefined),
  log: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('runIngest sourceUrl safety', () => {
  it('rejects javascript: sourceUrl', async () => {
    const prisma = mockPrisma();
    const res = await runIngest(
      makeSource([{ buffer: fixture, sourceUrl: 'javascript:alert(1)', sourceLabel: 'attacker' }]),
      { ...baseDeps, prisma: prisma as never },
    );
    expect(res.rejected).toBe(1);
    expect(prisma.preset.create).not.toHaveBeenCalled();
  });

  it('rejects data: sourceUrl', async () => {
    const prisma = mockPrisma();
    const res = await runIngest(
      makeSource([{ buffer: fixture, sourceUrl: 'data:text/html,<script>', sourceLabel: 'x' }]),
      { ...baseDeps, prisma: prisma as never },
    );
    expect(res.rejected).toBe(1);
  });

  it('rejects file: sourceUrl', async () => {
    const prisma = mockPrisma();
    const res = await runIngest(
      makeSource([{ buffer: fixture, sourceUrl: 'file:///etc/passwd', sourceLabel: 'x' }]),
      { ...baseDeps, prisma: prisma as never },
    );
    expect(res.rejected).toBe(1);
  });

  it('rejects malformed sourceUrl', async () => {
    const prisma = mockPrisma();
    const res = await runIngest(
      makeSource([{ buffer: fixture, sourceUrl: 'not a url', sourceLabel: 'x' }]),
      { ...baseDeps, prisma: prisma as never },
    );
    expect(res.rejected).toBe(1);
  });

  it('rejects sourceUrl longer than 2048 chars', async () => {
    const prisma = mockPrisma();
    const longUrl = 'https://example.com/' + 'a'.repeat(2100);
    const res = await runIngest(
      makeSource([{ buffer: fixture, sourceUrl: longUrl, sourceLabel: 'x' }]),
      { ...baseDeps, prisma: prisma as never },
    );
    expect(res.rejected).toBe(1);
  });

  it('rejects sourceLabel longer than 100 chars', async () => {
    const prisma = mockPrisma();
    const res = await runIngest(
      makeSource([
        { buffer: fixture, sourceUrl: 'https://example.com/', sourceLabel: 'x'.repeat(101) },
      ]),
      { ...baseDeps, prisma: prisma as never },
    );
    expect(res.rejected).toBe(1);
  });

  it('accepts http:// sourceUrl', async () => {
    const prisma = mockPrisma();
    const res = await runIngest(
      makeSource([{ buffer: fixture, sourceUrl: 'http://example.com/a.prst', sourceLabel: 'x' }]),
      { ...baseDeps, prisma: prisma as never },
    );
    expect(res.accepted).toBe(1);
  });
});

describe('runIngest validation', () => {
  it('rejects wrong-size buffer', async () => {
    const prisma = mockPrisma();
    const res = await runIngest(
      makeSource([{ buffer: Buffer.alloc(512), sourceUrl: 'https://example.com/a.prst', sourceLabel: 'example.com' }]),
      { ...baseDeps, prisma: prisma as never },
    );
    expect(res).toEqual({ accepted: 0, rejected: 1, duplicates: 0 });
  });

  it('rejects buffer missing TSRP magic', async () => {
    const prisma = mockPrisma();
    const res = await runIngest(
      makeSource([{ buffer: Buffer.alloc(1224), sourceUrl: 'https://example.com/a.prst', sourceLabel: 'example.com' }]),
      { ...baseDeps, prisma: prisma as never },
    );
    expect(res.rejected).toBe(1);
  });

  it('accepts a valid fixture', async () => {
    const prisma = mockPrisma();
    const res = await runIngest(
      makeSource([{ buffer: fixture, sourceUrl: 'https://example.com/a.prst', sourceLabel: 'example.com' }]),
      { ...baseDeps, prisma: prisma as never },
    );
    expect(res.accepted).toBe(1);
    expect(prisma.preset.create).toHaveBeenCalled();
  });
});

describe('runIngest dedup', () => {
  it('skips when sourceUrl already exists', async () => {
    const prisma = mockPrisma();
    prisma.preset.findFirst.mockResolvedValueOnce({ id: 'already' });
    const res = await runIngest(
      makeSource([{ buffer: fixture, sourceUrl: 'https://example.com/a.prst', sourceLabel: 'example.com' }]),
      { ...baseDeps, prisma: prisma as never },
    );
    expect(res.duplicates).toBe(1);
    expect(prisma.preset.create).not.toHaveBeenCalled();
  });

  it('skips when contentHash already exists', async () => {
    const prisma = mockPrisma();
    prisma.preset.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'dup', sourceUrl: 'other' });
    const res = await runIngest(
      makeSource([{ buffer: fixture, sourceUrl: 'https://example.com/a.prst', sourceLabel: 'example.com' }]),
      { ...baseDeps, prisma: prisma as never },
    );
    expect(res.duplicates).toBe(1);
  });

  it('dry run does not write', async () => {
    const prisma = mockPrisma();
    const res = await runIngest(
      makeSource([{ buffer: fixture, sourceUrl: 'https://example.com/a.prst', sourceLabel: 'example.com' }]),
      { ...baseDeps, prisma: prisma as never, dryRun: true },
    );
    expect(res.accepted).toBe(1);
    expect(prisma.preset.create).not.toHaveBeenCalled();
    expect(baseDeps.uploadFn).not.toHaveBeenCalled();
  });
});

describe('generateDescription', () => {
  function emptyPreset(): GP200Preset {
    return {
      version: '1',
      patchName: 'Test',
      author: undefined,
      effects: Array.from({ length: 11 }, (_, slotIndex) => ({
        slotIndex,
        enabled: false,
        effectId: 0,
        params: Array(15).fill(0),
      })),
      checksum: 0,
    };
  }

  it('falls back to bare sentence when nothing is active', () => {
    expect(generateDescription(emptyPreset())).toBe('Valeton GP-200 preset.');
  });

  it('appends hint when present', () => {
    expect(generateDescription(emptyPreset(), 'Some hint.')).toBe(
      'Valeton GP-200 preset. Some hint.',
    );
  });
});

describe('autoTag', () => {
  function emptyPreset(): GP200Preset {
    return {
      version: '1', patchName: 'x', author: undefined,
      effects: Array.from({ length: 11 }, (_, slotIndex) => ({
        slotIndex, enabled: false, effectId: 0, params: Array(15).fill(0),
      })),
      checksum: 0,
    };
  }

  it('adds "factory" for Valeton sources', () => {
    const tags = autoTag({ preset: emptyPreset(), sourceLabel: 'Valeton GP-200 Factory v1.8.0', name: 'anything' });
    expect(tags).toContain('factory');
  });

  it('adds "github" for github sources', () => {
    const tags = autoTag({ preset: emptyPreset(), sourceLabel: 'github.com/foo/bar', name: 'x' });
    expect(tags).toContain('github');
  });

  it('adds "community" for guitarpatches.com', () => {
    const tags = autoTag({ preset: emptyPreset(), sourceLabel: 'guitarpatches.com', name: 'x' });
    expect(tags).toContain('community');
  });

  it('adds "metal" genre tag for "Brutal Metal"', () => {
    const tags = autoTag({ preset: emptyPreset(), sourceLabel: 'github.com/x/y', name: 'Brutal Metal' });
    expect(tags).toContain('metal');
  });

  it('caps tags at 3', () => {
    const tags = autoTag({ preset: emptyPreset(), sourceLabel: 'Valeton x', name: 'metal clean blues' });
    expect(tags.length).toBeLessThanOrEqual(3);
  });
});
