# Valeton GP-200 SysEx Protocol Reference

**Status:** Reverse-engineered (2026-03-18/19/20/23)
**Firmware tested:** v1.8.0 (Normal mode, 6-In/4-Out)
**Sources:** USB MIDI captures via tshark/USBPcap (own device), Valeton GP-200 Editor under Wine/Windows, GP-200LT Reddit post, GP-5 BLE controller repo

---

## 1. Message Format

All messages share a common envelope:

```
F0 21 25 7E 47 50 2D 32 [CMD] [SUB] [payload...] F7
|  |     |  |           |     |
|  |     |  "GP-2"      CMD   SUB-command
|  |     0x7E separator
|  Valeton manufacturer ID (0x21 0x25)
SysEx start
```

| Field | Bytes | Description |
|-------|-------|-------------|
| `F0` | 1 | SysEx start |
| `21 25` | 2 | Valeton manufacturer ID |
| `7E` | 1 | Separator |
| `47 50 2D 32` | 4 | Device identifier "GP-2" (ASCII) |
| CMD | 1 | Command type (byte 8) |
| SUB | 1 | Sub-command (byte 9) |
| payload | variable | Command-specific data |
| `F7` | 1 | SysEx end |

---

## 2. CMD Byte (byte 8)

| CMD | Direction | Meaning |
|-----|-----------|---------|
| `0x11` | Host -> Device | **REQUEST** -- query state or data |
| `0x12` | Host -> Device | **SET** -- write state or data |
| `0x12` | Device -> Host | **RESPONSE** -- reply to a request |

Both SET and RESPONSE use CMD=0x12. USB endpoint direction disambiguates.

---

## 3. Nibble Encoding

Preset payload data (sub=0x18, 0x20, 0x38, and parts of 0x10/0x14) uses nibble encoding. Each SysEx data byte carries only 4 bits (0x00-0x0F). Two consecutive nibble bytes form one decoded byte:

```
decoded[i] = (raw[2*i] << 4) | raw[2*i + 1]
```

Example: `05 09` decodes to `0x59`.

This is NOT Roland 7-bit MIDI encoding. Some messages (sub=0x08, 0x10 toggle, 0x14 effect change) use raw bytes instead.

---

## 4. Sub-Command Overview

| SUB | CMD | Dir | Size (bytes) | Encoding | Description |
|-----|-----|-----|-------------|----------|-------------|
| `0x04` | `0x11` | H->D | 22 | raw | Identity Query |
| `0x04` | `0x11` | H->D | 22 | raw | State Dump Request |
| `0x08` | `0x12` | H->D | 30 | raw | Preset Change |
| `0x08` | `0x12` | H->D | 30 | raw | Drum Machine Control |
| `0x08` | `0x12` | D->H | 30 | raw | Identity Response / FX State / ACK |
| `0x0A` | `0x11` | H->D | 34 | raw | Version Check Request |
| `0x0A` | `0x12` | D->H | ~34 | raw | Version Check Response |
| `0x0C` | `0x12` | D->H | 38 | raw | Effect Change Response |
| `0x10` | `0x11` | H->D | 46 | raw | Read Request |
| `0x10` | `0x12` | H->D | 46 | raw | Toggle Effect / Patch Settings |
| `0x10` | `0x12` | D->H | 46 | raw | Toggle Response (device-initiated) |
| `0x12` | `0x11` | H->D | 14 | raw | Enter Editor Mode |
| `0x14` | `0x12` | H->D | 54 | raw | Effect Change / Controller Assignment |
| `0x14` | `0x12` | D->H | 54 | raw | Reorder Response |
| `0x18` | `0x12` | H->D | 62 | nibble | Param Change / Style Name / Save Commit |
| `0x18` | `0x12` | D->H | variable | nibble | Read Response Chunks |
| `0x1C` | `0x11` | H->D | ~70 | raw | Assignment Query |
| `0x1C` | `0x12` | D->H | variable | nibble | Assignment Response / IR Upload |
| `0x20` | `0x11` | H->D | ~46 | raw | Request Preset Name |
| `0x20` | `0x12` | H->D | 78 | nibble | Reorder / Author / Write Chunks |
| `0x38` | `0x12` | H->D | 126 | nibble | Note Text |
| `0x4E` | `0x12` | D->H | variable | nibble | State Dump Response |

---

## 5. Handshake Sequence

When connecting to the GP-200 via Web MIDI, the following sequence is used:

