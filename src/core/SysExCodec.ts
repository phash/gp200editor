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
};
