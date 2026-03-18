# Web MIDI Device Sync — Design Spec

**Date:** 2026-03-18
**Issue:** #6
**Status:** Approved

---

## 1. Overview

Add Web MIDI API-based push/pull of presets between the browser editor and the connected Valeton GP-200 pedal. Users can pull any of the 256 device presets into the editor and push the current editor state back to any slot — without leaving the browser.

---

## 2. Scope

**In scope:**
- Connect to GP-200 via `navigator.requestMIDIAccess({ sysex: true })`
- Pull a preset from any of 256 device slots into the editor
- Push the current editor preset to any of 256 device slots
- Auto-sync: detect currently active slot on the device at connect time
- Slot browser: load all 256 preset names from device, display in 4-pack groups (1A–64D)
- Progress feedback during name loading and pull/push operations

**Out of scope:**
- Firefox/Safari support (Web MIDI SysEx only works in Chrome/Edge)
- Bulk operations (copy/backup all presets)
- Live parameter sync (real-time knob mirroring)

---

## 3. Architecture

### New files

| File | Purpose |
|------|---------|
| `src/core/SysExCodec.ts` | Pure TS: nibble encode/decode, SysEx frame assembly/parsing, GP200Preset ↔ SysEx |
| `src/hooks/useMidiDevice.ts` | Web MIDI connection state, auto-sync, pull/push operations |
| `src/components/DeviceStatusBar.tsx` | Thin status bar: connection LED, slot label, Pull/Push buttons |
| `src/components/DeviceSlotBrowser.tsx` | 256-slot modal, 4-pack groups, search, progress |

### Modified files

- `src/app/[locale]/editor/page.tsx` — add `<DeviceStatusBar>` below patch name header
- `messages/de.json`, `messages/en.json` — new `device` i18n namespace

---

## 4. SysEx Protocol

Protocol is fully documented in `docs/sysex-protocol.md`. Key points:

**Nibble encoding:** Every SysEx data byte holds only 4 bits (0x00–0x0F). Two consecutive nibble-bytes → one decoded byte:
```
decoded[i] = (nibble[2i] << 4) | nibble[2i+1]
```

**SysEx header (all messages):** `F0 21 25 7E 47 50 2D 32`

**Read request (host → device):** CMD=0x11, sub=0x10, 46 bytes. Slot number (0-based) appears at bytes 16, 29, and 33:
```
F0 21 25 7E 47 50 2D 32  11 10
00 00 00 00 00 00 00 00 04 00 00 00 01 00 00 00
<slot>                              ← byte 16
00 00 00 01 00 00 00 04 00 00 00
<slot>                              ← byte 29
00 00 00
<slot>                              ← byte 33
00 00  F7
```

**Read response (device → host):** 7 chunks, CMD=0x12, sub=0x18, nibble-encoded
- Chunk header: `[0x18][slot:1B][offset:2B LE][nibble-data...]`
- Offsets: 0, 313, 626, 1067, 1380, 1821, 2134
- Decoded: 1176 bytes total

**Decoded preset layout (1176 bytes):**
- `[0:28]` — header (slot nr at `[6:8]` LE16)
- `[28:60]` — preset name (null-terminated ASCII, 32 bytes)
- `[108:119]` — block routing order (11 block IDs)
- `[120:912]` — **11 × 72-byte effect blocks** (identical structure to `.prst`)
- `[912:1176]` — controller assignments (264 bytes, pass-through)

**Effect block (72 bytes, identical to `.prst`):**
```
+0   4B  14 00 44 00  marker
+4   1B  slot index (0–10)
+5   1B  active flag (0=bypass, 1=on)
+6   2B  00 0F (constant)
+8   4B  effect ID (LE uint32)
+12  60B 15× float32 LE (parameters)
```