| Step | Direction | Message | Expected Response |
|------|-----------|---------|-------------------|
| 1 | H->D | Identity Query (CMD=0x11, sub=0x04) | Identity Response (CMD=0x12, sub=0x08) |
| 2 | H->D | Enter Editor Mode (CMD=0x11, sub=0x12) | *(wait 100ms, no response expected)* |
| 3 | H->D | State Dump Request (CMD=0x11, sub=0x04) | 5x State Dump chunks (CMD=0x12, sub=0x4E) |
| 4 | H->D | Version Check (CMD=0x11, sub=0x0A) | Version Response (CMD=0x12, sub=0x0A) |
| 5 | H->D | Assignment Queries (CMD=0x11, sub=0x1C) | Assignment Responses (CMD=0x12, sub=0x1C) |
| 6 | H->D | Read Requests for current bank (4 slots) | 7 chunks each (CMD=0x12, sub=0x18) |

After the handshake completes, the connection is ready for live editing.

---

## 6. Message Details

### 6.1 Identity Query (CMD=0x11, sub=0x04)

Request device identification.

```
F0 21 25 7E 47 50 2D 32 11 04 00 00 00 00 01 02 00 00 00 00 00 F7
```

Total: 22 bytes.

### 6.2 Identity Response (CMD=0x12, sub=0x08)

Device responds with identity information. Byte 18 contains device type.

**Note:** Bytes [22] and [26] always show `1.2` regardless of actual firmware version. These are protocol version numbers, not firmware version. Use the Version Check (sub=0x0A) for firmware compatibility.

### 6.3 Enter Editor Mode (CMD=0x11, sub=0x12)

Puts the device into editor mode.

```
F0 21 25 7E 47 50 2D 32 11 12 00 00 00 F7
```

Total: 14 bytes. No response expected; wait ~100ms before proceeding.

### 6.4 State Dump Request (CMD=0x11, sub=0x04)

Request current device state (different payload from Identity Query).

```
F0 21 25 7E 47 50 2D 32 11 04 00 00 00 00 06 01 00 00 00 00 00 F7
```

Total: 22 bytes. Distinguished from Identity Query by byte[14] = `0x06` (vs `0x01`).

### 6.5 State Dump Response (CMD=0x12, sub=0x4E)

Device sends 5 chunks in the same format as Read Response chunks (sub=0x18). Contains current active preset state. Byte[10] in each chunk is `0x06` (chunk count or protocol marker, NOT the slot number).

**Known gap:** The actual current-slot encoding within the nibble payload is not yet decoded. Implementation defaults to slot 0.

### 6.6 Version Check (CMD=0x11, sub=0x0A)

Firmware compatibility check.

```
F0 21 25 7E 47 50 2D 32 11 0A
00 00 00 00 00 01 00 00 06 00 00
0D 04 0F 07 08 0B 00 00 0C 0B 04 05
F7
```

Total: 34 bytes. The trailing 12 bytes appear to be a version/capability descriptor.

### 6.7 Version Check Response (CMD=0x12, sub=0x0A)

Device responds to indicate acceptance. If bytes [21:33] are all zero, the version check is accepted (compatible firmware).

### 6.8 Preset Change (CMD=0x12, sub=0x08, 30 bytes, raw)

Switch the active preset slot. Also used as a commit step after write operations.

```
Offset  Value         Description
[0-7]   F0 header     SysEx header
[8]     12            CMD = SET
[9]     08            SUB
[10-13] 00 00 00 00   Padding
[14-15] 08 01         Constant
[16-17] 00 00         Padding
[18-21] 04 00 00 00   Constant
[22-25] 00 00 00 00   Padding
[26]    NN            Slot number (0-255, raw byte)
[27-28] 00 00         Padding
[29]    F7            SysEx end
```

Bidirectional: Device echoes a sub=0x08 message when the slot changes (D->H). Byte[14]=0x08 distinguishes a preset change echo from an FX state response (byte[14]!=0x08).

### 6.9 Drum Machine Control (CMD=0x12, sub=0x08, 30 bytes, raw)

Same sub as Preset Change, distinguished by byte[13] and byte[22]:

```
[13]    Mode          0x00 = BPM/Volume control, 0x01 = Pattern/Play-Stop
[14]    0x01          Constant
[22]    BPM Flag      0x01 = BPM control, 0x00 = Pattern control
[25-26] Nibble value  BPM or Pattern index (high nibble, low nibble)
```

### 6.10 FX State Response (CMD=0x12, sub=0x08, D->H)

Device reports effect block state (in response to state query or hardware toggle).

```
[22]    Block ID      0x00-0x0A (see Block ID table)
[24]    State         0x00 = OFF, 0x01 = ON
```

Distinguished from Preset Change echo by byte[14] != 0x08.

### 6.11 Effect Change Response (CMD=0x12, sub=0x0C, 38 bytes, D->H)

Device notifies host when an effect type is changed (e.g. Green OD → Penesas). Device READ returns saved data only — parse sub=0x0C directly.

