import { BufferGenerator } from './BufferGenerator';
import { GP200PresetSchema, type GP200Preset } from './types';

// Mirror of PRSTDecoder offsets — confirmed against real .prst files from GP-200
const PRST_MAGIC         = 'TSRP';
const DEVICE_ID          = '2-PG';
const TOTAL_SIZE         = 1224;
const OFFSET_MAGIC       = 0x00;
const OFFSET_DEVICE_ID   = 0x10;
const OFFSET_FW_VERSION  = 0x14;  // 4 bytes: 00 01 01 00
const OFFSET_TIMESTAMP   = 0x1C;  // 4 bytes LE uint32
const OFFSET_MRAP        = 0x28;
const OFFSET_MRAP_SIZE   = 0x2C;
const MRAP_CONTENT_SIZE  = 1172;

// Pre-name metadata (0x30-0x43)
const OFFSET_PRE_META    = 0x30;

const OFFSET_PATCH_NAME  = 0x44;
const PATCH_NAME_MAX     = 32;

// Routing section (0x8C-0x9F)
const OFFSET_ROUTING     = 0x8C;

// Effect blocks
const EFFECT_BLOCK_COUNT = 11;
const EFFECT_BLOCK_START = 0xA0;
const EFFECT_BLOCK_SIZE  = 0x48;
const PARAMS_OFFSET      = 0x0C;
const PARAMS_COUNT       = 15;

const OFFSET_CHECKSUM    = 0x4C6;

export class PRSTEncoder {
  encode(preset: GP200Preset): ArrayBuffer {
    GP200PresetSchema.parse(preset);

    const gen = new BufferGenerator(TOTAL_SIZE);

    // ── File header (0x00-0x2F) ──────────────────────────────────────────
    gen.writeAscii(OFFSET_MAGIC, PRST_MAGIC, 4);
    // 0x0B: unknown constant (0x06 in real files)
    gen.writeUint8(0x0B, 0x06);
    gen.writeAscii(OFFSET_DEVICE_ID, DEVICE_ID, 4);
    // Firmware version: 00 01 01 00 (FW 1.1 / 1.2)
    gen.writeUint8(OFFSET_FW_VERSION, 0x00);
    gen.writeUint8(OFFSET_FW_VERSION + 1, 0x01);
    gen.writeUint8(OFFSET_FW_VERSION + 2, 0x01);
    gen.writeUint8(OFFSET_FW_VERSION + 3, 0x00);
    // Timestamp (use current time as LE uint32)
    gen.writeUint32LE(OFFSET_TIMESTAMP, Math.floor(Date.now() / 1000) & 0xFFFFFFFF);
    // 0x24-0x25: constant 0x0494 LE
    gen.writeUint16LE(0x24, 0x0494);
    // MRAP chunk marker + size
    gen.writeAscii(OFFSET_MRAP, 'MRAP', 4);
    gen.writeUint32LE(OFFSET_MRAP_SIZE, MRAP_CONTENT_SIZE);

    // ── Pre-name metadata (0x30-0x43) ────────────────────────────────────
    gen.writeUint8(OFFSET_PRE_META, 0x02);       // 0x30
    gen.writeUint8(OFFSET_PRE_META + 2, 0x58);   // 0x32
    gen.writeUint8(OFFSET_PRE_META + 6, 0x78);   // 0x36
    gen.writeUint8(OFFSET_PRE_META + 8, 0x32);   // 0x38: '2' (part of preset format ID)

    // ── Patch name (0x44-0x63) ───────────────────────────────────────────
    gen.writeAscii(OFFSET_PATCH_NAME, preset.patchName, PATCH_NAME_MAX);

    // ── Routing section (0x8C-0x9F) ──────────────────────────────────────
    gen.writeUint8(OFFSET_ROUTING, 0x08);         // marker
    gen.writeUint8(OFFSET_ROUTING + 1, 0x00);
    gen.writeUint8(OFFSET_ROUTING + 2, 0x10);     // size
    gen.writeUint8(OFFSET_ROUTING + 3, 0x00);
    gen.writeUint8(OFFSET_ROUTING + 6, 0x04);     // constant
    gen.writeUint8(OFFSET_ROUTING + 7, 0x04);     // constant
    // Routing order: use effect slotIndex order from preset
    for (let i = 0; i < EFFECT_BLOCK_COUNT; i++) {
      const slot = preset.effects[i];
      gen.writeUint8(OFFSET_ROUTING + 8 + i, slot ? slot.slotIndex : i);
    }

    // ── Effect blocks (0xA0-0x3AF, 11 × 72 bytes) ───────────────────────
    for (let i = 0; i < EFFECT_BLOCK_COUNT; i++) {
      const base = EFFECT_BLOCK_START + i * EFFECT_BLOCK_SIZE;
      // Block marker: 14 00 44 00
      gen.writeUint8(base + 0, 0x14);
      gen.writeUint8(base + 1, 0x00);
      gen.writeUint8(base + 2, 0x44);
      gen.writeUint8(base + 3, 0x00);

      const slot = preset.effects[i];
      if (slot) {
        gen.writeUint8(base + 4, slot.slotIndex);
        gen.writeUint8(base + 5, slot.enabled ? 1 : 0);
        // Constant 0x000F at bytes +6,+7 (confirmed in all real .prst files)
        gen.writeUint8(base + 6, 0x00);
        gen.writeUint8(base + 7, 0x0F);
        gen.writeUint32LE(base + 8, slot.effectId);
        for (let p = 0; p < PARAMS_COUNT && p < slot.params.length; p++) {
          gen.writeFloat32LE(base + PARAMS_OFFSET + p * 4, slot.params[p]);
        }
      } else {
        gen.writeUint8(base + 4, i);
        gen.writeUint8(base + 6, 0x00);
        gen.writeUint8(base + 7, 0x0F);
      }
    }

    // ── Checksum (0x4C6-0x4C7) ───────────────────────────────────────────
    const buf = gen.toArrayBuffer();
    const bytes = new Uint8Array(buf);
    let sum = 0;
    for (let i = 0; i < OFFSET_CHECKSUM; i++) {
      sum += bytes[i];
    }
    const checksum = sum & 0xFFFF;
    bytes[OFFSET_CHECKSUM]     = (checksum >> 8) & 0xFF;
    bytes[OFFSET_CHECKSUM + 1] = checksum & 0xFF;

    return buf;
  }
}
