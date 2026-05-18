import { parseBuffer } from 'music-metadata';

export const ALLOWED_AUDIO_MIME = new Set([
  'audio/mpeg',
  'audio/mp4',
  'audio/x-m4a',
  'audio/aac',
]);

export const MAX_AUDIO_BYTES = 2 * 1024 * 1024;            // 2 MB
export const MAX_AUDIO_DURATION_MS = 30_500;               // 30 s + 0.5 s tolerance

export type AudioValidationFailure = 'wrongType' | 'tooBig' | 'tooLong';

export type AudioValidationResult =
  | { ok: true; durationMs: number; mime: string }
  | { ok: false; reason: AudioValidationFailure };

// Magic-bytes probe. We refuse to trust the client-supplied mime alone — a
// .webm renamed to .mp3 would otherwise sneak through. These signatures
// cover the formats we accept; everything else is rejected.
function detectMagicMime(buf: Buffer): string | null {
  // MP3 with ID3v2 tag
  if (buf.length >= 3 && buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) {
    return 'audio/mpeg';
  }
  // MP3 raw MPEG frame sync (0xFFE0..0xFFFF — top 11 bits)
  if (buf.length >= 2 && buf[0] === 0xFF && (buf[1] & 0xE0) === 0xE0) {
    return 'audio/mpeg';
  }
  // MP4/M4A: bytes 4..7 == "ftyp"
  if (
    buf.length >= 8 &&
    buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70
  ) {
    return 'audio/mp4';
  }
  return null;
}

function mimeFamily(mime: string): 'mp3' | 'mp4' | null {
  if (mime === 'audio/mpeg') return 'mp3';
  if (mime === 'audio/mp4' || mime === 'audio/x-m4a' || mime === 'audio/aac') return 'mp4';
  return null;
}

export async function validateAudio(buf: Buffer, mime: string): Promise<AudioValidationResult> {
  if (!ALLOWED_AUDIO_MIME.has(mime)) {
    return { ok: false, reason: 'wrongType' };
  }
  if (buf.length > MAX_AUDIO_BYTES) {
    return { ok: false, reason: 'tooBig' };
  }
  const detected = detectMagicMime(buf);
  const claimed = mimeFamily(mime);
  if (!detected || mimeFamily(detected) !== claimed) {
    return { ok: false, reason: 'wrongType' };
  }
  let durationSec: number | undefined;
  try {
    const meta = await parseBuffer(buf, { mimeType: mime }, { duration: true });
    durationSec = meta.format.duration;
  } catch {
    return { ok: false, reason: 'wrongType' };
  }
  if (durationSec === undefined || !Number.isFinite(durationSec)) {
    return { ok: false, reason: 'wrongType' };
  }
  const durationMs = Math.round(durationSec * 1000);
  if (durationMs > MAX_AUDIO_DURATION_MS) {
    return { ok: false, reason: 'tooLong' };
  }
  return { ok: true, durationMs, mime };
}