**Write payload (host → device):** 4 chunks, CMD=0x12, sub=0x20, nibble-encoded
- Decoded payload: 732 bytes
- Chunk offsets: 0, 311, 622, 1061
- Contains: blocks 0–7 complete + partial block 8 (DLY): marker + slot + active + const + effectID + **first 4 float32 params** = 28 bytes
- Blocks 9 (RVB) and 10 (VOL) are NOT sent; device retains existing values
- Name at write offset 36, blocks start at write offset 128

---

## 5. `SysExCodec` API

```ts
// Encoding
nibbleEncode(data: Uint8Array): Uint8Array
nibbleDecode(data: Uint8Array): Uint8Array

// Frame construction
buildReadRequest(slot: number): Uint8Array
// CMD=0x11, sub=0x10, 46 bytes — §4.4 "Request Full Preset Data" variant
// Slot number at byte positions 16, 29, 33 (distinguishes from §4.1/4.2 toggle/query which use byte 38/40)
buildWriteChunks(preset: GP200Preset, slot: number): Uint8Array[]  // 4 CMD=0x12/sub=0x20 chunks

// Parsing
parseReadChunks(chunks: Uint8Array[]): GP200Preset
// 7 sub=0x18 chunks → GP200Preset. SysEx has no checksum field; sets checksum: 0.
parsePresetName(firstChunk: Uint8Array): string     // fast name-only parse from chunk with offset=0

// Helpers
slotToLabel(slot: number): string   // 0 → "1A", 255 → "64D"
labelToSlot(label: string): number  // "1A" → 0
```

---

## 6. `useMidiDevice` Hook API

```ts
interface UseMidiDeviceReturn {
  // State
  status: 'disconnected' | 'connecting' | 'connected' | 'error'
  errorMessage: string | null
  deviceName: string | null
  currentSlot: number | null        // auto-synced from sub=0x4E on connect
  presetNames: (string | null)[]    // index = slot, null = not yet loaded
  namesLoadProgress: number         // 0–256

  // Actions
  connect: () => Promise<void>
  disconnect: () => void
  loadPresetNames: () => Promise<void>   // lazy, called when browser opens
  pullPreset: (slot: number) => Promise<GP200Preset>
  pushPreset: (preset: GP200Preset, slot: number) => Promise<void>
}
```

**Connection flow:**
1. `requestMIDIAccess({ sysex: true })` — triggers browser permission prompt
2. Find input/output ports matching "GP-200" (or first available MIDI ports)
3. Register `onmidimessage` listener on input port
4. Device automatically sends CMD=0x12, sub=0x4E on connect (initial state dump, §4.7)
5. Parse `currentSlot` from sub=0x4E payload[1] — **unverified assumption; same slot-byte position as sub=0x18; validate against live device; fall back to `null` if absent**
6. Set `status: 'connected'`, `currentSlot` (or `null` if sub=0x4E parsing fails)

**Name loading (lazy):**
- Triggered when slot browser opens for the first time
- Per slot: send CMD=0x11/sub=0x10 request (§4.4), wait for first sub=0x18 chunk (offset=0), parse name at decoded bytes 28–59
- Cache in hook state; skip already-loaded names on re-open
- `namesLoadProgress` increments 0→256 for progress bar

---

## 7. `DeviceStatusBar` Component

```tsx
// Renders below patch name, above signal chain
<DeviceStatusBar
  midiDevice={useMidiDevice result}
  onPull={(preset) => loadPreset(preset)}
  onPushRequest={() => openSlotBrowser('push')}
  onPullRequest={() => openSlotBrowser('pull')}
/>
```

**States:**
- **Disconnected:** grey LED · "Kein Gerät" · [Verbinden]-Button
- **Connecting:** pulsing amber LED · "Verbinde…"
- **Connected:** green LED · "GP-200 · Slot 3A »Pretender«" · [← Pull] [Push →]
- **Error:** red LED · error message · [Erneut verbinden]

---

## 8. `DeviceSlotBrowser` Component

