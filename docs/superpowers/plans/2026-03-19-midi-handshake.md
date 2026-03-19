# MIDI Handshake Protocol Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the full GP-200 MIDI handshake sequence so the editor connects like the official Valeton software, auto-loads the current preset, and exposes device info.

**Architecture:** Extend `SysExCodec` with 10 new methods (builders + parsers for 5 message types). Refactor `useMidiDevice` to run a 10-step handshake in `connect()`, using new `waitForResponse`/`collectChunks` helpers. Fix the broken `buildReadRequest` slot encoding. Update `DeviceStatusBar` for handshake status + firmware display.

**Tech Stack:** TypeScript, React hooks, Web MIDI API, Vitest

**Spec:** `docs/superpowers/specs/2026-03-19-midi-handshake-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/core/SysExCodec.ts` | Modify | Fix `buildReadRequest`, add handshake builders/parsers, extract shared chunk helper |
| `tests/unit/SysExCodec.test.ts` | Modify | Rewrite `buildReadRequest` tests, add tests for all new methods |
| `src/hooks/useMidiDevice.ts` | Modify | Add `handshaking` status, `waitForResponse`/`collectChunks` helpers, handshake in `connect()`, new state fields |
| `tests/unit/useMidiDevice.test.ts` | Modify | Update mock to support handshake, add handshake flow tests |
| `src/components/DeviceStatusBar.tsx` | Modify | Add `handshaking` LED/text, firmware display |
| `messages/en.json` | Modify | Add handshake status strings |
| `messages/de.json` | Modify | Add handshake status strings |

---

## Task 1: Fix `buildReadRequest` Slot Encoding

**Files:**
- Modify: `src/core/SysExCodec.ts:36-53`
- Modify: `tests/unit/SysExCodec.test.ts:102-126`

- [ ] **Step 1: Rewrite the buildReadRequest tests**

Replace the existing `buildReadRequest` describe block with tests against the captured byte layout:

