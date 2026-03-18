import type { GP200Preset } from './types';
import { GP200PresetSchema } from './types';

export const SysExCodec = {
  nibbleDecode(data: Uint8Array): Uint8Array {
    const out = new Uint8Array(Math.floor(data.length / 2));
    for (let i = 0; i < out.length; i++) {
      out[i] = ((data[2 * i] & 0x0F) << 4) | (data[2 * i + 1] & 0x0F);
    }
    return out;
  },

  nibbleEncode(data: Uint8Array): Uint8Array {
    const out = new Uint8Array(data.length * 2);
    for (let i = 0; i < data.length; i++) {
      out[2 * i]     = (data[i] >> 4) & 0x0F;
      out[2 * i + 1] = data[i] & 0x0F;
    }
    return out;
  },

  slotToLabel(slot: number): string {
    const bank = Math.floor(slot / 4) + 1;
    const letter = 'ABCD'[slot % 4];
    return `${bank}${letter}`;
  },

  labelToSlot(label: string): number {
    const match = label.match(/^(\d+)([ABCD])$/);
    if (!match) throw new Error(`Invalid slot label: ${label}`);
    const bank = parseInt(match[1], 10);
    const letter = 'ABCD'.indexOf(match[2]);
    return (bank - 1) * 4 + letter;
  },

  buildReadRequest(slot: number): Uint8Array {
    // CMD=0x11, sub=0x10, 46 bytes (§4.4 "Request Full Preset Data")
    // Slot number at bytes 16, 29, 33 (0-based)
    const n = slot & 0xFF;
    return new Uint8Array([
      0xF0, 0x21, 0x25, 0x7E, 0x47, 0x50, 0x2D, 0x32,  // [0-7]   header
      0x11, 0x10,                                        // [8-9]   CMD, sub
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00,              // [10-15] padding
      n,                                                  // [16]    slot
      0x00, 0x00, 0x04, 0x00, 0x00, 0x00, 0x01, 0x00, // [17-24]
      0x00, 0x00, 0x04, 0x00,                           // [25-28]
      n,                                                  // [29]    slot
      0x00, 0x00, 0x00,                                 // [30-32]
      n,                                                  // [33]    slot
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // [34-41]
      0x00, 0x00, 0x00,                                 // [42-44]
      0xF7,                                              // [45]    end
    ]);
  },

  parsePresetName(sysexMsg: Uint8Array): string {
    // Extract nibble data from a sub=0x18 chunk (offset must be 0)
    // sysexMsg layout: [F0 header(10B)][slot(1B)][off_lo(1B)][off_hi(1B)][nibble_data...][F7]
    const nibbleData = sysexMsg.slice(13, sysexMsg.length - 1);
    const decoded = this.nibbleDecode(nibbleData);
    // In a full preset, name starts at byte 28. In the first chunk (offset=0),
    // the nibble data covers decoded bytes 0..184, so name is at decoded[28..59].
    let name = '';
    for (let i = 0; i < 32; i++) {
      const b = decoded[28 + i];
      if (b === 0) break;
      name += String.fromCharCode(b);
    }
    return name;
  },

  parseReadChunks(chunks: Uint8Array[]): GP200Preset {
    // Sort by chunk offset (bytes [11:13] of each SysEx message are offset LE16)
    const sorted = [...chunks].sort((a, b) => {
      const offA = a[11] | (a[12] << 8);
      const offB = b[11] | (b[12] << 8);
      return offA - offB;
    });

    // Concatenate nibble data from all 7 chunks
    const nibbleParts = sorted.map(msg => msg.slice(13, msg.length - 1));
    const totalNibbleLen = nibbleParts.reduce((s, p) => s + p.length, 0);
    const allNibbles = new Uint8Array(totalNibbleLen);
    let pos = 0;
    for (const part of nibbleParts) {
      allNibbles.set(part, pos);
      pos += part.length;
    }

    // Nibble-decode → 1176 bytes
    const decoded = this.nibbleDecode(allNibbles);

    // Parse preset name (bytes 28–59, null-terminated)
    let patchName = '';
    for (let i = 0; i < 32; i++) {
      const b = decoded[28 + i];
      if (b === 0) break;
      patchName += String.fromCharCode(b);
    }

    // Parse 11 effect blocks (bytes 120–911, each 72 bytes)
    const view = new DataView(decoded.buffer, decoded.byteOffset, decoded.byteLength);
    const effects: GP200Preset['effects'] = [];
    for (let b = 0; b < 11; b++) {
      const base = 120 + b * 72;
      const slotIndex = decoded[base + 4];
      const enabled   = decoded[base + 5] === 1;
      const effectId  = view.getUint32(base + 8, true);
      const params: number[] = [];
      for (let p = 0; p < 15; p++) {
        params.push(view.getFloat32(base + 12 + p * 4, true));
      }
      effects.push({ slotIndex, enabled, effectId, params });
    }

    return GP200PresetSchema.parse({ version: '1', patchName, effects, checksum: 0 });
  },
};
