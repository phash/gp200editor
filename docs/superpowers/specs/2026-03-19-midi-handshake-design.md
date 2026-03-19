# MIDI Handshake Protocol — Design Spec

**Date:** 2026-03-19
**Status:** Approved
**Source:** USB capture `scripts/gp200-capture-20260319-072206.pcap` (2173 SysEx messages, 16s)

## Problem

The current `useMidiDevice.connect()` opens MIDI ports but sends no handshake. The GP-200 auto-broadcasts a sub=0x4E state message, which we passively consume. The official Valeton editor performs a full 9-step handshake sequence before normal operation. Additionally, `buildReadRequest` has incorrect slot encoding — it places raw bytes where nibble-encoded pairs are expected.

## Goals

1. Fix `buildReadRequest` slot encoding bug
2. Implement the full handshake sequence matching the official Valeton editor
3. Parse and expose all handshake data: device identity, firmware version, current preset, cab/IR assignments
4. Auto-load the current preset into the editor after connect

## Non-Goals

- Assignment editing UI (future work, data is stored for later)
- Firmware update support
- Factory preset handling (the 258th read request with special format)

---

## 1. Bug Fix: `buildReadRequest` Slot Encoding

### Current (broken)

Slot placed as raw byte at positions [16], [29], [33]. Only works correctly for slot 0.

### Correct format (from capture)

46 bytes total:

```
[0-9]:   F0 21 25 7E 47 50 2D 32 11 10   Header + CMD/SUB
[10-17]: 00 × 8                            Padding
[18-21]: 04 00 00 00                        Constant
[22-23]: 01 00                              Constant
[24]:    00                                 Padding
[25-26]: SH SL                              Slot nibble-encoded (high first)
[27-29]: 00 00 00                           Padding
[30-31]: 01 00                              Constant
[32-33]: 00 00                              Padding
[34-37]: 04 00 00 00                        Constant
[38-39]: SH SL                              Slot nibble-encoded (repeated)
[40-41]: 00 00                              Padding
[42-43]: SH SL                              Slot nibble-encoded (repeated)
[44]:    00                                 Padding
[45]:    F7                                 End
```

Where `SH = (slot >> 4) & 0x0F`, `SL = slot & 0x0F`.

### Verification data

| Slot | [25-26] | [38-39] | [42-43] |
|------|---------|---------|---------|
| 0    | 00 00   | 00 00   | 00 00   |
| 1    | 00 01   | 00 01   | 00 01   |
| 2    | 00 02   | 00 02   | 00 02   |
| 254  | 0F 0E   | 0F 0E   | 0F 0E   |
| 255  | 0F 0F   | 0F 0F   | 0F 0F   |

---

## 2. New SysExCodec Methods

All messages share the header `F0 21 25 7E 47 50 2D 32` followed by CMD (0x11=request, 0x12=response) and SUB.

### 2.1 `buildIdentityQuery()` → Uint8Array (22B)

```
F0 21 25 7E 47 50 2D 32 11 04 00 00 00 00 01 02 00 00 00 00 00 F7
```

Static message. CMD=0x11, SUB=0x04, param bytes [14-15] = `01 02`.

### 2.2 `parseIdentityResponse(msg: Uint8Array)` → `DeviceIdentity`

Parses CMD=0x12, SUB=0x08 response (30B):

```
f0 21 25 7e 47 50 2d 32 12 08 00 00 00 00 01 02 00 00 04 00 00 00 01 00 00 00 02 00 00 f7
                              |payload...                                              |
```

Returns:
```typescript
interface DeviceIdentity {
  queryEcho: [number, number];  // [14-15] = 01 02 (echoed from request)
  deviceType: number;           // [18] = 0x04
  firmwareValues: number[];     // [22]=0x01, [26]=0x02
}
```

### 2.3 `buildEnterEditorMode()` → Uint8Array (14B)

```
F0 21 25 7E 47 50 2D 32 11 12 00 00 00 F7
```

CMD=0x11, SUB=0x12. No response expected. Minimal message — likely tells the device to enter PC editor mode.

### 2.4 `buildStateDumpRequest()` → Uint8Array (22B)

```
F0 21 25 7E 47 50 2D 32 11 04 00 00 00 00 06 01 00 00 00 00 00 F7
```

Same structure as identity query but param bytes [14-15] = `06 01`. Triggers 5-chunk 0x4E state dump.