```typescript
describe('SysExCodec: buildReadRequest', () => {
  it('returns a 46-byte SysEx message with correct framing', () => {
    const req = SysExCodec.buildReadRequest(0);
    expect(req.length).toBe(46);
    expect(req[0]).toBe(0xF0);
    expect(req[8]).toBe(0x11); // CMD
    expect(req[9]).toBe(0x10); // sub
    expect(req[45]).toBe(0xF7);
  });

  it('slot 0 matches capture exactly', () => {
    const req = SysExCodec.buildReadRequest(0);
    const expected = new Uint8Array([
      0xF0, 0x21, 0x25, 0x7E, 0x47, 0x50, 0x2D, 0x32, 0x11, 0x10,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x04, 0x00,
      0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x01, 0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0xF7,
    ]);
    expect(req).toEqual(expected);
  });

  it('slot 1: nibble-encoded at [25-26], [37-38], [41-42]', () => {
    const req = SysExCodec.buildReadRequest(1);
    // SH=0x00, SL=0x01 for slot 1
    expect(req[25]).toBe(0x00); expect(req[26]).toBe(0x01);
    expect(req[37]).toBe(0x00); expect(req[38]).toBe(0x01);
    expect(req[41]).toBe(0x00); expect(req[42]).toBe(0x01);
  });

  it('slot 254 (0xFE): nibble-encoded as 0F 0E', () => {
    const req = SysExCodec.buildReadRequest(254);
    expect(req[25]).toBe(0x0F); expect(req[26]).toBe(0x0E);
    expect(req[37]).toBe(0x0F); expect(req[38]).toBe(0x0E);
    expect(req[41]).toBe(0x0F); expect(req[42]).toBe(0x0E);
  });

  it('slot 255 (0xFF): nibble-encoded as 0F 0F', () => {
    const req = SysExCodec.buildReadRequest(255);
    expect(req[25]).toBe(0x0F); expect(req[26]).toBe(0x0F);
    expect(req[37]).toBe(0x0F); expect(req[38]).toBe(0x0F);
    expect(req[41]).toBe(0x0F); expect(req[42]).toBe(0x0F);
  });

  it('constants are correct for all slots', () => {
    for (const slot of [0, 1, 127, 254, 255]) {
      const req = SysExCodec.buildReadRequest(slot);
      // [10-17]: 8 zero bytes
      for (let i = 10; i <= 17; i++) expect(req[i]).toBe(0x00);
      // [18-21]: 04 00 00 00
      expect(req[18]).toBe(0x04);
      // [22-23]: 01 00
      expect(req[22]).toBe(0x01); expect(req[23]).toBe(0x00);
      // [30-31]: 01 00
      expect(req[30]).toBe(0x01); expect(req[31]).toBe(0x00);
      // [34-37]: 04 00 00 00
      expect(req[34]).toBe(0x04);
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/SysExCodec.test.ts --reporter=verbose`
Expected: `buildReadRequest` tests FAIL (old byte layout doesn't match)

- [ ] **Step 3: Rewrite `buildReadRequest`**

Replace the method in `src/core/SysExCodec.ts:36-53`. Slot nibble positions verified against captures for slots 0, 1, 254, 255:

```typescript
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
    0x04, 0x00, 0x00,                                  // [34-36] constant (3 bytes, NOT 4)
    sh, sl,                                            // [37-38] slot nibble
    0x00, 0x00,                                        // [39-40] padding
    sh, sl,                                            // [41-42] slot nibble
    0x00, 0x00,                                        // [43-44] padding
    0xF7,                                              // [45]    end
  ]);
},
```

Byte count: 10+8+4+2+1+2+3+2+2+3+2+2+2+2+1 = 46. ✓

**Note:** The spec's byte layout table lists [34-37] as a 4-byte constant and slot at [38-39]/[42-43] — this is a spec error. The capture proves [34-36] is a 3-byte constant with slot at [37-38]/[41-42]. The tests above verify the correct positions.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/SysExCodec.test.ts --reporter=verbose`
Expected: ALL PASS

- [ ] **Step 5: Also fix test `useMidiDevice.test.ts:130` that asserts `req[16] === 5`**

In `tests/unit/useMidiDevice.test.ts`, the test at line 130 checks `expect(req[16]).toBe(5)`. Update it to check the new nibble position:

```typescript
// Old: expect(req[16]).toBe(5); // slot
// New: check slot 5 nibble-encoded at [25-26]
expect(req[25]).toBe(0x00); // SH for slot 5
expect(req[26]).toBe(0x05); // SL for slot 5
```

- [ ] **Step 6: Run all tests**

Run: `npx vitest run --reporter=verbose`
Expected: ALL PASS

- [ ] **Step 7: Commit**

```bash
git add src/core/SysExCodec.ts tests/unit/SysExCodec.test.ts tests/unit/useMidiDevice.test.ts
git commit -m "fix: buildReadRequest slot nibble-encoding from USB capture"
```

---

## Task 2: Handshake Message Builders (SysExCodec)

**Files:**
- Modify: `src/core/SysExCodec.ts`
- Modify: `tests/unit/SysExCodec.test.ts`

- [ ] **Step 1: Write tests for all 5 static builder methods**

Add a new describe block in `tests/unit/SysExCodec.test.ts`:

```typescript
describe('SysExCodec: handshake builders', () => {
  it('buildIdentityQuery returns exact 22-byte message', () => {
    const msg = SysExCodec.buildIdentityQuery();
    expect(msg).toEqual(new Uint8Array([
      0xF0, 0x21, 0x25, 0x7E, 0x47, 0x50, 0x2D, 0x32,
      0x11, 0x04,
      0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00,
      0xF7,
    ]));
  });

  it('buildEnterEditorMode returns exact 14-byte message', () => {
    const msg = SysExCodec.buildEnterEditorMode();
    expect(msg).toEqual(new Uint8Array([
      0xF0, 0x21, 0x25, 0x7E, 0x47, 0x50, 0x2D, 0x32,
      0x11, 0x12,
      0x00, 0x00, 0x00,
      0xF7,
    ]));
  });

  it('buildStateDumpRequest returns exact 22-byte message', () => {
    const msg = SysExCodec.buildStateDumpRequest();
    expect(msg).toEqual(new Uint8Array([
      0xF0, 0x21, 0x25, 0x7E, 0x47, 0x50, 0x2D, 0x32,
      0x11, 0x04,
      0x00, 0x00, 0x00, 0x00, 0x06, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00,
      0xF7,
    ]));
  });

  it('buildVersionCheck returns exact 34-byte message', () => {
    const msg = SysExCodec.buildVersionCheck();
    expect(msg).toEqual(new Uint8Array([
      0xF0, 0x21, 0x25, 0x7E, 0x47, 0x50, 0x2D, 0x32,
      0x11, 0x0A,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x06, 0x00, 0x00,
      0x0D, 0x04, 0x0F, 0x07, 0x08, 0x0B, 0x00, 0x00, 0x0C, 0x0B, 0x04, 0x05,
      0xF7,
    ]));
  });

  it('buildAssignmentQuery section 0 page 0 block 0 is 70 bytes', () => {
    const msg = SysExCodec.buildAssignmentQuery(0, 0, 0);
    expect(msg.length).toBe(70);
    expect(msg[0]).toBe(0xF0);
    expect(msg[8]).toBe(0x11);
    expect(msg[9]).toBe(0x1C);
    // Section 0 header
    expect(msg[10]).toBe(0x00); // section 0 marker
    expect(msg[14]).toBe(0x09); // section 0 header byte
    // Block at [22]
    expect(msg[22]).toBe(0x00);
    expect(msg[69]).toBe(0xF7);
  });

  it('buildAssignmentQuery increments block byte', () => {
    const msg5 = SysExCodec.buildAssignmentQuery(0, 0, 5);
    expect(msg5[22]).toBe(0x05);
    const msgF = SysExCodec.buildAssignmentQuery(0, 0, 15);
    expect(msgF[22]).toBe(0x0F);
  });

  it('buildAssignmentQuery page 1 sets page nibble at [21]', () => {
    const msg = SysExCodec.buildAssignmentQuery(0, 1, 0);
    expect(msg[21]).toBe(0x01);
  });

  it('buildAssignmentQuery section 1 uses different header', () => {
    const msg = SysExCodec.buildAssignmentQuery(1, 0, 0);
    expect(msg[13]).toBe(0x01); // section 1 marker byte[3]
    expect(msg[14]).toBe(0x02); // section 1 header
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/SysExCodec.test.ts --reporter=verbose`
Expected: FAIL — methods don't exist

- [ ] **Step 3: Implement the 5 builder methods in SysExCodec**

Add to `src/core/SysExCodec.ts` (before the closing `};`):

```typescript
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
  // Section headers from capture
  const SEC0_HDR = [0x00, 0x00, 0x00, 0x00, 0x09, 0x01, 0x00, 0x01, 0x08];
  const SEC1_HDR = [0x00, 0x00, 0x00, 0x01, 0x02, 0x01, 0x00, 0x01, 0x08];
  const header = section === 1 ? SEC1_HDR : SEC0_HDR;
  // Reference data (most common template from capture)
  const REF_DATA = [
    0x0C, 0x0E, 0x07, 0x03, 0x0B, 0x02, 0x00, 0x00,
    0x0F, 0x0A, 0x04, 0x0F, 0x06, 0x05, 0x00, 0x09,
    0x00, 0x0C, 0x0F, 0x0E, 0x0D, 0x0A, 0x00, 0x0B,
    0x09, 0x08, 0x07, 0x05, 0x0E, 0x08, 0x00, 0x02,
    0x00, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  ];
  const ph = (page >> 4) & 0x0F;
  const pl = page & 0x0F;
  return new Uint8Array([
    0xF0, 0x21, 0x25, 0x7E, 0x47, 0x50, 0x2D, 0x32,  // [0-7]
    0x11, 0x1C,                                        // [8-9]
    ...header,                                          // [10-18]
    ph, pl,                                            // [19-20] page nibble — wait
    // Actually from capture: page bytes are at payload[11-12] = msg[21-22]
    // Let me re-examine. The capture shows msg[21]=0x01 for page 1.
    // The full 70B template has: [10..18]=header(9B), [19-20]=00 00, [21]=page_hi, [22]=block
    // I need to verify this against the raw bytes.
    // Capture block 0 page 0: msg[10..21] = 00 00 00 00 09 01 00 01 08 00 00 00
    // So [10-18]=header, [19]=0x00, [20]=0x00, [21]=page(0x00), [22]=block(0x00)
    // Capture block 0 page 1: msg[21]=0x01, msg[22]=0x00
  ]);
  // ... this needs exact byte layout. See step 3 implementation below.
},
```

Actually, the exact `buildAssignmentQuery` layout requires precise byte positions from the capture. From the raw captured message #12 (section 0, page 0, block 0):

```
f0 21 25 7e 47 50 2d 32 11 1c 00 00 00 00 09 01 00 01 08 00 00 00 00 00 00 00 01 00 00 0c 0e 07 03 0b 02 00 00 07 02 04 0f 06 05 00 09 00 0c 0f 0e 0d 0a 00 0b 09 08 07 05 0e 08 00 02 00 02 00 00 00 00 00 00 f7
```

Indices [10-18] = `00 00 00 00 09 01 00 01 08` (section header, 9 bytes)
[19-20] = `00 00` (page nibble high, low)
[21-22] = `00 00` — wait, block 0 is at [22]. Let me check block 5:

Capture message #22 (block 5): `... 11 1c 00 00 00 00 09 01 00 01 08 00 00 00 05 ...`
So [10-18] = header, [19-20] = `00 00` (page), [21] = `00`, [22] = `05` (block).

But for page 1 block 0 (msg #44): `... 11 1c 00 00 00 00 09 01 00 01 08 00 00 01 00 ...`
[19-20] = `00 00`, [21] = `01` (page), [22] = `00` (block).

So:
- [19-20]: always `00 00` padding
- [21]: page number (raw byte, not nibble-encoded)
- [22]: block number (raw byte 0x00-0x0F)

Implementation:

```typescript
buildAssignmentQuery(section: number, page: number, block: number): Uint8Array {
  const SEC0_HDR = [0x00, 0x00, 0x00, 0x00, 0x09, 0x01, 0x00, 0x01, 0x08];
  const SEC1_HDR = [0x00, 0x00, 0x00, 0x01, 0x02, 0x01, 0x00, 0x01, 0x08];
  const header = section === 1 ? SEC1_HDR : SEC0_HDR;
  // REF_DATA: bytes [26-68] from the actual capture (msg #12, section 0/page 0/block 0)
  const REF_DATA = [
    0x01, 0x00, 0x00,                                  // [26-28]
    0x0C, 0x0E, 0x07, 0x03, 0x0B, 0x02, 0x00, 0x00,  // [29-36]
    0x07, 0x02, 0x04, 0x0F, 0x06, 0x05, 0x00, 0x09,  // [37-44]
    0x00, 0x0C, 0x0F, 0x0E, 0x0D, 0x0A, 0x00, 0x0B,  // [45-52]
    0x09, 0x08, 0x07, 0x05, 0x0E, 0x08, 0x00, 0x02,  // [53-60]
    0x00, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,  // [61-68]
  ];
  return new Uint8Array([
    0xF0, 0x21, 0x25, 0x7E, 0x47, 0x50, 0x2D, 0x32,
    0x11, 0x1C,
    ...header,                   // [10-18]
    0x00, 0x00,                  // [19-20] padding
    page & 0xFF,                 // [21] page
    block & 0x0F,                // [22] block
    0x00, 0x00, 0x00,            // [23-25] padding
    ...REF_DATA,                 // [26-68] constant + ref data
    0xF7,                        // [69]
  ]);
},
```

Total: 10 + 9 + 2 + 1 + 1 + 3 + 43 + 1 = 70. ✓

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/SysExCodec.test.ts --reporter=verbose`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/SysExCodec.ts tests/unit/SysExCodec.test.ts
git commit -m "feat: add handshake message builders to SysExCodec"
```

---

## Task 3: Handshake Parsers + Shared Chunk Helper (SysExCodec)

**Files:**
- Modify: `src/core/SysExCodec.ts`
- Modify: `tests/unit/SysExCodec.test.ts`

- [ ] **Step 1: Write tests for parsers**

```typescript
describe('SysExCodec: handshake parsers', () => {
  it('parseIdentityResponse extracts device info from capture', () => {
    const msg = new Uint8Array([
      0xF0, 0x21, 0x25, 0x7E, 0x47, 0x50, 0x2D, 0x32,
      0x12, 0x08,
      0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x00, 0x00,
      0x04, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00,
      0x02, 0x00, 0x00,
      0xF7,
    ]);
    const info = SysExCodec.parseIdentityResponse(msg);
    expect(info.deviceType).toBe(0x04);
    expect(info.firmwareValues).toEqual([0x01, 0x02]);
  });

  it('parseVersionResponse: all-zero nibble data → accepted', () => {
    const msg = new Uint8Array([
      0xF0, 0x21, 0x25, 0x7E, 0x47, 0x50, 0x2D, 0x32,
      0x12, 0x0A,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x06, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0xF7,
    ]);
    expect(SysExCodec.parseVersionResponse(msg)).toEqual({ accepted: true });
  });

  it('parseVersionResponse: non-zero nibble data → not accepted', () => {
    const msg = new Uint8Array([
      0xF0, 0x21, 0x25, 0x7E, 0x47, 0x50, 0x2D, 0x32,
      0x12, 0x0A,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x06, 0x00, 0x00,
      0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0xF7,
    ]);
    expect(SysExCodec.parseVersionResponse(msg)).toEqual({ accepted: false });
  });

  it('parseAssignmentResponse extracts cab name from capture block 0', () => {
    const msg = new Uint8Array([
      0xF0, 0x21, 0x25, 0x7E, 0x47, 0x50, 0x2D, 0x32,
      0x12, 0x1C,
      0x00, 0x00, 0x00, 0x00, 0x09, 0x01, 0x00, 0x01, 0x08,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x05, 0x09, 0x04, 0x01, 0x02, 0x00,
      0x04, 0x08, 0x05, 0x07, 0x04, 0x01,
      0x05, 0x04, 0x02, 0x00,
      0x03, 0x04, 0x03, 0x01, 0x03, 0x02, 0x02, 0x00,
      0x04, 0x06, 0x04, 0x0E, 0x03, 0x05,
      0x00, 0x00,
      0xF7,
    ]);
    const entry = SysExCodec.parseAssignmentResponse(msg);
    expect(entry.block).toBe(0);
    expect(entry.name).toBe('YA HWAT 412 FN5');
  });
});

describe('SysExCodec: parseStateDump', () => {
  it('extracts slot number from first chunk byte[10]', () => {
    // Build a minimal 5-chunk fake with slot=6
    const decoded = buildDecodedPreset('TestPreset', 6);
    // Truncate to 846 bytes for state dump
    const truncated = decoded.slice(0, 846);
    const nibble = SysExCodec.nibbleEncode(truncated);
    // Split into 5 chunks with sub=0x4E
    const chunkSizes = [370, 370, 370, 370, nibble.length - 370 * 4];
    const offsets = [0, 313, 626, 1067, 1380];
    const chunks: Uint8Array[] = [];
    let pos = 0;
    for (let i = 0; i < 5; i++) {
      const nd = nibble.slice(pos, pos + chunkSizes[i]);
      pos += chunkSizes[i];
      const HEADER = [0xF0, 0x21, 0x25, 0x7E, 0x47, 0x50, 0x2D, 0x32, 0x12, 0x4E];
      const offLo = offsets[i] & 0xFF;
      const offHi = (offsets[i] >> 8) & 0xFF;
      chunks.push(new Uint8Array([...HEADER, 6, offLo, offHi, ...Array.from(nd), 0xF7]));
    }
    const result = SysExCodec.parseStateDump(chunks);
    expect(result.slot).toBe(6);
    expect(result.preset.patchName).toBe('TestPreset');
  });

  it('uses slot label as fallback when name is empty', () => {
    const decoded = new Uint8Array(846).fill(0); // no name
    const nibble = SysExCodec.nibbleEncode(decoded);
    const chunkSizes = [370, 370, 370, 370, nibble.length - 370 * 4];
    const offsets = [0, 313, 626, 1067, 1380];
    const chunks: Uint8Array[] = [];
    let pos = 0;
    for (let i = 0; i < 5; i++) {
      const nd = nibble.slice(pos, pos + chunkSizes[i]);
      pos += chunkSizes[i];
      const HEADER = [0xF0, 0x21, 0x25, 0x7E, 0x47, 0x50, 0x2D, 0x32, 0x12, 0x4E];
      const offLo = offsets[i] & 0xFF;
      const offHi = (offsets[i] >> 8) & 0xFF;
      chunks.push(new Uint8Array([...HEADER, 6, offLo, offHi, ...Array.from(nd), 0xF7]));
    }
    const result = SysExCodec.parseStateDump(chunks);
    expect(result.preset.patchName).toBe('2C'); // slot 6 = bank 2, letter C
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/SysExCodec.test.ts --reporter=verbose`
Expected: FAIL — methods don't exist

- [ ] **Step 3: Extract shared chunk assembly helper, implement parsers**

Add to `SysExCodec` in `src/core/SysExCodec.ts`:

```typescript
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
```

Then refactor `parseReadChunks` to use these helpers:

```typescript
parseReadChunks(chunks: Uint8Array[]): GP200Preset {
  const decoded = this.assembleChunks(chunks);
  return this.parsePresetFromDecoded(decoded);
},
```

And add the new parsers:

```typescript
parseStateDump(chunks: Uint8Array[]): { slot: number; preset: GP200Preset } {
  const slot = chunks[0]?.[10] ?? 0;
  const decoded = this.assembleChunks(chunks);
  const fallbackName = this.slotToLabel(slot);
  return { slot, preset: this.parsePresetFromDecoded(decoded, fallbackName) };
},

parseIdentityResponse(msg: Uint8Array): { deviceType: number; firmwareValues: number[] } {
  return {
    deviceType: msg[18],
    firmwareValues: [msg[22], msg[26]],
  };
},

parseVersionResponse(msg: Uint8Array): { accepted: boolean } {
  // Nibble data at bytes [21..32] — if all zero, accepted
  for (let i = 21; i <= 32; i++) {
    if (msg[i] !== 0) return { accepted: false };
  }
  return { accepted: true };
},

parseAssignmentResponse(msg: Uint8Array, section: number, page: number): { section: number; page: number; block: number; name: string; rawData: Uint8Array } {
  const block = msg[22];
  // Nibble data starts at msg[27], decode to get ASCII name
  const nibbleData = msg.slice(27, msg.length - 1);
  const decoded = this.nibbleDecode(nibbleData);
  // Skip leading zeros, extract null-terminated string
  let name = '';
  let nameStart = 0;
  while (nameStart < decoded.length && decoded[nameStart] === 0) nameStart++;
  for (let i = nameStart; i < decoded.length; i++) {
    if (decoded[i] === 0) break;
    name += String.fromCharCode(decoded[i]);
  }
  return { section, page, block, name, rawData: decoded };
},
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/SysExCodec.test.ts --reporter=verbose`
Expected: ALL PASS (including existing parseReadChunks tests — refactored but same behavior)

- [ ] **Step 5: Commit**

```bash
git add src/core/SysExCodec.ts tests/unit/SysExCodec.test.ts
git commit -m "feat: add handshake parsers + shared chunk assembly to SysExCodec"
```

---

## Task 4: Handshake Integration in `useMidiDevice`

**Files:**
- Modify: `src/hooks/useMidiDevice.ts`
- Modify: `tests/unit/useMidiDevice.test.ts`

- [ ] **Step 1: Write handshake flow test**

Add to `tests/unit/useMidiDevice.test.ts`:

```typescript
describe('useMidiDevice handshake', () => {
  it('connect sends identity query as first message', async () => {
    const { result } = renderHook(() => useMidiDevice());
    await act(async () => { result.current.connect(); });
    // After MIDI port discovery, first sent message should be identity query
    await waitFor(() => {
      expect(mockMidi.sentMessages.length).toBeGreaterThan(0);
      const first = mockMidi.sentMessages[0];
      expect(first[8]).toBe(0x11); // CMD
      expect(first[9]).toBe(0x04); // SUB = identity query
    });
  });

  it('transitions through handshaking status', async () => {
    const { result } = renderHook(() => useMidiDevice());
    const statusLog: string[] = [];
    // We can't easily track intermediate status changes in renderHook,
    // but we can verify the final state after handshake timeout
    await act(async () => { result.current.connect(); });
    // Without responding to the identity query, it should eventually error
    await waitFor(() => {
      expect(['handshaking', 'error'].includes(result.current.status)).toBe(true);
    }, { timeout: 5000 });
  });

  it('completes handshake when device responds correctly', async () => {
    const { result } = renderHook(() => useMidiDevice());
    await act(async () => {
      const connectPromise = result.current.connect();

      // Wait for identity query to be sent
      await waitFor(() => expect(mockMidi.sentMessages.length).toBeGreaterThan(0));

      // Respond with identity
      mockMidi.emit(new Uint8Array([
        0xF0, 0x21, 0x25, 0x7E, 0x47, 0x50, 0x2D, 0x32,
        0x12, 0x08,
        0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x00, 0x00,
        0x04, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x02, 0x00, 0x00,
        0xF7,
      ]));

      // Wait for enter editor mode + state dump request
      await waitFor(() => expect(mockMidi.sentMessages.length).toBeGreaterThanOrEqual(3));

      // Emit 5 fake sub=0x4E chunks (minimal)
      const fakeChunk = (offset: number) => new Uint8Array([
        0xF0, 0x21, 0x25, 0x7E, 0x47, 0x50, 0x2D, 0x32,
        0x12, 0x4E, 0x06, offset & 0xFF, (offset >> 8) & 0xFF,
        ...new Array(370).fill(0),
        0xF7,
      ]);
      for (const off of [0, 313, 626, 1067]) mockMidi.emit(fakeChunk(off));
      // Last chunk shorter
      mockMidi.emit(new Uint8Array([
        0xF0, 0x21, 0x25, 0x7E, 0x47, 0x50, 0x2D, 0x32,
        0x12, 0x4E, 0x06, 0x64, 0x05,
        ...new Array(212).fill(0),
        0xF7,
      ]));

      // Respond to version check
      await waitFor(() => {
        const versionReq = mockMidi.sentMessages.find(m => m[9] === 0x0A);
        return expect(versionReq).toBeDefined();
      });
      mockMidi.emit(new Uint8Array([
        0xF0, 0x21, 0x25, 0x7E, 0x47, 0x50, 0x2D, 0x32,
        0x12, 0x0A,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x06, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0xF7,
      ]));

      // Respond to assignment queries with empty responses
      // ... the handshake should eventually complete or we skip assignments on timeout

      await connectPromise;
    });

    await waitFor(() => expect(result.current.status).toBe('connected'), { timeout: 10000 });
    expect(result.current.currentSlot).toBe(6);
  });
});
```

Note: The full handshake test with all assignment responses is complex. The test above covers the critical path. Assignment responses can use shorter timeouts (1000ms) so the test completes quickly even without mock responses.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/useMidiDevice.test.ts --reporter=verbose`
Expected: FAIL — handshaking status doesn't exist, connect doesn't send identity query

- [ ] **Step 3: Implement handshake in `useMidiDevice.ts`**

Key changes:

**3a. Update `UseMidiDeviceReturn` type** (line 27):
```typescript
status: 'disconnected' | 'connecting' | 'handshaking' | 'connected' | 'error';
```

And add new fields to the interface and return:
```typescript
deviceInfo: { deviceType: number; firmwareValues: number[]; versionAccepted: boolean } | null;
currentPreset: GP200Preset | null;
assignments: { section: number; page: number; block: number; name: string; rawData: Uint8Array }[];
```

**3b. Add `waitForResponse()` helper** (module-level function, before the hook):
```typescript
function waitForResponse(
  input: GP200Input,
  output: GP200Output,
  match: (data: Uint8Array) => boolean,
  timeoutMs: number,
  baseHandler: (event: { data: unknown }) => void,
): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      input.onmidimessage = baseHandler;
      reject(new Error('Response timeout'));
    }, timeoutMs);
    input.onmidimessage = (event: { data: unknown }) => {
      const data = getBytes(event.data);
      baseHandler(event); // always forward to base handler
      if (match(data)) {
        clearTimeout(timer);
        input.onmidimessage = baseHandler;
        resolve(data);
      }
    };
  });
}
```

**3c. Add `collectChunks()` helper** (module-level):
Similar pattern but collects N matching messages before resolving.

**3d. Modify `connect()`** to run handshake after port discovery:
Follow spec Section 3.3 sequence. Steps 1-8 use 3000ms timeout. Step 9 (assignments) uses 1000ms timeout per query, skips on failure. Assignment loop: Section 0 pages 0-1 (16+4 blocks), Section 1 page 0 (10 blocks).

**3e. Refactor `pullPreset()` and `loadPresetNames()`** to use `waitForResponse`/`collectChunks`, removing duplicated callback patterns.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/useMidiDevice.test.ts --reporter=verbose`
Expected: ALL PASS

