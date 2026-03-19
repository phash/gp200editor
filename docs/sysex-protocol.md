# Valeton GP-200 SysEx Protocol

**Status:** Fully reverse-engineered (2026-03-18)
**Sources:**
- USB MIDI captures via tshark/usbmon (own device, Wine + Windows VM)
- Targeted capture: `/home/manuel/gp200-capture-targeted.pcap` (1.3 MB, 4370 frames, all 256 presets)
- Write capture (Linux): `/home/manuel/gp200-capture-windows.pcap` (22 KB, slot 9 "Pretender" write)
- **Write capture (Windows, 2026-03-18):** `scripts/gp200-capture-20260318-231056.pcap` (1.9 MB, slot 9 "American Idiot" full write — confirmed 7-chunk/1184B write format)
- .prst files from device: `prst/63-B American Idiot.prst`, `prst/63-C claude1.prst`, `prst/63-D It's GP-200.prst`
- Reddit thread by `dvanverseveld` on `/r/ValetonGP2OO` — GP-200LT (same header/protocol)
- GP-5 BLE controller repo `helvecioneto/gp5-wc` (different transport, same Valeton command concepts)

---

## 1. SysEx Header

All SysEx messages share the same 8-byte header:

```
F0  21  25  7E  47  50  2D  32
│   │   │   │   └──────────────── "GP-2" (ASCII)
│   │   │   └───────────────────── ~ (0x7E separator)
│   │   └───────────────────────── 0x25 (sub-ID)
│   └───────────────────────────── 0x21 (Valeton manufacturer ID)
└───────────────────────────────── SysEx start
```

Full message structure:
```
F0 21 25 7E 47 50 2D 32  [CMD]  [PAYLOAD...]  F7
```

---

## 2. CMD Byte (byte 8)

| CMD  | Direction      | Meaning                            |
|------|----------------|------------------------------------|
| 0x11 | host → device  | REQUEST — query current state/data |
| 0x12 | host → device  | SET — write state/data to device   |
| 0x12 | device → host  | RESPONSE — device reply to request |

Note: Both SET and RESPONSE use CMD=0x12. USB endpoint direction disambiguates.

---

## 3. Data Encoding: Nibble Encoding

All preset payload data (both read sub=0x18 and write sub=0x20) uses **nibble encoding**:

- Every raw SysEx byte holds only 4 bits (values 0x00–0x0F)
- Two consecutive nibble-bytes form one decoded byte:

```
decoded[i] = (raw[2i] << 4) | raw[2i+1]
```

Example: nibble bytes `05 09` → decoded byte `0x59`.

This is NOT the same as Roland 7-bit MIDI encoding.

---

## 4. Sub-Commands (byte 9)

### 4.1 Toggle FX Block (CMD=0x12, sub=0x10, 46 bytes)

Turn an effect block on or off:

```
F0 21 25 7E 47 50 2D 32  12  10  [20B context]  [BLOCK:1B]  00  [STATE:1B]  [3B]  F7
                                                 ^38              ^40
```

**Block IDs (byte 38):**

| ID   | Module                          |
|------|---------------------------------|
| 0x00 | PRE (Pre-amp / compressor / EQ) |
| 0x01 | WAH                             |
| 0x02 | BOOST                           |
| 0x03 | AMP                             |
| 0x04 | NR (Noise Reduction)            |
| 0x05 | CAB                             |
| 0x06 | EQ                              |
| 0x07 | MOD                             |
| 0x08 | DLY (Delay)                     |
| 0x09 | RVB (Reverb)                    |
| 0x0A | VOL (Volume)                    |

**State (byte 40):** `0x00` = bypass/off, `0x01` = active/on

