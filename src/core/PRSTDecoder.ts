import { BinaryParser } from './BinaryParser';
import { GP200PresetSchema, type GP200Preset } from './types';

// Confirmed offsets from reverse engineering real .prst files (2026-03-16)
export const PRST_MAGIC = 'TSRP';
const OFFSET_MAGIC       = 0x00;  // 4 bytes: "TSRP"
const OFFSET_VERSION     = 0x15;  // 1 byte: version minor (e.g. 1)
const OFFSET_PATCH_NAME  = 0x44;  // null-terminated, max 32 bytes
const PATCH_NAME_MAX     = 32;
const OFFSET_CHECKSUM    = 0x4C6; // LE uint16 (last 2 bytes of 1224-byte file)

const EFFECT_BLOCK_COUNT  = 11;    // GP-200 has 11 effect slots
const EFFECT_BLOCK_START  = 0xa0;  // first block offset
const EFFECT_BLOCK_SIZE   = 0x48;  // 72 bytes per block
// Within each block:
const SLOT_OFFSET         = 4;     // slot index (0–10)
const ACTIVE_OFFSET       = 5;     // 0 = bypassed, 1 = active
const MODEL_OFFSET        = 8;     // LE uint32: effect model code (high byte = module type)
const PARAMS_OFFSET       = 0x0c;  // 15 x float32 LE (60 bytes total)
const PARAMS_COUNT        = 15;

export class PRSTDecoder {
  private parser: BinaryParser;

  constructor(buffer: Uint8Array) {
    this.parser = new BinaryParser(buffer);
  }

  hasMagic(): boolean {
    return this.parser.readAscii(OFFSET_MAGIC, 4) === PRST_MAGIC;
  }

  decode(): GP200Preset {
    if (!this.hasMagic()) {
      throw new Error('Invalid .prst file: magic header not found');
    }

    const version = String(this.parser.readUint8(OFFSET_VERSION));
    const patchName = this.parser.readAscii(OFFSET_PATCH_NAME, PATCH_NAME_MAX);

    const effects: GP200Preset['effects'] = [];
    for (let i = 0; i < EFFECT_BLOCK_COUNT; i++) {
      const base = EFFECT_BLOCK_START + i * EFFECT_BLOCK_SIZE;
      const slotIndex = this.parser.readUint8(base + SLOT_OFFSET);
      const enabled   = this.parser.readUint8(base + ACTIVE_OFFSET) === 1;
      const effectId  = this.parser.readUint32LE(base + MODEL_OFFSET);
      const params: number[] = [];
      for (let p = 0; p < PARAMS_COUNT; p++) {
        params.push(this.parser.readFloat32LE(base + PARAMS_OFFSET + p * 4));
      }
      effects.push({ slotIndex, enabled, effectId, params });
    }

    const checksum = this.parser.readUint16LE(OFFSET_CHECKSUM);

    return GP200PresetSchema.parse({ version, patchName, effects, checksum });
  }
}