### 2.5 `parseStateDump(chunks: Uint8Array[])` → `{ slot: number, preset: GP200Preset }`

Parses 5 × sub=0x4E chunks (384+384+384+384+226B → 846 decoded bytes):

- Slot number from `chunks[0][10]` (byte after SUB)
- Same chunk assembly as `parseReadChunks` but only 5 chunks
- Decoded data contains routing + 11 effect blocks but no controller assignments
- Preset name at decoded[28..59] (may be empty for "live" state)
- Effect blocks at decoded[120..911] (same 72B structure)

### 2.6 `buildVersionCheck()` → Uint8Array (34B)

```
F0 21 25 7E 47 50 2D 32 11 0A
00 00 00 00 00 01 00 00 06 00 00
0D 04 0F 07 08 0B 00 00 0C 0B 04 05
F7
```

CMD=0x11, SUB=0x0A. Nibble-encoded bytes `0D 04 0F 07 08 0B 00 00 0C 0B 04 05` decode to `D4 F7 8B 00 CB 45` — likely an editor version hash. Static message.

### 2.7 `parseVersionResponse(msg: Uint8Array)` → `{ accepted: boolean }`

CMD=0x12, SUB=0x0A response (34B). If nibble data at [21..32] is all zeros → accepted.

### 2.8 `buildAssignmentQuery(section, page, block, refData?)` → Uint8Array (70B)

CMD=0x11, SUB=0x1C. Template from capture:

```
F0 21 25 7E 47 50 2D 32 11 1C
[header: 9 bytes, varies by section]
[page_hi] [page_lo]
[block: 0x00-0x0F]
[padding: 3 bytes]
[constant: 01]
[padding: 2 bytes]
[reference data: ~40 bytes, nibble-encoded]
F7
```

Section 0 header: `00 00 00 00 09 01 00 01 08`
Section 1 header: `00 00 00 01 02 01 00 01 08`

Page increments at byte [21] (nibble-encoded), block at byte [22] (0x00–0x0F).

The reference data varies slightly between requests — we use the most common pattern from the capture as default.

### 2.9 `parseAssignmentResponse(msg: Uint8Array)` → `AssignmentEntry`

CMD=0x12, SUB=0x1C (70B). Nibble-decode payload[27:] to get:
- 5 zero bytes (padding)
- ASCII string (null-terminated) — cab/IR name or other assignment label
- Remaining bytes — raw assignment data

```typescript
interface AssignmentEntry {
  section: number;
  page: number;
  block: number;
  name: string;
  rawData: Uint8Array;
}
```

Observed names from capture:
- Block 0: "YA HWAT 412 FN5" (Yamaha cabinet)
- Block 1: "YA MES 412 TRAD" (Mesa cabinet)
- Block 2-3: "User IR"

---

## 3. Handshake Integration in `useMidiDevice`

### 3.1 New Status Value

```typescript
status: 'disconnected' | 'connecting' | 'handshaking' | 'connected' | 'error'
```

`'connecting'` = acquiring MIDI ports.
`'handshaking'` = running protocol sequence.

### 3.2 New State Fields

```typescript
deviceInfo: DeviceIdentity | null;
currentPreset: GP200Preset | null;
assignments: AssignmentEntry[];
```

### 3.3 Handshake Sequence in `connect()`

After MIDI port discovery, `connect()` sets status to `'handshaking'` and runs:

```
Step 1: send(buildIdentityQuery())
Step 2: await sub=0x08 response        → parseIdentityResponse → setDeviceInfo
Step 3: send(buildEnterEditorMode())
Step 4: await ~100ms                    → no response expected
Step 5: send(buildStateDumpRequest())
Step 6: await 5× sub=0x4E chunks       → parseStateDump → setCurrentSlot + setCurrentPreset
Step 7: send(buildVersionCheck())
Step 8: await sub=0x0A response         → parseVersionResponse → deviceInfo.versionAccepted
Step 9: for section 0, pages 0-1:
          for block 0-15:
            send(buildAssignmentQuery(section, page, block))
            await sub=0x1C response     → parseAssignmentResponse → assignments[]
            20ms delay between requests
Step 10: setStatus('connected')
```

Timeout per step: 3000ms (`READ_TIMEOUT_MS`). On timeout → `setStatus('error')` with message indicating which step failed.

### 3.4 Helper: `waitForResponse()`