```
payload = raw[10:-1]  (27 bytes)
[0:4]     00 00 00 01         Constant header
[4]       06                  Constant
[8]       08                  Constant
[12]      Block index         0-10 (PRE..VOL)
[19]      Variant high nibble  \  effectId = (module << 24) | (p[19] << 4) | p[20]
[20]      Variant low nibble   /
[26]      Module type          High byte of effect ID (0x00=PRE, 0x03=DST, 0x07=AMP, 0x0A=CAB...)
```

Verified (2026-03-23) against 6 known changes across CAB, NR, AMP, DST modules.

### 6.12 Toggle Effect (CMD=0x12, sub=0x10, 46 bytes, raw)

Turn an effect block on or off.

```
Offset  Value         Description
[0-7]   F0 header     SysEx header
[8-9]   12 10         CMD, SUB
[10-17] 00 00 00 00 00 00 00 00   Padding
[18-21] 04 00 00 00   Constant
[22-24] 00 00 00      Padding
[25-26] 00 00         Zeros
[27-28] 00 00         Padding
[29-30] 01 05         Constant
[31-33] 00 00 00      Padding
[34-37] 04 00 00 00   Constant
[38]    BB            Block index (0x00-0x0A)
[39]    00            Padding
[40]    SS            State: 0x00=OFF, 0x01=ON
[41-42] 09 0C         Constant
[43-44] 00 02         Constant
[45]    F7            SysEx end
```

Device also sends sub=0x10 (D->H) to notify the host of hardware-initiated toggles (e.g., footswitch press). Same byte layout: block at [38], state at [40].

### 6.13 Patch Settings (CMD=0x12, sub=0x10, 46 bytes, raw)

Same sub and size as Toggle, but byte[40] is always `0x00` (flag). Distinguished by context.

```
[38]    Target        0x00=VOL, 0x01=Tempo, 0x02=Style, 0x06=PAN
[40]    0x00          Always zero (vs 0/1 for toggle)
[41-42] Nibble value  (high<<4 | low) = value
[43-44] Nibble value  Second word (used for Tempo >255)
```

Verified: Patch VOL=51 (display shows 50), Tempo=119 (display shows 120), Style=index number.

### 6.14 Read Request (CMD=0x11, sub=0x10, 46 bytes, raw)

Request full preset data for a slot. Slot number encoded as nibble pair at three positions.

```
Offset  Value         Description
[0-7]   F0 header     SysEx header
[8-9]   11 10         CMD=REQUEST, SUB
[10-17] 00 00 00 00 00 00 00 00   Padding
[18-21] 04 00 00 00   Constant
[22-23] 01 00         Constant
[24]    00            Padding
[25-26] SH SL         Slot nibble-encoded (high, low)
[27-29] 00 00 00      Padding
[30-31] 01 00         Constant
[32-33] 00 00         Padding
[34-36] 04 00 00      Constant
[37-38] SH SL         Slot nibble-encoded (repeated)
[39-40] 00 00         Padding
[41-42] SH SL         Slot nibble-encoded (repeated)
[43-44] 00 00         Padding
[45]    F7            SysEx end
```

Where `SH = (slot >> 4) & 0x0F` and `SL = slot & 0x0F`.

Device responds with 7 chunks of sub=0x18.

### 6.15 Read Response Chunks (CMD=0x12, sub=0x18, D->H, variable, nibble)

Device sends 7 chunks per preset in response to a Read Request.

```
F0 21 25 7E 47 50 2D 32 12 18 [SLOT:1B] [OFF_LO:1B] [OFF_HI:1B] [nibble_data...] F7
```

| Field | Offset | Description |
|-------|--------|-------------|
| SLOT | [10] | Slot number (raw byte) |
| OFF_LO | [11] | Chunk offset low byte |
| OFF_HI | [12] | Chunk offset high byte |
| nibble_data | [13:-1] | Nibble-encoded payload |

**Chunk layout:**

| Chunk | Offset | Nibble bytes | Decoded bytes |
|-------|--------|-------------|---------------|
| 1 | 0 | 370 | 185 |
| 2 | 313 | 370 | 185 |
| 3 | 626 | 370 | 185 |
| 4 | 1067 | 370 | 185 |
| 5 | 1380 | 370 | 185 |
| 6 | 1821 | 370 | 185 |
| 7 | 2134 | 132 | 66 |

Total: 2352 nibble bytes -> **1176 decoded bytes** per preset.

**Assembly:** Sort chunks by offset, concatenate nibble data, nibble-decode.

### 6.16 Param Change (CMD=0x12, sub=0x18, 62 bytes, nibble)

Change a single parameter value on an effect block.

```
SysEx: F0 21 25 7E 47 50 2D 32 12 18 00 00 00 [48 nibble bytes] F7
```

Nibble-decoded payload (24 bytes):

