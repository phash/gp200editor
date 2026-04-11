import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    preset: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('@/lib/storage', () => ({
  downloadPresetBuffer: vi.fn(),
}));

import { GET } from '@/app/api/share/[token]/json/route';
import { prisma } from '@/lib/prisma';
import { downloadPresetBuffer } from '@/lib/storage';

const fixtureBytes = fs.readFileSync(
  path.join(process.cwd(), 'prst', "63-B American Idiot.prst"),
);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/share/[token]/json', () => {
  it('returns 404 for unknown token', async () => {
    (prisma.preset.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    const res = await GET(new Request('http://localhost/api/share/nope/json'), {
      params: Promise.resolve({ token: 'nope' }),
    });
    expect(res.status).toBe(404);
  });

  it('returns 200 with valid JSON for a public preset', async () => {
    (prisma.preset.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      shareToken: 'abc',
      presetKey: 'preset-foo.prst',
      sourceUrl: null,
      sourceLabel: null,
      description: null,
      public: true,
    });
    (downloadPresetBuffer as ReturnType<typeof vi.fn>).mockResolvedValueOnce(fixtureBytes);

    const res = await GET(new Request('http://localhost/api/share/abc/json'), {
      params: Promise.resolve({ token: 'abc' }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(res.headers.get('cache-control')).toContain('max-age=3600');

    const body = await res.json();
    expect(body.schemaVersion).toBe(1);
    expect(body.signalChain).toHaveLength(11);
  });

  it('returns 404 for non-public preset (no info leak)', async () => {
    (prisma.preset.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    const res = await GET(new Request('http://localhost/api/share/priv/json'), {
      params: Promise.resolve({ token: 'priv' }),
    });
    expect(res.status).toBe(404);
  });
});