- [ ] **Step 5: Rewrite mock and fix existing tests**

**5a. Fix `makeMockMidi` handler replacement** — The current mock pushes handlers into an array (line 14). The real device uses last-writer-wins. Rewrite:

```typescript
function makeMockMidi() {
  let currentHandler: MIDIMessageHandler | null = null;
  const mockInput = {
    name: 'GP-200 MIDI 1',
    get onmidimessage() { return currentHandler; },
    set onmidimessage(handler: MIDIMessageHandler | null) {
      currentHandler = handler;
    },
  };
  const sentMessages: Uint8Array[] = [];
  const mockOutput = {
    name: 'GP-200 MIDI 1',
    send: vi.fn((data: number[] | Uint8Array) => {
      sentMessages.push(new Uint8Array(data));
    }),
  };
  const access = {
    inputs: { values: () => [mockInput] },
    outputs: { values: () => [mockOutput] },
  };
  function emit(data: Uint8Array) {
    if (currentHandler) currentHandler({ data });
  }
  return { access, mockInput, mockOutput, sentMessages, emit };
}
```

**5b. Add `enableAutoHandshake()`** — auto-responds to handshake messages so existing tests that call `connect()` still reach `'connected'`:

```typescript
function enableAutoHandshake(mock: ReturnType<typeof makeMockMidi>) {
  const origSend = mock.mockOutput.send;
  mock.mockOutput.send = vi.fn((data: number[] | Uint8Array) => {
    origSend(data);
    const d = new Uint8Array(data);
    if (d[8] === 0x11 && d[9] === 0x04 && d[14] === 0x01) {
      // Identity query → respond with identity
      setTimeout(() => mock.emit(new Uint8Array([
        0xF0,0x21,0x25,0x7E,0x47,0x50,0x2D,0x32,0x12,0x08,
        0x00,0x00,0x00,0x00,0x01,0x02,0x00,0x00,0x04,0x00,
        0x00,0x00,0x01,0x00,0x00,0x00,0x02,0x00,0x00,0xF7,
      ])), 1);
    }
    if (d[8] === 0x11 && d[9] === 0x04 && d[14] === 0x06) {
      // State dump request → respond with 5 minimal 0x4E chunks
      setTimeout(() => {
        for (const off of [0, 313, 626, 1067]) {
          mock.emit(new Uint8Array([
            0xF0,0x21,0x25,0x7E,0x47,0x50,0x2D,0x32,0x12,0x4E,
            0x09, off & 0xFF, (off >> 8) & 0xFF,
            ...new Array(370).fill(0), 0xF7,
          ]));
        }
        mock.emit(new Uint8Array([
          0xF0,0x21,0x25,0x7E,0x47,0x50,0x2D,0x32,0x12,0x4E,
          0x09, 0x64, 0x05,
          ...new Array(212).fill(0), 0xF7,
        ]));
      }, 1);
    }
    if (d[8] === 0x11 && d[9] === 0x0A) {
      // Version check → respond accepted
      setTimeout(() => mock.emit(new Uint8Array([
        0xF0,0x21,0x25,0x7E,0x47,0x50,0x2D,0x32,0x12,0x0A,
        0x00,0x00,0x00,0x00,0x00,0x01,0x00,0x00,0x06,0x00,0x00,
        0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
        0xF7,
      ])), 1);
    }
    if (d[8] === 0x11 && d[9] === 0x1C) {
      // Assignment query → respond with empty assignment
      setTimeout(() => mock.emit(new Uint8Array([
        0xF0,0x21,0x25,0x7E,0x47,0x50,0x2D,0x32,0x12,0x1C,
        ...new Array(59).fill(0), 0xF7,
      ])), 1);
    }
  });
}
```