| Offset | Size | Value | Description |
|--------|------|-------|-------------|
| 0-1 | 2 | `00 00` | Padding |
| 2 | 1 | `04` | Constant |
| 3-7 | 5 | `00 00 00 00 00` | Padding |
| 8 | 1 | `05` | Message type: Param Change |
| 9 | 1 | `00` | Padding |
| 10 | 1 | `0C` | Constant |
| 11 | 1 | `00` | Padding |
| 12 | 1 | BB | Block index (0-10) |
| 13 | 1 | PP | Parameter index (0-14) |
| 14 | 1 | `6F` | Marker (normal) / `FA` (Combox controls) |
| 15 | 1 | `00` | Padding |
| 16-19 | 4 | uint32 LE | Effect ID |
| 20-23 | 4 | float32 LE | Parameter value |

Verified with:
- **AMP Mess4 LD** (0x07000055): Param 0=Gain, 1=Presence, 2=Volume, 3=Bass, 4=Middle, 5=Treble (0-100)
- **DLY Ping Pong** (0x0B000004): Param 0=Mix, 1=Feedback(0-500), 2=Time(0-10 enum), 3=Sync(1-4), 4=Trail(0/1)

### 6.17 Style Name (CMD=0x12, sub=0x18, 62 bytes, nibble)

Write a style name to the current preset. Same sub as Param Change but different header.

Nibble-decoded payload (24 bytes):

| Offset | Size | Value | Description |
|--------|------|-------|-------------|
| 0 | 1 | `03` | Style header marker |
| 1 | 1 | `20` | Constant |
| 2 | 1 | `14` | Constant |
| 3 | 1 | `00` | Padding |
| 4 | 1 | `01` | Constant |
| 5 | 1 | `00` | Padding |
| 6 | 1 | `A1` | Marker |
| 7 | 1 | `00` | Padding |
| 8-23 | 16 | ASCII | Style name (null-terminated, max 16 chars) |

Distinguished from Param Change by decoded[0]=0x03 (vs 0x00).

**Note:** Style name is NOT stored in the `.prst` file. It is only transmitted via SysEx and stored in app DB metadata.

### 6.18 Save Commit / Save-to-Slot (CMD=0x12, sub=0x18, 62 bytes, nibble)

Persist the current editing buffer to flash storage.

Nibble-decoded payload (24 bytes):

| Offset | Size | Value | Description |
|--------|------|-------|-------------|
| 0 | 1 | `03` | Save header marker |
| 1 | 1 | `20` | Constant |
| 2 | 1 | `14` | Constant |
| 3 | 1 | `00` | Padding |
| 4 | 1 | SS | Sub-slot index within bank (A=0, B=1, C=2, D=3) |
| 5-7 | 3 | `00 00 00` | Padding |
| 8-23 | 16 | ASCII | Preset name (null-terminated, max 16 chars) |

**Important:** `decoded[4]` must be `slot % 4` (the sub-slot within the bank). Incorrect values cause the device to save to the wrong slot.

Typical flow after live edits: Save Commit -> Preset Change (re-select slot to confirm).

### 6.19 Effect Change (CMD=0x12, sub=0x14, 54 bytes, raw)

Swap an effect in a slot to a different algorithm. Also used for Controller/EXP assignments.

**Status: Not yet implemented.** Capture TODO exists at `docs/capture-todo.md`. The format is known to be 54 bytes raw (not nibble-encoded). Byte[28] distinguishes effect change (0x00) from controller assignment (0x01).

Device responds with sub=0x0C (38 bytes) confirming the change.

### 6.20 Reorder Response (CMD=0x12, sub=0x14, 54 bytes, D->H)

Device confirms a new signal chain order after receiving a Reorder command (sub=0x20). Same sub as Effect Change but sent from device.

### 6.21 Reorder Effects (CMD=0x12, sub=0x20, 78 bytes, nibble)

Change the signal chain order of all 11 effect blocks.

```
SysEx: F0 21 25 7E 47 50 2D 32 12 20 00 00 00 [64 nibble bytes] F7
```

Nibble-decoded payload (32 bytes):

| Offset | Size | Value | Description |
|--------|------|-------|-------------|
| 0-1 | 2 | `00 00` | Padding |
| 2 | 1 | `04` | Constant |
| 3-7 | 5 | `00 00 00 00 00` | Padding |
| 8 | 1 | `08` | Message type: Reorder |
| 9 | 1 | `00` | Padding |
| 10 | 1 | `10` | Constant |
| 11-13 | 3 | `00 00 00` | Padding |
| 14-15 | 2 | `04 04` | Constant |
| 16-26 | 11 | indices | New routing order (11 block slot indices) |
| 27 | 1 | `44` | Terminator |
| 28-31 | 4 | `00 00 00 00` | Padding |

Verified: capture 101538 (NR <-> AMP swap), capture 101714 (NR <-> AMP + DLY <-> RVB).

