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
    // CMD=0x11, sub=0x10, 46 bytes — corrected from USB capture 2026-03-19
    // Slot nibble-encoded (high first) at positions [25-26], [37-38], [41-42]
    const sh = (slot >> 4) & 0x0F;
    const sl = slot & 0x0F;
    return new Uint8Array([
      0xF0, 0x21, 0x25, 0x7E, 0x47, 0x50, 0x2D, 0x32,  // [0-7]   header
      0x11, 0x10,                                        // [8-9]   CMD, sub
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,  // [10-17] padding
      0x04, 0x00, 0x00, 0x00,                            // [18-21] constant
      0x01, 0x00,                                        // [22-23] constant
      0x00,                                              // [24]    padding
      sh, sl,                                            // [25-26] slot nibble
      0x00, 0x00, 0x00,                                  // [27-29] padding
      0x01, 0x00,                                        // [30-31] constant
      0x00, 0x00,                                        // [32-33] padding
      0x04, 0x00, 0x00,                                  // [34-36] constant (3 bytes)
      sh, sl,                                            // [37-38] slot nibble
      0x00, 0x00,                                        // [39-40] padding
      sh, sl,                                            // [41-42] slot nibble
      0x00, 0x00,                                        // [43-44] padding
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

  /** Shared: assemble sorted chunks → nibble-decoded bytes */
  assembleChunks(chunks: Uint8Array[]): Uint8Array {
    const sorted = [...chunks].sort((a, b) => {
      const offA = a[11] | (a[12] << 8);
      const offB = b[11] | (b[12] << 8);
      return offA - offB;
    });
    const nibbleParts = sorted.map(msg => msg.slice(13, msg.length - 1));
    const totalLen = nibbleParts.reduce((s, p) => s + p.length, 0);
    const allNibbles = new Uint8Array(totalLen);
    let pos = 0;
    for (const part of nibbleParts) {
      allNibbles.set(part, pos);
      pos += part.length;
    }
    return this.nibbleDecode(allNibbles);
  },

  /** Parse preset data from decoded bytes (shared by parseReadChunks and parseStateDump) */
  parsePresetFromDecoded(decoded: Uint8Array, fallbackName?: string): GP200Preset {
    let patchName = '';
    if (decoded.length > 59) {
      for (let i = 0; i < 32; i++) {
        const b = decoded[28 + i];
        if (b === 0) break;
        patchName += String.fromCharCode(b);
      }
    }
    if (!patchName && fallbackName) patchName = fallbackName;

    const effects: GP200Preset['effects'] = [];
    const view = new DataView(decoded.buffer, decoded.byteOffset, decoded.byteLength);
    for (let b = 0; b < 11; b++) {
      const base = 120 + b * 72;
      if (base + 72 > decoded.length) {
        effects.push({ slotIndex: b, enabled: false, effectId: 0, params: new Array(15).fill(0) });
        continue;
      }
      const slotIndex = decoded[base + 4];
      const enabled = decoded[base + 5] === 1;
      const effectId = view.getUint32(base + 8, true);
      const params: number[] = [];
      for (let p = 0; p < 15; p++) {
        params.push(view.getFloat32(base + 12 + p * 4, true));
      }
      effects.push({ slotIndex, enabled, effectId, params });
    }

    return GP200PresetSchema.parse({ version: '1', patchName, effects, checksum: 0 });
  },

  parseReadChunks(chunks: Uint8Array[]): GP200Preset {
    const decoded = this.assembleChunks(chunks);
    return this.parsePresetFromDecoded(decoded);
  },

  buildWriteChunks(preset: GP200Preset, slot: number): Uint8Array[] {
    const SYSEX_HEADER = [0xF0, 0x21, 0x25, 0x7E, 0x47, 0x50, 0x2D, 0x32, 0x12, 0x20];

    // Build 1184-byte decoded write payload (confirmed via Windows USB capture 2026-03-18)
    // Layout: [0:16] write header, [16:36] pre-name metadata, [36:68] name+author,
    //         [68:104] URL, [104:108] padding, [108:128] routing section,
    //         [128:920] 11×72B effect blocks, [920:1184] controller/pedal assignments
    const payload = new Uint8Array(1184).fill(0);
    const view = new DataView(payload.buffer);

    // [0:16] Write header — constants + slot number at 3 positions
    payload.set([0x00, 0x00, 0x04, 0x00, 0x01, 0x00], 0);
    view.setUint16(6, slot, true);   // slot LE16
    payload.set([0x01, 0x00, 0x04, 0x00], 8);
    view.setUint16(12, slot, true);  // slot repeated
    view.setUint16(14, slot, true);  // slot repeated

    // [16:36] Pre-name metadata (20 bytes)
    payload.set([0x02, 0x00, 0x58, 0x00], 16);
    view.setUint16(20, slot, true);  // slot in metadata
    payload.set([0x78, 0x00], 22);   // constant

    // [36:68] Preset name (32 bytes, null-terminated)
    for (let i = 0; i < 32; i++) {
      payload[36 + i] = i < preset.patchName.length ? preset.patchName.charCodeAt(i) : 0;
    }

    // [68:104] URL area — zeros (web editor doesn't set author/URL)
    // [104:108] padding — zeros

    // [108:128] Routing section
    payload.set([0x08, 0x00, 0x10, 0x00], 108);
    view.setUint16(112, slot, true); // slot reference
    payload.set([0x04, 0x04], 114);  // constant
    // Default routing order: PRE→WAH→BOOST→AMP→NR→CAB→EQ→MOD→DLY→RVB→VOL
    for (let i = 0; i < 11; i++) {
      payload[116 + i] = i;
    }
    // [127] = 0x00 terminator (already zero)

    // [128:920] All 11 effect blocks (11 × 72 = 792 bytes)
    for (let b = 0; b < 11; b++) {
      const base = 128 + b * 72;
      const eff = preset.effects[b];
      if (!eff) continue;
      payload[base] = 0x14; payload[base + 1] = 0x00;
      payload[base + 2] = 0x44; payload[base + 3] = 0x00;
      payload[base + 4] = eff.slotIndex;
      payload[base + 5] = eff.enabled ? 1 : 0;
      payload[base + 6] = 0x00; payload[base + 7] = 0x0F;
      view.setUint32(base + 8, eff.effectId, true);
      for (let p = 0; p < 15; p++) {
        view.setFloat32(base + 12 + p * 4, eff.params[p] ?? 0, true);
      }
    }

    // [920:1184] Controller/pedal assignments — zeros (not yet mapped in GP200Preset)

    // Nibble-encode → 2368 nibble bytes, split into 7 chunks
    const nibble = this.nibbleEncode(payload);
    // Chunk sizes: 6 × 366 + 1 × 172 = 2368 nibble bytes
    // Offsets: values placed in chunk headers (from USB capture, NOT nibble positions)
    const CHUNK_NIBBLE_SIZES = [366, 366, 366, 366, 366, 366, 172];
    const CHUNK_OFFSETS      = [0, 311, 622, 1061, 1372, 1811, 2122];

    const chunks: Uint8Array[] = [];
    let nibblePos = 0;
    for (let i = 0; i < 7; i++) {
      const nibbleData = nibble.slice(nibblePos, nibblePos + CHUNK_NIBBLE_SIZES[i]);
      nibblePos += CHUNK_NIBBLE_SIZES[i];
      const offLo = CHUNK_OFFSETS[i] & 0xFF;
      const offHi = (CHUNK_OFFSETS[i] >> 8) & 0xFF;

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

  buildIdentityQuery(): Uint8Array {
    return new Uint8Array([
      0xF0, 0x21, 0x25, 0x7E, 0x47, 0x50, 0x2D, 0x32,
      0x11, 0x04,
      0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00,
      0xF7,
    ]);
  },

  buildEnterEditorMode(): Uint8Array {
    return new Uint8Array([
      0xF0, 0x21, 0x25, 0x7E, 0x47, 0x50, 0x2D, 0x32,
      0x11, 0x12,
      0x00, 0x00, 0x00,
      0xF7,
    ]);
  },

  buildStateDumpRequest(): Uint8Array {
    return new Uint8Array([
      0xF0, 0x21, 0x25, 0x7E, 0x47, 0x50, 0x2D, 0x32,
      0x11, 0x04,
      0x00, 0x00, 0x00, 0x00, 0x06, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00,
      0xF7,
    ]);
  },

  buildVersionCheck(): Uint8Array {
    return new Uint8Array([
      0xF0, 0x21, 0x25, 0x7E, 0x47, 0x50, 0x2D, 0x32,
      0x11, 0x0A,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x06, 0x00, 0x00,
      0x0D, 0x04, 0x0F, 0x07, 0x08, 0x0B, 0x00, 0x00, 0x0C, 0x0B, 0x04, 0x05,
      0xF7,
    ]);
  },

  buildAssignmentQuery(section: number, page: number, block: number): Uint8Array {
    const SEC0_HDR = [0x00, 0x00, 0x00, 0x00, 0x09, 0x01, 0x00, 0x01, 0x08];
    const SEC1_HDR = [0x00, 0x00, 0x00, 0x01, 0x02, 0x01, 0x00, 0x01, 0x08];
    const header = section === 1 ? SEC1_HDR : SEC0_HDR;
    // REF_DATA: bytes [26-68] from capture (msg #12, section 0/page 0/block 0)
    const REF_DATA = [
      0x01, 0x00, 0x00,
      0x0C, 0x0E, 0x07, 0x03, 0x0B, 0x02, 0x00, 0x00,
      0x07, 0x02, 0x04, 0x0F, 0x06, 0x05, 0x00, 0x09,
      0x00, 0x0C, 0x0F, 0x0E, 0x0D, 0x0A, 0x00, 0x0B,
      0x09, 0x08, 0x07, 0x05, 0x0E, 0x08, 0x00, 0x02,
      0x00, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    ];
    return new Uint8Array([
      0xF0, 0x21, 0x25, 0x7E, 0x47, 0x50, 0x2D, 0x32,
      0x11, 0x1C,
      ...header,
      0x00, 0x00,
      page & 0xFF,
      block & 0x0F,
      0x00, 0x00, 0x00,
      ...REF_DATA,
      0xF7,
    ]);
  },

  parseIdentityResponse(msg: Uint8Array): { deviceType: number; firmwareValues: number[] } {
    return {
      deviceType: msg[18],
      firmwareValues: [msg[22], msg[26]],
    };
  },

  parseVersionResponse(msg: Uint8Array): { accepted: boolean } {
    for (let i = 21; i <= 32; i++) {
      if (msg[i] !== 0) return { accepted: false };
    }
    return { accepted: true };
  },

  parseAssignmentResponse(msg: Uint8Array, section: number, page: number): { section: number; page: number; block: number; name: string; rawData: Uint8Array } {
    const block = msg[22];
    const nibbleData = msg.slice(27, msg.length - 1);
    const decoded = this.nibbleDecode(nibbleData);
    let name = '';
    let nameStart = 0;
    while (nameStart < decoded.length && decoded[nameStart] === 0) nameStart++;
    for (let i = nameStart; i < decoded.length; i++) {
      if (decoded[i] === 0) break;
      name += String.fromCharCode(decoded[i]);
    }
    return { section, page, block, name, rawData: decoded };
  },

  parseStateDump(chunks: Uint8Array[]): { slot: number; preset: GP200Preset } {
    const slot = chunks[0]?.[10] ?? 0;
    const decoded = this.assembleChunks(chunks);
    const fallbackName = this.slotToLabel(slot);
    return { slot, preset: this.parsePresetFromDecoded(decoded, fallbackName) };
  },
};