**5c. Update all existing tests** that call `connect()` to use `enableAutoHandshake(mockMidi)` in `beforeEach` so they still reach `'connected'`. The existing test assertions remain valid.

- [ ] **Step 6: Run all tests**

Run: `npx vitest run --reporter=verbose`
Expected: ALL PASS

- [ ] **Step 7: Commit**

```bash
git add src/hooks/useMidiDevice.ts tests/unit/useMidiDevice.test.ts
git commit -m "feat: implement MIDI handshake sequence in connect()"
```

---

## Task 5: UI Updates (DeviceStatusBar + i18n)

**Files:**
- Modify: `src/components/DeviceStatusBar.tsx`
- Modify: `messages/en.json`
- Modify: `messages/de.json`

- [ ] **Step 1: Add i18n strings**

In `messages/en.json`, add to the `"device"` section:

```json
"handshaking": "Initializing…",
"firmware": "FW {version}",
"versionWarning": "Unsupported firmware"
```

In `messages/de.json`, add to the `"device"` section:

```json
"handshaking": "Initialisierung…",
"firmware": "FW {version}",
"versionWarning": "Firmware nicht unterstützt"
```

- [ ] **Step 2: Update DeviceStatusBar**

In `src/components/DeviceStatusBar.tsx`:

1. Add `'handshaking'` to LED color map (line 30-34):
```typescript
const ledColor =
  status === 'connected'    ? 'var(--accent-green)' :
  status === 'connecting'   ? 'var(--accent-amber)' :
  status === 'handshaking'  ? 'var(--accent-amber)' :
  status === 'error'        ? 'var(--accent-red)'   :
  '#555';
```