Device responds with sub=0x14 (54 bytes) echoing the confirmed routing order.

### 6.22 Author Name (CMD=0x12, sub=0x20, 78 bytes, nibble)

Write an author name to the current preset. Same sub as Reorder but different decoded[8] message type.

Nibble-decoded payload (32 bytes):

| Offset | Size | Value | Description |
|--------|------|-------|-------------|
| 0-1 | 2 | `00 00` | Padding |
| 2 | 1 | `04` | Constant |
| 3-5 | 3 | `00 00 00` | Padding |
| 6 | 1 | `01` | Constant |
| 7 | 1 | `00` | Padding |
| 8 | 1 | `09` | Message type: Author |
| 9 | 1 | `00` | Padding |
| 10 | 1 | `14` | Constant |
| 11 | 1 | `00` | Padding |
| 12 | 1 | `01` | Constant |
| 13 | 1 | `00` | Padding |
| 14 | 1 | `70` | Marker |
| 15 | 1 | `0B` | Constant |
| 16-31 | 16 | ASCII | Author name (null-terminated, max 16 chars) |

Verified: capture 143029, packet 71 -- Author "Manuel".

### 6.23 Write Chunks (CMD=0x12, sub=0x20, H->D, variable, nibble)

Write a full preset to a device slot. Same sub as Reorder/Author but with large payloads (>100 bytes after sub).

```
F0 21 25 7E 47 50 2D 32 12 20 [SLOT:1B] [OFF_LO:1B] [OFF_HI:1B] [nibble_data...] F7
```

**4-chunk write format** (confirmed via capture, used by `buildWriteChunks`):

| Chunk | Offset | Nibble bytes | Decoded bytes |
|-------|--------|-------------|---------------|
| 1 | 0 | 366 | 183 |
| 2 | 311 | 366 | 183 |
| 3 | 622 | 366 | 183 |
| 4 | 1061 | 366 | 183 |

Total: 1464 nibble bytes -> **732 decoded bytes**.

**7-chunk write format** (full write from Valeton PC editor):

| Chunk | Offset | Nibble bytes |
|-------|--------|-------------|
| 1 | 0 | 366 |
| 2 | 311 | 366 |
| 3 | 622 | 366 |
| 4 | 1061 | 366 |
| 5 | 1372 | 366 |
| 6 | 1811 | 366 |
| 7 | 2122 | 172 |

Total: 2368 nibble bytes -> **1184 decoded bytes**.

The 4-chunk format writes blocks 0-8 (partial); blocks 9 (RVB) and 10 (VOL) are omitted and the device retains existing values. The 7-chunk format writes all 11 blocks plus controller/pedal assignments.

### 6.24 Note Text (CMD=0x12, sub=0x38, 126 bytes, nibble)

Write a note/description to the current preset.

```
SysEx: F0 21 25 7E 47 50 2D 32 12 38 00 00 00 [112 nibble bytes] F7
```

Nibble-decoded payload (56 bytes):

| Offset | Size | Value | Description |
|--------|------|-------|-------------|
| 0-1 | 2 | `00 00` | Padding |
| 2 | 1 | `04` | Constant |
| 3-5 | 3 | `00 00 00` | Padding |
| 6 | 1 | `01` | Constant |
| 7 | 1 | `00` | Padding |
| 8 | 1 | `0B` | Message type: Note |
| 9 | 1 | `00` | Padding |
| 10 | 1 | `2C` | Constant |
| 11 | 1 | `00` | Padding |
| 12 | 1 | `01` | Constant |
| 13 | 1 | `00` | Padding |
| 14 | 1 | `A1` | Marker |
| 15 | 1 | `00` | Padding |
| 16-55 | 40 | ASCII | Note text (null-terminated, max 40 chars) |

Verified: capture 143029, packet 129 -- Note "TestNote".

### 6.25 Request Preset Name (CMD=0x11, sub=0x20, ~46 bytes, raw)

Request only the preset name for a slot (faster than a full read).

```
Offset  Value
[0-7]   F0 header
[8-9]   11 20         CMD=REQUEST, SUB
[10-17] padding
[18-21] 04 00 00 00   Constant
[22-25] 00 00 00 00   Padding
[26]    NN            Slot number
[27-29] 00 00 00
[30]    07            Constant
[31-33] 00 00 01
[34-37] 04 00 00 00   Constant
[38]    NN            Slot number (repeated)
[39-40] 00 00 00
[41]    NN            Slot number (repeated)
[42-43] 00 00
[44]    F7
```

Device responds with a single sub=0x18 chunk (offset=0) from which the name can be extracted at decoded[28:44].

### 6.26 Assignment Query (CMD=0x11, sub=0x1C, ~70 bytes, raw)

Query controller/EXP pedal assignments.

