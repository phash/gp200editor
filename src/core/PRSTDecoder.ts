import { BinaryParser } from './BinaryParser';
import { GP200PresetSchema, type GP200Preset } from './types';

// Confirmed offsets from reverse engineering real .prst files (2026-03-16)
export const PRST_MAGIC = 'TSRP';
const OFFSET_MAGIC       = 0x00;  // 4 bytes: "TSRP"
const OFFSET_VERSION     = 0x15;  // 1 byte: version minor (e.g. 1)
const OFFSET_PATCH_NAME  = 0x44;  // null-terminated, max 16 bytes (not 32 — author follows)
const PATCH_NAME_MAX     = 16;
const OFFSET_AUTHOR      = 0x54;  // null-terminated, max 16 bytes
const AUTHOR_MAX         = 16;
const OFFSET_CHECKSUM    = 0x4C6; // BE uint16 (last 2 bytes of 1224-byte file)

const EFFECT_BLOCK_COUNT  = 11;    // GP-200 has 11 effect slots
const EFFECT_BLOCK_START  = 0xa0;  // first block offset
const EFFECT_BLOCK_SIZE   = 0x48;  // 72 bytes per block
// Routing section — 11 playback-order bytes at 0x94..0x9E inside the
// 0x8C header block. Each byte is the slotIndex (block type) that runs
// at playback position i.
const OFFSET_ROUTING_ORDER = 0x94;
// Within each block:
const SLOT_OFFSET         = 4;     // slot index (0–10)
const ACTIVE_OFFSET       = 5;     // 0 = bypassed, 1 = active
const MODEL_OFFSET        = 8;     // LE uint32: effect model code (high byte = module type)
const PARAMS_OFFSET       = 0x0c;  // 15 x float32 LE (60 bytes total)
const PARAMS_COUNT        = 15;

export class PRSTDecoder {
  private parser: BinaryParser;
  private buffer: Uint8Array;

  constructor(buffer: Uint8Array) {
    this.parser = new BinaryParser(buffer);
    this.buffer = buffer;
  }

  hasMagic(): boolean {
    return this.parser.readAscii(OFFSET_MAGIC, 4) === PRST_MAGIC;
  }

  decode(): GP200Preset {
    const len = this.parser.byteLength;
    if (len !== 1224 && len !== 1176) {
      throw new Error(`Invalid .prst file: expected 1224 or 1176 bytes, got ${len}`);
    }
    if (!this.hasMagic()) {
      throw new Error('Invalid .prst file: magic header not found');
    }

    const version = String(this.parser.readUint8(OFFSET_VERSION));
    const patchName = this.parser.readAscii(OFFSET_PATCH_NAME, PATCH_NAME_MAX).trim();
    const author = this.parser.readAscii(OFFSET_AUTHOR, AUTHOR_MAX);

    // Read all 11 blocks in physical (slotIndex) order first.
    const byBlock: GP200Preset['effects'] = [];
    for (let i = 0; i < EFFECT_BLOCK_COUNT; i++) {
      const base = EFFECT_BLOCK_START + i * EFFECT_BLOCK_SIZE;
      const slotIndex = this.parser.readUint8(base + SLOT_OFFSET);
      const enabled   = this.parser.readUint8(base + ACTIVE_OFFSET) === 1;
      const effectId  = this.parser.readUint32LE(base + MODEL_OFFSET);
      const params: number[] = [];
      for (let p = 0; p < PARAMS_COUNT; p++) {
        // Substitute 0 for NaN/Infinity — real .prst files in the wild
        // (e.g. guitarpatches.com uploads) sometimes store NaN bytes for
        // unused slots. Zod rejects NaN, so the whole decode would fail.
        // Clamping to 0 is lossless for downloads (we always serve the
        // original S3 bytes) and only affects the derived JSON view.
        const raw = this.parser.readFloat32LE(base + PARAMS_OFFSET + p * 4);
        params.push(Number.isFinite(raw) ? raw : 0);
      }
      byBlock.push({ slotIndex, enabled, effectId, params });
    }

    // Re-order the array by playback order (routing bytes). When the
    // routing is identity (0..10) this is a no-op; when the user had
    // dragged effects in the Valeton editor, it reflects their chosen
    // playback sequence. Invalid routing bytes (>10 or duplicates) fall
    // back to identity order so we never lose a block.
    const routing: number[] = [];
    const seen = new Set<number>();
    for (let i = 0; i < EFFECT_BLOCK_COUNT; i++) {
      const v = this.parser.readUint8(OFFSET_ROUTING_ORDER + i);
      if (v < EFFECT_BLOCK_COUNT && !seen.has(v)) {
        routing.push(v);
        seen.add(v);
      }
    }
    const effects: GP200Preset['effects'] =
      routing.length === EFFECT_BLOCK_COUNT
        ? routing.map((si) => byBlock[si])
        : byBlock;

    // User presets (1224 bytes) carry a BE16 checksum at 0x4C6. Factory
    // presets (1176 bytes) don't have room for that footer — the checksum
    // offset (1222) is past the end of the buffer. Skip the read and use 0
    // as a placeholder for factory files; downloads still serve the exact
    // original S3 bytes, and the hardware regenerates its own checksum
    // whenever it re-saves a preset anyway.
    const checksum = len === 1224 ? this.parser.readUint16BE(OFFSET_CHECKSUM) : 0;

    // Hand the full original buffer back so the encoder can round-trip any
    // regions the editor doesn't model (controller/EXP assignments, pre-name
    // metadata, routing header extras). Force a true Uint8Array (Node's
    // Buffer is a subclass that Zod's instanceof check rejects in v4).
    const rawSource = new Uint8Array(this.buffer.buffer.slice(
      this.buffer.byteOffset,
      this.buffer.byteOffset + this.buffer.byteLength,
    ));

    return GP200PresetSchema.parse({
      version, patchName, author: author || undefined, effects, checksum, rawSource,
    });
  }
}