2. Add handshaking status text block (after the `connecting` block, line 67-70):
```typescript
{status === 'handshaking' && (
  <span className="font-mono-display" style={{ color: 'var(--accent-amber)' }}>
    {t('handshaking')}
  </span>
)}
```

3. Add animation for handshaking LED (line 57):
```typescript
animation: (status === 'connecting' || status === 'handshaking') ? 'pulse 1s infinite' : 'none',
```

4. Show firmware version in connected status (line 73-79). Access `deviceInfo` from `midiDevice` prop:
```typescript
{status === 'connected' && (
  <span className="font-mono-display" style={{ color: 'var(--accent-green)', fontSize: '0.8em' }}>
    GP-200
    {midiDevice.deviceInfo && (
      <span style={{ color: 'var(--text-muted)', marginLeft: 4, fontSize: '0.9em' }}>
        {t('firmware', { version: midiDevice.deviceInfo.firmwareValues.join('.') })}
      </span>
    )}
    <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>
      · Slot <strong style={{ color: 'var(--accent-amber)' }}>{slotLabel}</strong>
      {slotName}
    </span>
  </span>
)}
```

5. Update `UseMidiDeviceReturn` type import to include `'handshaking'` in status (this was done in Task 4).

- [ ] **Step 3: Run dev server and verify visually**