Organized by section (0 or 1) and page/block:
- Section 0: pages [0 with 16 blocks, 1 with 4 blocks]
- Section 1: pages [0 with 10 blocks]

Device responds with sub=0x1C (CMD=0x12) containing nibble-encoded assignment data. Block number at response byte[22], nibble payload from byte[27] onward.

### 6.27 Assignment / IR Upload Response (CMD=0x12, sub=0x1C, D->H, variable, nibble)

Assignment responses contain controller name and configuration data. Also used for IR upload transfer (multi-chunk, marker byte `0x20` at decoded[10]).

IR upload is a multi-chunk transfer (23+ chunks for a full IR). Not yet reliably implemented due to USB timing issues.

---

## 7. Block IDs

Block IDs identify effect slots in toggle, param change, reorder, and state messages.

| ID | Name | Description |
|----|------|-------------|
| `0x00` | PRE | Pre-amp (Compressor, Noise Gate, Boost) |
| `0x01` | WAH | Wah pedal |
| `0x02` | BOOST | Boost / Overdrive |
| `0x03` | AMP | Amplifier model |
| `0x04` | NR | Noise Reduction |
| `0x05` | CAB | Cabinet / IR |
| `0x06` | EQ | Equalizer |
| `0x07` | MOD | Modulation (Chorus, Flanger, Phaser, Tremolo) |
| `0x08` | DLY | Delay |
| `0x09` | RVB | Reverb |
| `0x0A` | VOL | Volume |

Default signal chain order: PRE -> WAH -> BOOST -> NR -> AMP -> CAB -> EQ -> MOD -> DLY -> RVB -> VOL

---

## 8. Effect ID Structure

Each effect has a 32-bit unsigned integer ID (LE). The high byte encodes the module type:

| High byte | Module | Example effects |
|-----------|--------|-----------------|
| `0x00` | PRE/NR | Compressor, Noise Gate, Boost |
| `0x01` | PRE/EQ/MOD | AC Sim, Guitar EQ, Detune |
| `0x03` | DST | Green OD, Force, Scream OD |
| `0x04` | MOD | Chorus, Flanger, Phaser, Tremolo |
| `0x05` | WAH | V-Wah, C-Wah |
| `0x06` | VOL | Volume |
| `0x07` | AMP | UK 800, Mess DualV, Eagle 120+ |
| `0x08` | AMP (extra) | AC Pre, Mini Bass |
| `0x0A` | CAB | UK GRN 2, EV, User IR |
| `0x0B` | DLY | Pure, Analog, Tape, Ping Pong |
| `0x0C` | RVB | Room, Hall, Shimmer |
| `0x0F` | SnapTone | SnapTone (AMP/DST presets) |

305 effects are mapped in `src/core/effectNames.ts`. 322 parameter definitions per effect in `src/core/effectParams.ts`.

---

## 9. Decoded Preset Format (READ, 1176 bytes)

After nibble-decoding the 7 sub=0x18 chunks:

### 9.1 Header (bytes 0-27, 28 bytes)

| Offset | Size | Value | Description |
|--------|------|-------|-------------|
| 0-3 | 4 | `00 00 04 00` | Constant |
| 4-5 | 2 | `01 00` | Constant (LE16 = 1) |
| 6-7 | 2 | NN 00 | Slot number (LE16, 0-based) |
| 8-9 | 2 | `02 00` | Constant (LE16 = 2) |
| 10-11 | 2 | `58 00` | Constant (LE16 = 88) |
| 12-13 | 2 | NN 00 | Slot number (repeated) |
| 14-15 | 2 | variable | Tempo BPM or metadata |
| 16-27 | 12 | variable | Other preset metadata |

### 9.2 Name and Author (bytes 28-59)

| Offset | Size | Description |
|--------|------|-------------|
| 28-43 | 16 | Preset name (null-terminated ASCII, max 16 chars) |
| 44-59 | 16 | Author (null-terminated ASCII, max 16 chars) |

### 9.3 Routing Section (bytes 100-119)

| Offset | Size | Value | Description |
|--------|------|-------|-------------|
| 100-101 | 2 | `08 00` | Constant |
| 102-103 | 2 | `10 00` | Constant |
| 104-105 | 2 | NN 00 | Slot number (LE16) |
| 106-107 | 2 | `04 04` | Constant |
| 108-118 | 11 | block IDs | Signal chain routing order |
| 119 | 1 | `00` | Terminator |

### 9.4 Effect Blocks (bytes 120-911, 11 x 72 = 792 bytes)

Each block is 72 bytes:

```
+0   4B   14 00 44 00   Block marker (constant)
+4   1B   [0-10]        Slot index
+5   1B   [0 or 1]      Active flag: 0=bypass, 1=active
+6   2B   00 0F         Constant
+8   4B   uint32 LE     Effect ID (high byte = module type)
+12  60B  15x float32   Parameters (LE)
```

