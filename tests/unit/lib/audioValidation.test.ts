import { describe, it, expect, vi } from 'vitest';
import { validateAudio, ALLOWED_AUDIO_MIME, MAX_AUDIO_BYTES, MAX_AUDIO_DURATION_MS } from '@/lib/audioValidation';

vi.mock('music-metadata', () => ({
  parseBuffer: vi.fn(),
}));
import { parseBuffer } from 'music-metadata';

// 12-byte stubs starting with each expected magic-byte signature.
const ID3_HEADER = Buffer.concat([Buffer.from([0x49, 0x44, 0x33, 0x03, 0, 0, 0, 0, 0, 0, 0, 0]), Buffer.alloc(100)]);
const MP3_RAW_SYNC = Buffer.concat([Buffer.from([0xFF, 0xFB, 0x90, 0x00]), Buffer.alloc(100)]);
const MP4_FTYP = Buffer.concat([Buffer.from([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x4D, 0x34, 0x41, 0x20]), Buffer.alloc(100)]);
const WEBM = Buffer.concat([Buffer.from([0x1A, 0x45, 0xDF, 0xA3]), Buffer.alloc(100)]);

describe('validateAudio', () => {
  it('accepts MP3 with ID3 header at 15s duration', async () => {
    vi.mocked(parseBuffer).mockResolvedValue({ format: { duration: 15 } } as never);
    const r = await validateAudio(ID3_HEADER, 'audio/mpeg');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.durationMs).toBe(15000);
  });

  it('accepts MP3 with raw frame sync', async () => {
    vi.mocked(parseBuffer).mockResolvedValue({ format: { duration: 20 } } as never);
    const r = await validateAudio(MP3_RAW_SYNC, 'audio/mpeg');
    expect(r.ok).toBe(true);
  });

  it('accepts M4A (mp4 ftyp)', async () => {
    vi.mocked(parseBuffer).mockResolvedValue({ format: { duration: 10 } } as never);
    const r = await validateAudio(MP4_FTYP, 'audio/mp4');
    expect(r.ok).toBe(true);
  });

  it('rejects unsupported mime', async () => {
    const r = await validateAudio(ID3_HEADER, 'audio/webm');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('wrongType');
  });

  it('rejects mime/magic mismatch (mime says mp3 but bytes are WebM)', async () => {
    const r = await validateAudio(WEBM, 'audio/mpeg');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('wrongType');
  });

  it('rejects file over 2 MB', async () => {
    const big = Buffer.concat([ID3_HEADER, Buffer.alloc(MAX_AUDIO_BYTES)]);
    const r = await validateAudio(big, 'audio/mpeg');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('tooBig');
  });

  it('rejects duration > 30.5s', async () => {
    vi.mocked(parseBuffer).mockResolvedValue({ format: { duration: 35 } } as never);
    const r = await validateAudio(ID3_HEADER, 'audio/mpeg');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('tooLong');
  });

  it('accepts duration exactly at tolerance boundary 30.5s', async () => {
    vi.mocked(parseBuffer).mockResolvedValue({ format: { duration: 30.5 } } as never);
    const r = await validateAudio(ID3_HEADER, 'audio/mpeg');
    expect(r.ok).toBe(true);
  });

  it('rejects when music-metadata throws', async () => {
    vi.mocked(parseBuffer).mockRejectedValue(new Error('corrupt'));
    const r = await validateAudio(ID3_HEADER, 'audio/mpeg');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('wrongType');
  });
});