```typescript
function waitForResponse(
  input: GP200Input,
  match: (data: Uint8Array) => boolean,
  timeoutMs: number,
  baseHandler: (event: { data: unknown }) => void
): Promise<Uint8Array>
```

Sets temporary `onmidimessage`, waits for match, resolves. Restores `baseHandler` (the `onMidiMessage` callback) on resolve/reject. Replaces duplicated callback patterns in `pullPreset` and `loadPresetNames`.

### 3.5 Helper: `collectChunks()`

```typescript
function collectChunks(
  input: GP200Input,
  cmd: number, sub: number,
  expectedCount: number,
  timeoutMs: number,
  baseHandler: (event: { data: unknown }) => void
): Promise<Uint8Array[]>
```

Collects N messages matching cmd/sub. Used for:
- sub=0x4E: 5 chunks (state dump)
- sub=0x18: 7 chunks (preset read — refactored from current `pullPreset`)

---

## 4. UI Updates

### 4.1 DeviceStatusBar

- Shows firmware version from `deviceInfo` next to device name: "GP-200 FW 1.2"
- During `status === 'handshaking'`: progress text ("Identifying device...", "Loading state...", "Reading assignments...")
- Version warning if `deviceInfo.versionAccepted === false`

### 4.2 Editor Auto-Load

After handshake completes with `currentPreset` set, `editor/page.tsx` loads it into `usePreset` automatically. User sees the device's active preset without pressing Pull.

---

## 5. Tests

### Unit Tests (SysExCodec)

- `buildReadRequest`: verify nibble encoding for slots 0, 1, 127, 254, 255 against capture bytes
- `buildIdentityQuery`: exact byte match against capture message #1
- `buildEnterEditorMode`: exact byte match against capture message #3
- `buildStateDumpRequest`: exact byte match against capture message #4
- `buildVersionCheck`: exact byte match against capture message #10
- `buildAssignmentQuery`: verify structure for section 0/block 0 and section 0/block 15
- `parseIdentityResponse`: parse capture message #2
- `parseStateDump`: parse 5 capture 0x4E chunks → verify slot=6, extract effects
- `parseVersionResponse`: parse capture message #11 → accepted=true
- `parseAssignmentResponse`: parse capture block 0 → name="YA HWAT 412 FN5"

### Unit Tests (useMidiDevice)

- Mock handshake: verify all 10 steps execute in order
- Verify state transitions: disconnected → connecting → handshaking → connected
- Timeout handling: handshake step failure → error status with step-specific message
- `currentPreset` set after handshake from 0x4E data

---

## Captured Reference Data

### Identity Query/Response
```
H→D: f0 21 25 7e 47 50 2d 32 11 04 00 00 00 00 01 02 00 00 00 00 00 f7
D→H: f0 21 25 7e 47 50 2d 32 12 08 00 00 00 00 01 02 00 00 04 00 00 00 01 00 00 00 02 00 00 f7
```

### Enter Editor Mode
```
H→D: f0 21 25 7e 47 50 2d 32 11 12 00 00 00 f7
```

### State Dump Request/Response
```
H→D: f0 21 25 7e 47 50 2d 32 11 04 00 00 00 00 06 01 00 00 00 00 00 f7
D→H: 5× sub=0x4E chunks (384+384+384+384+226B), slot at chunk[0][10]=6
```

### Version Check
```
H→D: f0 21 25 7e 47 50 2d 32 11 0a 00 00 00 00 00 01 00 00 06 00 00 0d 04 0f 07 08 0b 00 00 0c 0b 04 05 f7
D→H: f0 21 25 7e 47 50 2d 32 12 0a 00 00 00 00 00 01 00 00 06 00 00 00 00 00 00 00 00 00 00 00 00 00 00 f7
```

### Assignment Query (Section 0, Page 0, Block 0)
```
H→D: f0 21 25 7e 47 50 2d 32 11 1c 00 00 00 00 09 01 00 01 08 00 00 00 00 00 00 00 01 00 00 0c 0e 07 03 0b 02 00 00 07 02 04 0f 06 05 00 09 00 0c 0f 0e 0d 0a 00 0b 09 08 07 05 0e 08 00 02 00 02 00 00 00 00 00 00 f7
D→H: f0 21 25 7e 47 50 2d 32 12 1c 00 00 00 00 09 01 00 01 08 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 05 09 04 01 02 00 04 08 05 07 04 01 05 04 02 00 03 04 03 01 03 02 02 00 04 06 04 0e 03 05 00 00 f7
```