Blocks are stored in slot-index order (0=PRE through 10=VOL), independent of routing order.

### 9.5 Trailing Data (bytes 912-1175, 264 bytes)

Controller/pedal assignments. Contains 16-byte records starting with `0C 00 0C 00`.

---

## 10. Decoded Write Format (732/1184 bytes)

### 10.1 Write Header (bytes 0-35, 36 bytes)

Contains `0x27` write markers (static, not slot-dependent). Slot is identified by byte[10] in the SysEx chunk header.

```
00 00 04 00 01 00 27 00 01 00 04 00 27 00 27 00
02 00 58 00 27 00 78 00 32 00 00 00 00 00 00 00
00 00 00 00
```

### 10.2 Name + Author (bytes 36-67, 32 bytes)

| Offset | Size | Description |
|--------|------|-------------|
| 36-51 | 16 | Preset name (null-terminated) |
| 52-67 | 16 | Author (null-terminated) |

### 10.3 Routing Section (bytes 108-127, 20 bytes)

Same structure as read format (section 9.3):

| Offset | Size | Value | Description |
|--------|------|-------|-------------|
| 108-109 | 2 | `08 00` | Constant |
| 110-111 | 2 | `10 00` | Constant |
| 112-113 | 2 | `25 00` | Static write marker |
| 114-115 | 2 | `04 04` | Constant |
| 116-126 | 11 | block IDs | Routing order |
| 127 | 1 | `00` | Terminator |

### 10.4 Effect Blocks (bytes 128+)

4-chunk write: blocks 0-7 complete (8 x 72 = 576 bytes) + block 8 partial (28 bytes) at offset 704.

7-chunk write: all 11 blocks complete (bytes 128-919), followed by controller/pedal assignments (bytes 920-1183).

---

## 11. .prst Binary File Format (1224 bytes)

### 11.1 File Header (bytes 0x00-0x2F, 48 bytes)

| Offset | Size | Value | Description |
|--------|------|-------|-------------|
| 0x00 | 4 | `TSRP` | Magic ("PRST" reversed) |
| 0x10 | 4 | `2-PG` | Device ID ("GP-2" reversed) |
| 0x14 | 4 | `00 01 01 00` | Firmware version |
| 0x1C | 4 | variable | Timestamp / Preset ID |
| 0x28 | 4 | `MRAP` | Chunk marker ("PARM" reversed) |
| 0x2C | 4 | `94 04 00 00` | Chunk size (LE uint32 = 1172) |

### 11.2 Preset Name + Author (bytes 0x44-0x63)

| Offset | Size | Description |
|--------|------|-------------|
| 0x44 | 16 | Preset name (null-terminated ASCII, max 16 chars) |
| 0x54 | 16 | Author (null-terminated ASCII, max 16 chars) |

### 11.3 Effect Blocks (bytes 0xA0-0x3AF, 11 x 72 = 792 bytes)

Same structure as SysEx decoded blocks (see section 9.4).

### 11.4 Checksum (last 2 bytes, 0x4C6)

```
checksum = sum(file_bytes[0x000 .. 0x4C5]) & 0xFFFF
```

Stored as **big-endian** uint16 at bytes [0x4C6:0x4C8].

### 11.5 .prst to SysEx Mapping

| Component | .prst offset | SysEx Write offset | Size |
|-----------|-------------|-------------------|------|
| File header | 0-47 | -- | 48B |
| Write header | -- | 0-15 | 16B |
| Pre-name metadata | 48-67 | 16-35 | 20B |
| Name + Author | 68-99 | 36-67 | 32B |
| URL + padding | 100-139 | 68-107 | 40B |
| Routing section | 140-159 | 108-127 | 20B |
| 11 effect blocks | 160-951 | 128-919 | 792B |
| Controller/pedal | 952-1219 | 920-1183 | 264B |
| Footer+checksum | 1220-1223 | -- | 4B |

Conversion: `.prst[48:]` is approximately equal to `SysEx_write[16:]`.

---

## 12. Device Capacity

- **256 preset slots** (0-based, 0-255)
- Slots 0-248: user presets
- Slots 249-255: factory defaults ("It's GP-200")
- Slot labels: bank number (1-64) + letter (A-D), e.g., slot 0 = "1A", slot 255 = "64D"

---

## 13. USB MIDI Transport

MIDI bytes are wrapped in USB MIDI Event Packets (4 bytes each, USB MIDI 1.0 spec):

| CIN | Meaning | MIDI bytes carried |
|-----|---------|--------------------|
| `0x04` | SysEx start/continue | 3 bytes |
| `0x05` | SysEx end (1 byte) | 1 byte |
| `0x06` | SysEx end (2 bytes) | 2 bytes |
| `0x07` | SysEx end (3 bytes) | 3 bytes |
| `0x0F` | Single byte | 1 byte (GP-200 uses for standalone F7 ACK) |

