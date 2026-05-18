// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { Readable } from 'stream';

vi.mock('@/lib/storage', () => ({ getAudioStream: vi.fn() }));
vi.mock('@/lib/prisma', () => ({
  prisma: { preset: { findFirst: vi.fn() } },
}));

import { GET } from '@/app/api/preset-audio/[key]/route';
import { getAudioStream } from '@/lib/storage';
import { prisma } from '@/lib/prisma';

function reqFor(key: string) {
  return new NextRequest(`http://test/api/preset-audio/${encodeURIComponent(key)}`);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.preset.findFirst).mockResolvedValue({
    id: 'p1',
    audioMimeType: 'audio/mpeg',
  } as never);
});

describe('GET /api/preset-audio/[key]', () => {
  it('serves a valid mp3 key with audio/mpeg content-type', async () => {
    vi.mocked(getAudioStream).mockResolvedValue(Readable.from([Buffer.from('FFFB', 'utf8')]) as never);
    const res = await GET(reqFor('preset-abc123-1700000000.mp3'), { params: Promise.resolve({ key: 'preset-abc123-1700000000.mp3' }) });
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('audio/mpeg');
    expect(res.headers.get('Cache-Control')).toContain('immutable');
  });

  it('serves m4a with audio/mp4 content-type', async () => {
    vi.mocked(prisma.preset.findFirst).mockResolvedValue({ id: 'p1', audioMimeType: 'audio/mp4' } as never);
    vi.mocked(getAudioStream).mockResolvedValue(Readable.from([Buffer.from('00')]) as never);
    const res = await GET(reqFor('preset-abc123-1700000000.m4a'), { params: Promise.resolve({ key: 'preset-abc123-1700000000.m4a' }) });
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('audio/mp4');
  });

  it('rejects key with invalid pattern: 404', async () => {
    const res = await GET(reqFor('../../etc/passwd'), { params: Promise.resolve({ key: '../../etc/passwd' }) });
    expect(res.status).toBe(404);
    expect(getAudioStream).not.toHaveBeenCalled();
  });

  it('rejects key not referenced by any preset: 404', async () => {
    vi.mocked(prisma.preset.findFirst).mockResolvedValue(null);
    const res = await GET(reqFor('preset-orphan-1.mp3'), { params: Promise.resolve({ key: 'preset-orphan-1.mp3' }) });
    expect(res.status).toBe(404);
  });

  it('returns 404 when storage throws', async () => {
    vi.mocked(getAudioStream).mockRejectedValue(new Error('not found'));
    const res = await GET(reqFor('preset-abc-1.mp3'), { params: Promise.resolve({ key: 'preset-abc-1.mp3' }) });
    expect(res.status).toBe(404);
  });
});
