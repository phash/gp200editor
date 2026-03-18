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

  buildWriteChunks(preset: GP200Preset, slot: number): Uint8Array[] {
    const SYSEX_HEADER = [0xF0, 0x21, 0x25, 0x7E, 0x47, 0x50, 0x2D, 0x32, 0x12, 0x20];

    // Build 732-byte decoded write payload
    const payload = new Uint8Array(732).fill(0);
    const view = new DataView(payload.buffer);

    // Write header (36 bytes) — constant template with slot at [8:10]
    const WRITE_HEADER = [
      0x00, 0x00, 0x04, 0x00, 0x01, 0x00, // bytes 0–5
      0x27, 0x00,                          // bytes 6–7 (0x27 marker)
      slot & 0xFF, 0x00,                   // bytes 8–9 (slot LE16)
      0x04, 0x00,                          // bytes 10–11
      0x27, 0x00,                          // bytes 12–13 (0x27 marker)
      0x27, 0x00,                          // bytes 14–15 (0x27 marker)
      0x00, 0x00, 0x00, 0x00,              // bytes 16–19
      0x27, 0x00,                          // bytes 20–21 (0x27 marker)
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // bytes 22–35
    ];
    WRITE_HEADER.forEach((b, i) => { payload[i] = b; });

    // Preset name at bytes 36–67 (null-terminated, 32 bytes)
    for (let i = 0; i < 32; i++) {
      payload[36 + i] = i < preset.patchName.length ? preset.patchName.charCodeAt(i) : 0;
    }

    // Effect blocks 0–7 complete at bytes 128–703 (8 × 72 = 576 bytes)
    for (let b = 0; b < 8; b++) {
      const base = 128 + b * 72;
      const slot_e = preset.effects[b];
      if (!slot_e) continue;
      payload[base + 0] = 0x14; payload[base + 1] = 0x00;
      payload[base + 2] = 0x44; payload[base + 3] = 0x00;
      payload[base + 4] = slot_e.slotIndex;
      payload[base + 5] = slot_e.enabled ? 1 : 0;
      payload[base + 6] = 0x00; payload[base + 7] = 0x0F;
      view.setUint32(base + 8, slot_e.effectId, true);
      for (let p = 0; p < 15; p++) {
        view.setFloat32(base + 12 + p * 4, slot_e.params[p] ?? 0, true);
      }
    }

    // Block 8 partial at bytes 704–731 (28 bytes: header + slotIdx + active + const + effectId + 4 params)
    const blk8 = preset.effects[8];
    if (blk8) {
      payload[704] = 0x14; payload[705] = 0x00; payload[706] = 0x44; payload[707] = 0x00;
      payload[708] = blk8.slotIndex;
      payload[709] = blk8.enabled ? 1 : 0;
      payload[710] = 0x00; payload[711] = 0x0F;
      view.setUint32(712, blk8.effectId, true);
      for (let p = 0; p < 4; p++) {
        view.setFloat32(716 + p * 4, blk8.params[p] ?? 0, true);
      }
    }

    // Nibble-encode and split into 4 chunks
    const nibble = this.nibbleEncode(payload); // 1464 bytes
    // Chunk decoded offsets (start of each chunk in decoded bytes, plus end)
    const decodedOffsets = [0, 183, 366, 549, 732];
    // Note: spec lists write offsets as [0, 311, 622, 1061] but those exceed
    // the 732-byte decoded payload. Using equal 183-byte chunks instead.
    // Validate against real device on first hardware test.
    const CHUNK_OFFSETS  = [0, 183, 366, 549]; // values placed in chunk headers
    const chunks: Uint8Array[] = [];
    for (let i = 0; i < 4; i++) {
      const nibbleStart = decodedOffsets[i] * 2;
      const nibbleEnd   = decodedOffsets[i + 1] * 2;
      const nibbleData  = nibble.slice(nibbleStart, nibbleEnd);
      const offLo = CHUNK_OFFSETS[i] & 0xFF;
      const offHi = (CHUNK_OFFSETS[i] >> 8) & 0xFF;

      // Build chunk bytes: header + slot + offsets + nibble data + end
      const chunkBytes: number[] = [];
      chunkBytes.push(...SYSEX_HEADER);
      chunkBytes.push(slot & 0xFF);
      chunkBytes.push(offLo);
      chunkBytes.push(offHi);
      chunkBytes.push(...Array.from(nibbleData));
      chunkBytes.push(0xF7);
      chunks.push(new Uint8Array(chunkBytes));
    }
    return chunks;
  },
};
