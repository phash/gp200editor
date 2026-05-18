// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { Readable } from 'stream';

vi.mock('@/lib/storage', () => ({ getAudioStream: vi.fn() }));
vi.mock('@/lib/prisma', () => ({
  prisma: { preset: { findFirst: vi.fn() } },
}));
vi.mock('@/lib/session', () => ({ validateSession: vi.fn() }));

import { GET } from '@/app/api/preset-audio/[key]/route';
import { getAudioStream } from '@/lib/storage';
import { prisma } from '@/lib/prisma';
import { validateSession } from '@/lib/session';

function reqFor(key: string) {
  return new NextRequest(`http://test/api/preset-audio/${encodeURIComponent(key)}`);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.preset.findFirst).mockResolvedValue({
    id: 'p1',
    userId: 'u1',
    public: true,
    flagged: false,
    audioMimeType: 'audio/mpeg',
  } as never);
  vi.mocked(validateSession).mockResolvedValue({ user: null, session: null } as never);
});

describe('GET /api/preset-audio/[key]', () => {
  it('serves a valid mp3 key with audio/mpeg content-type', async () => {
    vi.mocked(getAudioStream).mockResolvedValue(Readable.from([Buffer.from('FFFB', 'utf8')]) as never);
    const res = await GET(reqFor('preset-abc123-1700000000.mp3'), { params: Promise.resolve({ key: 'preset-abc123-1700000000.mp3' }) });
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('audio/mpeg');
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=3600');
  });

  it('serves m4a with audio/mp4 content-type', async () => {
    vi.mocked(prisma.preset.findFirst).mockResolvedValue({ id: 'p1', userId: 'u1', public: true, flagged: false, audioMimeType: 'audio/mp4' } as never);
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

  it('refuses anon access to un-published preset audio: 404', async () => {
    vi.mocked(prisma.preset.findFirst).mockResolvedValue({ id: 'p1', userId: 'u1', public: false, flagged: false, audioMimeType: 'audio/mpeg' } as never);
    const res = await GET(reqFor('preset-abc-1.mp3'), { params: Promise.resolve({ key: 'preset-abc-1.mp3' }) });
    expect(res.status).toBe(404);
    expect(getAudioStream).not.toHaveBeenCalled();
  });

  it('refuses anon access to flagged preset audio: 404', async () => {
    vi.mocked(prisma.preset.findFirst).mockResolvedValue({ id: 'p1', userId: 'u1', public: true, flagged: true, audioMimeType: 'audio/mpeg' } as never);
    const res = await GET(reqFor('preset-abc-1.mp3'), { params: Promise.resolve({ key: 'preset-abc-1.mp3' }) });
    expect(res.status).toBe(404);
  });

  it('allows owner to stream their own un-published audio', async () => {
    vi.mocked(prisma.preset.findFirst).mockResolvedValue({ id: 'p1', userId: 'u1', public: false, flagged: false, audioMimeType: 'audio/mpeg' } as never);
    vi.mocked(validateSession).mockResolvedValue({ user: { id: 'u1', role: 'USER' }, session: {} } as never);
    vi.mocked(getAudioStream).mockResolvedValue(Readable.from([Buffer.from('FFFB', 'utf8')]) as never);
    const res = await GET(reqFor('preset-abc-1.mp3'), { params: Promise.resolve({ key: 'preset-abc-1.mp3' }) });
    expect(res.status).toBe(200);
  });

  it('allows admin to stream any un-published audio', async () => {
    vi.mocked(prisma.preset.findFirst).mockResolvedValue({ id: 'p1', userId: 'someone-else', public: false, flagged: false, audioMimeType: 'audio/mpeg' } as never);
    vi.mocked(validateSession).mockResolvedValue({ user: { id: 'a1', role: 'ADMIN' }, session: {} } as never);
    vi.mocked(getAudioStream).mockResolvedValue(Readable.from([Buffer.from('FFFB', 'utf8')]) as never);
    const res = await GET(reqFor('preset-abc-1.mp3'), { params: Promise.resolve({ key: 'preset-abc-1.mp3' }) });
    expect(res.status).toBe(200);
  });
});