Run: `npm run dev`
Navigate to `/editor`, verify:
- Without device: shows "No device" with Connect button
- Status bar accepts the `handshaking` status without TypeScript errors

- [ ] **Step 4: Commit**

```bash
git add src/components/DeviceStatusBar.tsx messages/en.json messages/de.json
git commit -m "feat: DeviceStatusBar handshake progress + firmware display"
```

---

## Task 6: Editor Auto-Load from State Dump

**Files:**
- Modify: `src/app/[locale]/editor/page.tsx`

- [ ] **Step 1: Add auto-load effect**

In `editor/page.tsx`, after the existing `useEffect` for disconnect cleanup (line 32-34), add:

```typescript
// Auto-load current preset from device after handshake
useEffect(() => {
  if (midiDevice.currentPreset && !preset) {
    loadPreset(midiDevice.currentPreset);
  }
}, [midiDevice.currentPreset, preset, loadPreset]);
```

This only auto-loads if the editor doesn't already have a preset loaded (e.g. from file upload).

- [ ] **Step 2: Run build to verify no type errors**

Run: `npx next build`
Expected: Build succeeds (or at least no TypeScript errors in editor/page.tsx)

- [ ] **Step 3: Commit**

```bash
git add src/app/[locale]/editor/page.tsx
git commit -m "feat: auto-load current preset from device after handshake"
```

---

## Task 7: Final Integration Test + Cleanup

- [ ] **Step 1: Run all unit tests**

Run: `npx vitest run --reporter=verbose`
Expected: ALL PASS

- [ ] **Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 4: Commit any remaining fixes**

If any tests or build issues were found and fixed, commit them.

- [ ] **Step 5: Update memory**

Update `project_usb_capture.md` to reflect that the handshake is now implemented.