**Examples:**
```
# Turn Amp ON:
F0 21 25 7E 47 50 2D 32  12 10  00 00 00 00 00 00 00 00 04 00 00 00 00 00 00 01 01 00 00 01 05 00 00 00 04 00 00 00  03  00  01  0C 0F 00 02  F7
#                                                                                                                    ^AMP    ^ON

# Turn Amp OFF:
F0 21 25 7E 47 50 2D 32  12 10  00 00 00 00 00 00 00 00 04 00 00 00 00 00 00 01 01 00 00 01 05 00 00 00 04 00 00 00  03  00  00  0C 0F 00 02  F7
#                                                                                                                    ^AMP    ^OFF
```

### 4.2 Query FX Block State (CMD=0x11, sub=0x10)

Same 46-byte structure as toggle, CMD=0x11, byte 40 = 0x00 (don't care). Device responds with CMD=0x12, sub=0x08.

```
# Query Boost state:
F0 21 25 7E 47 50 2D 32  11 10  00 00 00 00 00 00 00 00 04 00 00 00 00 00 00 00 00 00 00 01 05 00 00 00 04 00 00 00  02  00  00  0C 0F 00 02  F7
```

**State response (CMD=0x12, sub=0x08, 31 bytes):**
```
# Boost ON:   F0 21 25 7E 47 50 2D 32  12 08  ... 02 00 00  01  03 0F 08 00  F7  (01=ON)
# Boost OFF:  F0 21 25 7E 47 50 2D 32  12 08  ... 02 00 00  00  03 0F 08 00  F7  (00=OFF)
```

### 4.3 Change Preset (CMD=0x12, sub=0x08, 30 bytes)

Switch active preset. Preset number (0-based) at byte 26:

```
F0 21 25 7E 47 50 2D 32  12 08  00 00 00 00 08 01 00 00 04 00 00 00 00 00 00 00  [PRESET:1B]  00 00  F7
                                                                                 ^26

# Switch to preset 0:  ...  00  00 00  F7
# Switch to preset 1:  ...  01  00 00  F7
```

### 4.4 Request Full Preset Data (CMD=0x11, sub=0x10, 46 bytes)

Request all effect data for a preset slot. Slot number at bytes 16, 29, and 33 (0-based):

```
# Preset slot 0:
F0 21 25 7E 47 50 2D 32  11 10  00 00 00 00 00 00 00 00 04 00 00 00 01 00 00 00  00  00 00 00 01 00 00 00 04 00 00 00  00  00 00 00  00  00 00  F7
#                                                                                ^16                                  ^29          ^33

# Preset slot 1:
F0 21 25 7E 47 50 2D 32  11 10  00 00 00 00 00 00 00 00 04 00 00 00 01 00 00 00  01  00 00 00 01 00 00 00 04 00 00 00  01  00 00 00  01  00 00  F7
```

Device responds with 7 sub=0x18 chunks (see §4.5).

### 4.5 Preset Data Response (CMD=0x12, sub=0x18, device→host)

Device sends **7 chunks** per preset in response to a sub=0x10 request:

```
F0 21 25 7E 47 50 2D 32  12  18  [SLOT:1B]  [OFFSET:2B LE]  [NIBBLE_DATA...]  F7
                                 ^payload[1]  ^payload[2:4]   ^payload[4:]
```

| Chunk | Offset  | Nibble bytes | Decoded bytes |
|-------|---------|-------------|---------------|
| 1     | 0       | 370         | 185           |
| 2     | 313     | 370         | 185           |
| 3     | 626     | 370         | 185           |
| 4     | 1067    | 370         | 185           |
| 5     | 1380    | 370         | 185           |
| 6     | 1821    | 370         | 185           |
| 7     | 2134    | 132         | 66            |

Total: **2352 nibble bytes** → **1176 decoded bytes** per preset.

**Assembly:** Concatenate all 7 chunks' `payload[4:]` in chunk order, then nibble-decode.

### 4.6 Preset Chunk Write (CMD=0x12, sub=0x20, host→device)

Write a preset in **7 chunks** (confirmed via Windows USB capture 2026-03-18):

```
F0 21 25 7E 47 50 2D 32  12  20  [SLOT:1B]  [OFFSET:2B LE]  [NIBBLE_DATA...]  F7
```

| Chunk | Offset | Nibble bytes | Notes                              |
|-------|--------|--------------|------------------------------------|
| 1     | 0      | 366          | Write header + metadata + name     |
| 2     | 311    | 366          | Author/URL + routing + blocks 0–1  |
| 3     | 622    | 366          | Effect blocks 2–4                  |
| 4     | 1061   | 366          | Effect blocks 5–7                  |
| 5     | 1372   | 366          | Effect blocks 8–10                 |
| 6     | 1811   | 366          | Controller/pedal assignments       |
| 7     | 2122   | 172          | Remaining assignments              |

Total: **2368 nibble bytes** → **1184 decoded bytes** per preset.

**All 11 effect blocks** and controller/pedal data are sent (previous docs incorrectly stated only blocks 0–8 partial were sent — this was based on older firmware/captures).

The offset field in chunk headers is metadata for the device's reassembly, NOT a position in the nibble stream. Chunks must be concatenated in order.

**Assembly:** Concatenate all 7 chunks' `payload[4:]` in chunk order, then nibble-decode.

### 4.7 Initial State Dump (CMD=0x12, sub=0x4E, device→host)

On device connect, device sends several sub=0x4E messages (same chunk format as sub=0x18).
Contains current active preset state.

---

## 5. Decoded Preset Format (READ, 1176 bytes)

After nibble-decoding the 7 sub=0x18 chunks, you get **1176 bytes**:

### 5.1 Header (bytes 0–27, 28 bytes)

| Offset | Size | Value          | Notes                          |
|--------|------|----------------|--------------------------------|
| 0      | 4    | `00 00 04 00`  | Constant                       |
| 4      | 2    | `01 00`        | Constant (LE16 = 1)            |
| 6      | 2    | `NN 00`        | **Slot number** (LE16, 0-based)|
| 8      | 2    | `02 00`        | Constant (LE16 = 2)            |
| 10     | 2    | `58 00`        | Constant (LE16 = 88)           |
| 12     | 2    | `NN 00`        | Slot number repeated           |
| 14     | 2    | Variable       | Tempo BPM or similar metadata  |
| 16     | 12   | Variable       | Other preset metadata          |

### 5.2 Preset Name (bytes 28–59, 32 bytes)

Null-terminated ASCII, up to 31 characters + null.

### 5.3 Middle Section (bytes 60–119, 60 bytes)

| Offset | Size | Value          | Notes                          |
|--------|------|----------------|--------------------------------|
| 60     | 40   | zeros          | Padding                        |
| 100    | 2    | `08 00`        | Constant                       |
| 102    | 2    | `10 00`        | Constant                       |
| 104    | 2    | Slot number    | LE16, 0-based                  |
| 106    | 2    | `04 04`        | Constant                       |
| 108    | 11   | Block order    | Signal chain routing (see §5.4)|
| 119    | 1    | `00`           | Terminator                     |

### 5.4 Block Routing Order (bytes 108–118, 11 bytes)

The 11 block IDs in **signal chain order** (PRE=0x00 … VOL=0x0A):

- Default order: `00 01 02 04 03 05 06 07 08 09 0A`
  = PRE → WAH → BOOST → NR → AMP → CAB → EQ → MOD → DLY → RVB → VOL
- Can vary per preset (e.g., VOL first, different NR/AMP order)

### 5.5 Effect Blocks (bytes 120–911, 11 × 72 = 792 bytes)

**11 blocks, each 72 bytes, starting at offset 120.**
Identical structure to `.prst` file effect blocks (same marker, layout, params):

```
+0   4B   14 00 44 00   Block marker (constant)
+4   1B   [0–10]        Slot index
+5   1B   [0 or 1]      Active flag: 0=bypass, 1=active
+6   2B   00 0F         Constant
+8   4B   LE uint32     Effect ID (high byte = module type)
+12  60B  15× float32   Parameters (LE)
```

**Effect ID high byte → module type:**

| High byte | Module | Example effects              |
|-----------|--------|------------------------------|
| 0x00      | PRE/NR | Compressor, Noise Gate       |
| 0x01      | PRE/EQ | Guitar EQ, AC Sim            |
| 0x03      | DST    | Green OD, Scream, Force      |
| 0x04      | MOD    | Chorus, Flanger, Phaser      |
| 0x05      | WAH    | V-Wah, C-Wah                 |
| 0x06      | VOL    | Volume                       |
| 0x07      | AMP    | UK 800, Mess DualV           |
| 0x08      | AMP    | AC Pre, Mini Bass            |
| 0x0A      | CAB    | UK GRN 2, EV, User IR        |
| 0x0B      | DLY    | Pure, Analog, Tape           |
| 0x0C      | RVB    | Room, Hall, Shimmer          |

Blocks are stored in **slot-index order** (slot 0 = PRE first, slot 10 = VOL last),
regardless of the routing order in §5.4.

### 5.6 Trailing Data (bytes 912–1175, 264 bytes)

Controller assignments and pedal mappings. Pattern: 16-byte records starting with `0C 00 0C 00`.
Appears constant across presets (not preset-specific data).

---

## 6. Write Format (1184 bytes)

Write payload is nibble-decoded from 7 sub=0x20 chunks. Confirmed via Windows USB capture 2026-03-18.

**Relationship to .prst file:** The write payload is the .prst PARM data (bytes 48–1219) with a different 16-byte header prepended instead of the 48-byte TSRP/MRAP header. The effect block data, routing, and controller assignments are identical.

### 6.1 Write Header (bytes 0–15, 16 bytes)

```
00 00 04 00 01 00 [SLOT:2B LE] 01 00 04 00 [SLOT:2B LE] [SLOT:2B LE]
```

| Offset | Size | Value            | Notes                  |
|--------|------|------------------|------------------------|
| 0–1    | 2    | `00 00`          | Padding                |
| 2–3    | 2    | `04 00`          | Constant (LE16 = 4)    |
| 4–5    | 2    | `01 00`          | Constant (LE16 = 1)    |
| 6–7    | 2    | `NN 00`          | **Slot number** (LE16) |
| 8–9    | 2    | `01 00`          | Constant (LE16 = 1)    |
| 10–11  | 2    | `04 00`          | Constant (LE16 = 4)    |
| 12–13  | 2    | `NN 00`          | Slot repeated          |
| 14–15  | 2    | `NN 00`          | Slot repeated          |

### 6.2 Pre-Name Metadata (bytes 16–35, 20 bytes)

```
02 00  58 00  [SLOT:2B LE]  78 00  [VAR:2B]  00 00  [VAR:2B]  00 00 00 00 00 00
```

Constants: `02 00` at [16], `58 00` at [18], `78 00` at [22]. Slot at [20]. Other fields may encode category/subcategory metadata.

### 6.3 Name + Author + URL (bytes 36–107, 72 bytes)

| Offset | Size | Content                        |
|--------|------|--------------------------------|
| 36–51  | 16   | Preset name (null-terminated)  |
| 52–67  | 16   | Author name (null-terminated)  |
| 68–103 | 36   | URL (null-terminated)          |
| 104–107| 4    | Padding (zeros)                |

Author and URL are metadata from the Valeton PC editor; Web MIDI writes leave these as zeros.

### 6.4 Routing Section (bytes 108–127, 20 bytes)

Same structure as read format bytes 100–119:

| Offset | Size | Value               | Notes                     |
|--------|------|---------------------|---------------------------|
| 108–109| 2    | `08 00`             | Constant                  |
| 110–111| 2    | `10 00`             | Constant                  |
| 112–113| 2    | Slot reference      | LE16                      |
| 114–115| 2    | `04 04`             | Constant                  |
| 116–126| 11   | Block routing order | Signal chain (§5.4)       |
| 127    | 1    | `00`                | Terminator                |

### 6.5 Effect Blocks (bytes 128–919, 11 × 72 = 792 bytes)

**All 11 blocks** are sent, identical structure to read format (§5.5). Blocks 9 (RVB) and 10 (VOL) ARE included.

### 6.6 Controller/Pedal Assignments (bytes 920–1183, 264 bytes)

Three record types:

| Prefix         | Size | Count | Description                |
|----------------|------|-------|----------------------------|
| `0C 00 0C 00`  | 16B  | 9     | Expression pedal assigns   |
| `10 00 04 00`  | 8B   | 3     | Footswitch assignments     |
| `0F 00 08 00`  | 12B  | 8     | Parameter assignments      |

---

## 7. Device Capacity

- **256 preset slots** (0-based, 0–255)
- Slots 0–248: user presets
- Slots 249–255: factory defaults ("It's GP-200")
- Device always responds to all 256 slot read requests

---

## 8. USB MIDI Transport

MIDI bytes are wrapped in USB MIDI Event Packets (4 bytes each, per USB MIDI 1.0 spec):

| CIN  | Meaning              | MIDI bytes |
|------|----------------------|------------|
| 0x04 | SysEx start/continue | 3 bytes    |
| 0x05 | SysEx end (1 byte)   | 1 byte     |
| 0x06 | SysEx end (2 bytes)  | 2 bytes    |
| 0x07 | SysEx end (3 bytes)  | 3 bytes    |

---

## 9. Read All Presets — Full Protocol Sequence

The Windows Valeton editor reads all 256 presets on connect:

1. **Handshake** (CMD=0x12, sub=0x08, ~20 bytes)
2. **Device capabilities** (CMD=0x12, sub=0x4E, same chunk format as sub=0x18)
3. For each slot 0–255:
   - Host sends `CMD=0x11, sub=0x10` with slot number at bytes 16, 29, 33
   - Device responds with 7 `CMD=0x12, sub=0x18` chunks → 1176 bytes per preset

---

## 10. Implementation (Web MIDI API)

```javascript
const HEADER = [0xF0, 0x21, 0x25, 0x7E, 0x47, 0x50, 0x2D, 0x32];

// Access MIDI with SysEx permission
const access = await navigator.requestMIDIAccess({ sysex: true });
const output = [...access.outputs.values()].find(p => p.name.includes('GP-200'));
const input  = [...access.inputs.values()].find(p => p.name.includes('GP-200'));

// Toggle an effect block on/off
function toggleEffect(blockId, enabled) {
  output.send([
    ...HEADER, 0x12, 0x10,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01,
    0x01, 0x00, 0x00, 0x01, 0x05, 0x00, 0x00, 0x00,
    0x04, 0x00, 0x00, 0x00,
    blockId,                    // byte 38
    0x00,
    enabled ? 0x01 : 0x00,      // byte 40
    0x0C, 0x0F, 0x00, 0x02,
    0xF7,
  ]);
}

// Request full preset data for slot N
function requestPreset(slotN) {
  const n = slotN & 0xFF;
  output.send([
    ...HEADER, 0x11, 0x10,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x04, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00,
    n,                          // byte 16: slot
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00,
    n,                          // byte 29: slot (repeated)
    0x00, 0x00, 0x00,
    n,                          // byte 33: slot (repeated)
    0x00, 0x00,
    0xF7,
  ]);
}

// Nibble-decode: raw[0..2N-1] → decoded[0..N-1]
function nibbleDecode(raw) {
  const out = new Uint8Array(Math.floor(raw.length / 2));
  for (let i = 0; i < out.length; i++) {
    out[i] = (raw[2*i] << 4) | raw[2*i+1];
  }
  return out;
}

// Nibble-encode: decoded[0..N-1] → raw[0..2N-1]
function nibbleEncode(decoded) {
  const out = new Uint8Array(decoded.length * 2);
  for (let i = 0; i < decoded.length; i++) {
    out[2*i]   = (decoded[i] >> 4) & 0x0F;
    out[2*i+1] = decoded[i] & 0x0F;
  }
  return out;
}

// Parse 1176-byte decoded preset data
function parsePreset(decoded) {
  const slotNum = decoded[6] | (decoded[7] << 8);
  const name = new TextDecoder().decode(
    decoded.slice(28, 60).subarray(0, decoded.slice(28).indexOf(0))
  );
  const effects = [];
  for (let i = 0; i < 11; i++) {
    const base = 120 + i * 72;
    const slotIdx = decoded[base + 4];
    const active  = decoded[base + 5] === 1;
    const effectId = new DataView(decoded.buffer).getUint32(base + 8, true);
    const params = [];
    for (let p = 0; p < 15; p++) {
      params.push(new DataView(decoded.buffer).getFloat32(base + 12 + p * 4, true));
    }
    effects.push({ slotIdx, active, effectId, params });
  }
  return { slotNum, name, effects };
}
```

---

## 11. .prst Checksum Algorithm (SOLVED 2026-03-18)

**Algorithm:** Simple byte sum, stored as big-endian uint16.

```
checksum = sum(file_bytes[0 .. 0x4C5]) & 0xFFFF
stored as BE16 at file_bytes[0x4C6 .. 0x4C7]
```

Verified against 5 real .prst files exported from GP-200 firmware v1.1.0.

Note: the `.prst` file also has a 4-byte footer at [0x4C0:0x4C4] containing the data-end offset as LE32 (always 0x04C0 = 1216), followed by 2 bytes padding, then the checksum.

---

## 12. .prst ↔ SysEx Format Mapping

| Component         | .prst offset | SysEx Write offset | Size   |
|-------------------|--------------|--------------------|--------|
| File header       | 0–47         | —                  | 48B    |
| Write header      | —            | 0–15               | 16B    |
| Pre-name metadata | 48–67        | 16–35              | 20B    |
| Name + Author     | 68–99        | 36–67              | 32B    |
| URL + padding     | 100–139      | 68–107             | 40B    |
| Routing section   | 140–159      | 108–127            | 20B    |
| 11 effect blocks  | 160–951      | 128–919            | 792B   |
| Controller/pedal  | 952–1219     | 920–1183           | 264B   |
| Footer+checksum   | 1220–1223    | —                  | 4B     |

Conversion: `.prst[48:]` ≈ `SysEx[16:]` — the payload data is identical except for:
- Slot number field at pre-name metadata offset 4 (may differ between export and write)

---

## 13. Known Unknowns

- [ ] Header bytes [14:28] in read format: exact semantics (BPM? Scene metadata?)
- [ ] Pre-name metadata bytes [24:36]: category/subcategory fields
- [ ] Full handshake/capabilities sequence on device connect
- [ ] Read protocol on Windows: Valeton editor uses `change_preset` + unknown mechanism (no sub=0x18 chunks observed in USB capture — may use HID or cached data)
- [x] ~~Checksum algorithm in `.prst` binary format~~ → §11
- [x] ~~Write header format~~ → §6.1
- [x] ~~Why write omits blocks 9–10~~ → It doesn't; full 11-block write confirmed

---

## 12. Related Resources

- GP-5 BLE SysEx (different transport): `helvecioneto/gp5-wc` → `src/lib/ble_sysex.json`
- GP-5 SysEx reference doc: https://www.scribd.com/document/963614194/GP-5-SysEx-1
- Capture scripts: `scripts/analyze-sysex.py`, `scripts/capture-windows.ps1`
- Captures (Linux): `/home/manuel/gp200-capture-windows.pcap` (write, 22KB), `/home/manuel/gp200-capture-targeted.pcap` (read all 256 slots, 1.3MB)
- Captures (Windows): `scripts/gp200-capture-20260318-*.pcap` (write + toggle FX, 2026-03-18)