SysEx messages can span multiple USB frames. Accumulate MIDI bytes across consecutive frames (same direction) until F7 is found.

---

## 14. Nibble-Encoded Message Type Summary

Several messages share the same SUB byte but are distinguished by their nibble-decoded payload header:

### sub=0x18 (62 bytes) -- Distinguished by decoded[0] and decoded[8]

| decoded[0] | decoded[8] | Message |
|------------|------------|---------|
| `0x00` | `0x05` | Param Change |
| `0x03` | -- | Style Name (decoded[0:3] = `03 20 14`) |
| `0x03` | -- | Save Commit (decoded[0:3] = `03 20 14`, decoded[4] = sub-slot) |

### sub=0x20 (78 bytes) -- Distinguished by decoded[8]

| decoded[8] | Message |
|------------|---------|
| `0x08` | Reorder Effects |
| `0x09` | Author Name |

### sub=0x20 (variable, >100 bytes after sub) -- Write Chunks

Large payloads indicate preset write data, not reorder/author.

### sub=0x08 (30 bytes) -- Distinguished by byte[14] and direction

| byte[14] | Direction | Message |
|----------|-----------|---------|
| `0x08` | H->D | Preset Change |
| `0x08` | D->H | Preset Change Echo |
| other | D->H | FX State Response |
| `0x01` | H->D | Drum Machine Control |

---

## 15. Capture Reference

| File | Size | Content |
|------|------|---------|
| 100548 | 9KB | Toggle FX + Save to Slot |
| 101538 | 15KB | Toggle + Reorder + Effect Change + Save |
| 101714 | 50KB | Param Change + Effect Change + Reorder + Toggle |
| 102448 | 23MB | DLY Ping Pong: all knobs 0->max + Sync/Trail |
| 102857 | 22MB | AMP Mess4 LD: all 6 knobs 0->max |
| 103852 | 46MB | Patch Settings (VOL/PAN/Tempo) + Controller |
| 104211 | 170MB | EXP 1/2 Settings + Quick Access + FX Loop |
| 104836 | 22MB | Author/Style/Note editing |
| 105520 | 22MB | Drum Machine: BPM, Pattern, Play/Stop |
| 105713 | 27KB | IR Upload (timeout, 23 chunks, no response) |
| 143029 | -- | Author "Manuel", Style "Green Day", Note "TestNote" |
| 222343 | -- | Preset Change (slot switch) |

Captures are located in `scripts/gp200-capture-*.pcap`. Analyze with:

```bash
python scripts/analyze-sysex.py <capture.pcap>
```

---

## 16. Known Gaps / TODO

- [ ] **Effect Change (sub=0x14, H->D):** Not implemented. Required to swap effect algorithms on a slot (e.g., Green OD -> Force). See `docs/capture-todo.md`.
- [ ] **State Dump slot decoding:** sub=0x4E chunks received during handshake. Byte[10]=0x06 is NOT the slot. Actual slot position in nibble payload unknown. Currently defaults to slot 0.
- [ ] **Header metadata bytes [14:28]:** Exact semantics in read format (BPM? Scene? Category?).
- [ ] **Pre-name metadata bytes [24:36]:** Category/subcategory fields in write format.
- [ ] **Controller/EXP assignment write format:** sub=0x14 assignment variant. Byte[28] distinguishes sections. Min/max values and full parameter mapping not decoded.
- [ ] **IR Upload reliability:** sub=0x1C multi-chunk transfer times out. Device never responds (0 D->H messages). May need longer timeouts or chunk acknowledgment protocol.
- [x] ~~Device-initiated effect change details~~ -- Decoded: payload[12]=block, payload[26]=module, variant=(p[19]<<4)|p[20].
- [ ] **Drum Machine full protocol:** BPM >255 encoding, all pattern IDs.
- [x] ~~Checksum algorithm~~ -- Solved: `sum(bytes[0:0x4C6]) & 0xFFFF`, stored BE16.
- [x] ~~Write format~~ -- Confirmed 4-chunk and 7-chunk formats.
- [x] ~~Toggle, Param, Reorder~~ -- Hardware-verified.
- [x] ~~Author, Style, Note~~ -- Capture-verified.

---

## 17. Related Resources

- GP-5 SysEx reference: https://www.scribd.com/document/963614194/GP-5-SysEx-1
- GP-5 BLE controller repo: `helvecioneto/gp5-wc`
- Implementation: `src/core/SysExCodec.ts`, `src/hooks/useMidiDevice.ts`
- Capture analyzer: `scripts/analyze-sysex.py`
- Capture tool (Windows): `scripts/capture-windows.ps1`
