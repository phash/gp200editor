import { BufferGenerator } from './BufferGenerator';
import { GP200PresetSchema, type GP200Preset } from './types';

// Mirror of PRSTDecoder offsets
const PRST_MAGIC         = 'TSRP';
const DEVICE_ID          = '2-PG';
const TOTAL_SIZE         = 1224;   // all real .prst files are exactly 1224 bytes
const OFFSET_MAGIC       = 0x00;
const OFFSET_DEVICE_ID   = 0x10;
const OFFSET_VERSION     = 0x15;
const OFFSET_MRAP        = 0x28;
const OFFSET_MRAP_SIZE   = 0x2C;
const MRAP_CONTENT_SIZE  = 1172;   // 1224 - 40 header - 4 "MRAP" - 4 size = 1176? no: 1224-52=1172
const OFFSET_PATCH_NAME  = 0x44;
const PATCH_NAME_MAX     = 32;
const OFFSET_CHECKSUM    = 0x4C6;

const EFFECT_BLOCK_COUNT = 11;
const EFFECT_BLOCK_START = 0xa0;
const EFFECT_BLOCK_SIZE  = 0x48;
const EFFECT_MARKER_0    = 0x14;   // block marker bytes: 14 00 44 00
const EFFECT_MARKER_2    = 0x44;
const PARAMS_OFFSET      = 0x0c;
const PARAMS_LENGTH      = 60;

export class PRSTEncoder {
  encode(preset: GP200Preset): ArrayBuffer {
    GP200PresetSchema.parse(preset);

    const gen = new BufferGenerator(TOTAL_SIZE);

    // File header
    gen.writeAscii(OFFSET_MAGIC, PRST_MAGIC, 4);
    gen.writeAscii(OFFSET_DEVICE_ID, DEVICE_ID, 4);
    gen.writeUint8(OFFSET_VERSION, parseInt(preset.version, 10));

    // MRAP chunk
    gen.writeAscii(OFFSET_MRAP, 'MRAP', 4);
    gen.writeUint32LE(OFFSET_MRAP_SIZE, MRAP_CONTENT_SIZE);

    // Patch name (null-terminated, padded to PATCH_NAME_MAX)
    gen.writeAscii(OFFSET_PATCH_NAME, preset.patchName, PATCH_NAME_MAX);

    // Effect blocks
    for (let i = 0; i < EFFECT_BLOCK_COUNT; i++) {
      const base = EFFECT_BLOCK_START + i * EFFECT_BLOCK_SIZE;
      gen.writeUint8(base + 0, EFFECT_MARKER_0);
      gen.writeUint8(base + 1, 0x00);
      gen.writeUint8(base + 2, EFFECT_MARKER_2);
      gen.writeUint8(base + 3, 0x00);

      const slot = preset.effects[i];
      if (slot) {
        gen.writeUint8(base + 4, slot.slotIndex);
        gen.writeUint8(base + 5, slot.enabled ? 1 : 0);
        gen.writeUint16LE(base + 8, slot.effectId);
        for (let p = 0; p < PARAMS_LENGTH && p < slot.params.length; p++) {
          gen.writeUint8(base + PARAMS_OFFSET + p, slot.params[p]);
        }
      } else {
        gen.writeUint8(base + 4, i); // slot index = position
      }
    }

    // Checksum (stored as-is; recalculation not implemented)
    gen.writeUint16LE(OFFSET_CHECKSUM, preset.checksum);

    return gen.toArrayBuffer();
  }
}