```tsx
<DeviceSlotBrowser
  mode: 'pull' | 'push'
  presetNames: (string | null)[]
  namesLoadProgress: number
  currentSlot: number | null
  onConfirm: (slot: number) => void
  onCancel: () => void
/>
```

**Layout:**
- Search input (filter by name)
- Progress bar if `namesLoadProgress < 256`
- Scrollable list of 64 bank rows, each row = 4 cells (A/B/C/D)
- Cell: `[label]` + `[preset name]`, highlighted if `currentSlot`
- Confirm button label changes: "← Pull von 3A" / "Push nach 3A →"
- Keyboard: arrow keys navigate, Enter confirms, Escape cancels
- Push button in `DeviceStatusBar` is disabled when `preset === null` (no preset loaded)

---

## 9. Editor Integration

```tsx
// editor/page.tsx additions
const midiDevice = useMidiDevice();
const [slotBrowserMode, setSlotBrowserMode] = useState<'pull'|'push'|null>(null);

// Pull confirmed: load preset into editor
async function handlePullConfirm(slot: number) {
  const preset = await midiDevice.pullPreset(slot);
  loadPreset(preset);
  setSlotBrowserMode(null);
}

// Push confirmed: send current editor preset to device
async function handlePushConfirm(slot: number) {
  await midiDevice.pushPreset(preset!, slot);
  setSlotBrowserMode(null);
}
```

---

## 10. i18n Keys (`device` namespace)

| Key | DE | EN |
|-----|----|----|
| `connect` | Verbinden | Connect |
| `disconnect` | Trennen | Disconnect |
| `connecting` | Verbinde… | Connecting… |
| `noDevice` | Kein Gerät | No device |
| `connected` | GP-200 verbunden | GP-200 connected |
| `pull` | ← Pull | ← Pull |
| `push` | Push → | Push → |
| `pullFrom` | Pull von {slot} | Pull from {slot} |
| `pushTo` | Push nach {slot} | Push to {slot} |
| `loadingNames` | Lade Preset-Namen… | Loading preset names… |
| `browserTitle` | Preset auswählen | Select preset |
| `search` | Preset suchen… | Search presets… |
| `chromeOnly` | Nur Chrome/Edge unterstützt | Chrome/Edge only |
| `error` | Verbindungsfehler | Connection error |
| `retry` | Erneut verbinden | Reconnect |

---

## 11. Error Handling

| Situation | Behaviour |
|-----------|-----------|
| Browser doesn't support Web MIDI | Status bar shows "Nur Chrome/Edge unterstützt", no connect button |
| `requestMIDIAccess` denied by user | `status: 'error'`, message "Zugriff verweigert" |
| No GP-200 found in MIDI ports | `status: 'error'`, message "GP-200 nicht gefunden" |
| Read timeout (>3s, no response) | Retry once, then `status: 'error'` |
| Push fails mid-transfer | Toast error, editor state unchanged |
| Device disconnected during operation | `status: 'disconnected'`, operation aborted cleanly |

---

## 12. Testing

**Unit tests (`tests/unit/`):**
- `SysExCodec.test.ts` — nibbleDecode/nibbleEncode round-trips, buildReadRequest, parseReadChunks with real capture data
- `useMidiDevice.test.ts` — hook state transitions with mocked Web MIDI API

**Manual test checklist:**
- [ ] Connect with device plugged in (Chrome)
- [ ] Auto-sync shows correct current slot
- [ ] Pull preset → editor loads correct effects and params
- [ ] Open slot browser → all 256 names load with progress
- [ ] Push preset → device plays modified preset on next selection
- [ ] Error states: no device, permission denied, disconnect mid-transfer

---

## 13. Browser Compatibility

| Browser | Support |
|---------|---------|
| Chrome 43+ | ✓ Full support |
| Edge 79+ | ✓ Full support |
| Firefox | ✗ Web MIDI SysEx not supported |
| Safari | ✗ Web MIDI not supported |

Status bar shows a clear warning for unsupported browsers instead of a connect button.
