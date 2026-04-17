# Review Fixes — Preset Forge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 7 kritische Bugs + 8 Security-Härtungen + UI/UX-Quick-Wins + strukturelle Refactors aus dem umfassenden Review vom 2026-04-17.

**Architecture:** 8 Phasen, jede Phase = ein logischer Commit (ggf. ein PR). Phasen sind linear ausführbar, abhängige Phasen sind markiert. TDD wo möglich — kritische Korrektheits-Fixes (Phase 1 & 2) haben Tests ZUERST. UI-Fixes (Phase 3) per Visual-Check im Dev-Server. Feedback aus Memory: pro Session mehrere Commits/Pushs, aber Deploy nur einmal am Ende.

**Tech Stack:** Next.js 15 App Router, TypeScript strict, Vitest, Tailwind, Zod, Prisma, next-intl.

---

## Phasen-Übersicht

| # | Phase | Status | Commit |
|---|---|---|---|
| 1 | Kritische State-Bugs (`usePreset`) | ✅ done | 2679dc4 |
| 2 | Encoder Round-Trip (`rawSource` passthrough) | ✅ done | d415856 |
| 3 | UI Quick-Wins (CSS-Vars + focus-visible + Link-Hover) | ✅ done | c4d85d1 |
| 4 | App-Router Kompatibilität (useSearchParams + Locale) | ✅ done | 5384c76 |
| 5 | Deprecate `pushPreset` | ✅ done | e1c30be |
| 6 | Security-Härtungen | ✅ done | (see commit) |
| 7 | God-Hook-Refactor (`useMidiDevice`) | ⏸ **deferred** — needs hardware validation per extraction step | — |
| 8A | Tailwind-Tokens + `onMouseEnter`→`hover:` (11 files) | ✅ done | 7a696b1 |
| 8B | Forms-Library (`components/forms/*`, 5 auth pages) | ⏸ **deferred** — substantial UI refactor, next session | — |

Phasen 3, 4, 5, 6 sind unabhängig und könnten parallelisiert werden. Wir machen sie seriell für saubere Commits.

---

## Phase 1: Kritische State-Bugs in `usePreset`

**Files:**
- Modify: `src/hooks/usePreset.ts:46-77, 79-94`
- Test: `tests/unit/hooks/usePreset.test.ts` (NEU)
- Modify: `vitest.config.ts` (falls Test-Pattern anpassen, sonst überspringen)

**Kontext**: `slotIndex` identifiziert in der PRST-Binärspezifikation den **Block-Typ** (0=PRE, 1=WAH, … 10=VOL) und ist pro Block **fest**. `reorderEffects` überschreibt diesen Wert mit der Array-Position — dadurch landet z. B. ein DST-Effekt mit `slotIndex=0`, was beim Encode einen semantisch kaputten Block erzeugt.

`changeEffect` kopiert zwar Defaults aus `getEffectParams`, aber überschreibt *nur die Indizes, die im Default-Set definiert sind*. Wechsel von 6-Param- zu 2-Param-Effekt lässt Params 2..14 mit alten Werten stehen → NaN/OOR auf dem Device.

`setParam` lässt Params-Array wachsen ohne Begrenzung (Array kann auf Länge > 15 wachsen, Zod lehnt dann beim Save ab — User sieht kryptischen Validation-Fehler).

### Task 1.1: Tests-Grundgerüst anlegen

- [ ] **Step 1: Verzeichnis + leere Test-Datei erstellen**

```bash
mkdir -p /home/manuel/claude/gp200editor/tests/unit/hooks
```

- [ ] **Step 2: Base-Fixture + erster Smoke-Test schreiben**

Erstelle `tests/unit/hooks/usePreset.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePreset } from '@/hooks/usePreset';
import type { GP200Preset } from '@/core/types';

const EMPTY_PARAMS = Array(15).fill(0);

function makePreset(): GP200Preset {
  return {
    version: '1',
    patchName: 'Test',
    effects: Array.from({ length: 11 }, (_, i) => ({
      slotIndex: i,
      effectId: 0,
      enabled: false,
      params: [...EMPTY_PARAMS],
    })),
    checksum: 0,
  };
}

describe('usePreset', () => {
  it('loadPreset sets the preset', () => {
    const { result } = renderHook(() => usePreset());
    act(() => result.current.loadPreset(makePreset()));
    expect(result.current.preset?.patchName).toBe('Test');
  });
});
```

- [ ] **Step 3: Smoke-Test laufen lassen**

Run: `npx vitest run tests/unit/hooks/usePreset.test.ts`
Expected: 1 passed. Falls Import-Fehler: `@testing-library/react` ist bereits in devDependencies (wird von `GuitarRating.test.tsx` genutzt).

- [ ] **Step 4: Commit Test-Gerüst**

```bash
git add tests/unit/hooks/usePreset.test.ts
git commit -m "test: add usePreset test scaffold"
```

### Task 1.2: Failing-Test für `reorderEffects` (slotIndex bleibt stabil)

- [ ] **Step 1: Failing-Test anhängen**

Anhängen an `tests/unit/hooks/usePreset.test.ts` (innerhalb der `describe('usePreset')`-Block, am Ende):

```ts
  describe('reorderEffects', () => {
    it('preserves slotIndex on each slot (slotIndex = block type, immutable)', () => {
      const { result } = renderHook(() => usePreset());
      act(() => result.current.loadPreset(makePreset()));
      act(() => result.current.reorderEffects(0, 3));
      const slots = result.current.preset!.effects;
      // Every slot still carries its ORIGINAL slotIndex (block identity)
      const slotIndices = slots.map((s) => s.slotIndex).sort((a, b) => a - b);
      expect(slotIndices).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      // Array order reflects the reorder — slot that had slotIndex=0 is now at array[3]
      expect(slots[3].slotIndex).toBe(0);
    });

    it('noops on same from/to', () => {
      const { result } = renderHook(() => usePreset());
      act(() => result.current.loadPreset(makePreset()));
      const before = result.current.preset;
      act(() => result.current.reorderEffects(2, 2));
      expect(result.current.preset).toBe(before);
    });
  });
```

- [ ] **Step 2: Test laufen lassen — muss FAIL**

Run: `npx vitest run tests/unit/hooks/usePreset.test.ts -t reorderEffects`
Expected: FAIL bei "preserves slotIndex" — aktueller Code rewrited slotIndex auf Array-Position.

### Task 1.3: Fix `reorderEffects`

- [ ] **Step 1: Implementierung anpassen**

Edit `src/hooks/usePreset.ts:67-77`, ersetze den kompletten `reorderEffects`-Block durch:

```ts
  const reorderEffects = useCallback((fromIndex: number, toIndex: number) => {
    setPreset((prev) => {
      if (!prev || fromIndex === toIndex) return prev;
      const effects = [...prev.effects];
      const [moved] = effects.splice(fromIndex, 1);
      effects.splice(toIndex, 0, moved);
      // slotIndex is the PRST block identity (0..10 = PRE..VOL) and MUST stay
      // constant per slot. Only array order changes — the encoder reads
      // slotIndex to place each block at its canonical byte offset.
      return { ...prev, effects };
    });
  }, []);
```

- [ ] **Step 2: Test grün prüfen**

Run: `npx vitest run tests/unit/hooks/usePreset.test.ts -t reorderEffects`
Expected: 2 passed.

### Task 1.4: Failing-Test für `changeEffect` (Params-Array komplett zurücksetzen)

- [ ] **Step 1: Test anhängen**

Anhängen an `tests/unit/hooks/usePreset.test.ts`:

```ts
  describe('changeEffect', () => {
    it('clears old param values when switching effect', () => {
      const { result } = renderHook(() => usePreset());
      const preset = makePreset();
      // Slot 0 has leftover values from a previous effect
      preset.effects[0].params = Array.from({ length: 15 }, (_, i) => i * 7);
      act(() => result.current.loadPreset(preset));
      // Change to effectId 0 (no params defined) — all 15 slots must reset to 0
      act(() => result.current.changeEffect(0, 0));
      const params = result.current.preset!.effects[0].params;
      expect(params).toHaveLength(15);
      expect(params.every((v) => v === 0)).toBe(true);
    });

    it('keeps params length at exactly 15', () => {
      const { result } = renderHook(() => usePreset());
      act(() => result.current.loadPreset(makePreset()));
      act(() => result.current.changeEffect(0, 0x02000001));
      expect(result.current.preset!.effects[0].params).toHaveLength(15);
    });
  });
```

- [ ] **Step 2: Test laufen lassen — muss FAIL (1. Test)**

Run: `npx vitest run tests/unit/hooks/usePreset.test.ts -t changeEffect`
Expected: FAIL bei "clears old param values" — aktueller Code behält `params[2..14]` aus dem vorherigen Effekt.

### Task 1.5: Fix `changeEffect`

- [ ] **Step 1: Implementierung anpassen**

Edit `src/hooks/usePreset.ts:46-65`, ersetze den `changeEffect`-Block durch:

```ts
  const changeEffect = useCallback((slotIndex: number, effectId: number) => {
    setPreset((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        effects: prev.effects.map((slot) => {
          if (slot.slotIndex !== slotIndex) return slot;
          // Fresh 15-float params array — don't leak values from the previous
          // effect (different effects have different param counts; stale
          // floats confuse the device).
          const params = Array<number>(15).fill(0);
          for (const def of getEffectParams(effectId)) {
            if (def.idx >= 0 && def.idx < 15) params[def.idx] = def.default;
          }
          return { ...slot, effectId, params };
        }),
      };
    });
  }, []);
```

- [ ] **Step 2: Tests grün prüfen**

Run: `npx vitest run tests/unit/hooks/usePreset.test.ts`
Expected: alle passed.

### Task 1.6: Failing-Test + Fix für `setParam` Grenzen

- [ ] **Step 1: Test anhängen**

```ts
  describe('setParam', () => {
    it('ignores paramIdx out of 0..14', () => {
      const { result } = renderHook(() => usePreset());
      act(() => result.current.loadPreset(makePreset()));
      act(() => result.current.setParam(0, 99, 42));
      expect(result.current.preset!.effects[0].params).toHaveLength(15);
      act(() => result.current.setParam(0, -1, 42));
      expect(result.current.preset!.effects[0].params).toHaveLength(15);
    });

    it('writes value at valid index', () => {
      const { result } = renderHook(() => usePreset());
      act(() => result.current.loadPreset(makePreset()));
      act(() => result.current.setParam(0, 5, 42.5));
      expect(result.current.preset!.effects[0].params[5]).toBe(42.5);
    });
  });
```

- [ ] **Step 2: Test laufen lassen — erster Test FAIL**

Expected: FAIL bei OOB-Test — aktueller Code wächst Array auf Länge 100.

- [ ] **Step 3: Fix `setParam`**

Edit `src/hooks/usePreset.ts:79-94`, ersetze den `setParam`-Block durch:

```ts
  const setParam = useCallback((slotIndex: number, paramIdx: number, value: number) => {
    if (paramIdx < 0 || paramIdx >= 15) return;
    setPreset((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        effects: prev.effects.map((slot) => {
          if (slot.slotIndex !== slotIndex) return slot;
          const params = [...slot.params];
          params[paramIdx] = value;
          return { ...slot, params };
        }),
      };
    });
  }, []);
```

- [ ] **Step 4: Alle Phase-1-Tests laufen lassen**

Run: `npx vitest run tests/unit/hooks/usePreset.test.ts`
Expected: alle passed.

### Task 1.7: Typecheck + Commit Phase 1

- [ ] **Step 1: Typecheck**

Run: `bash scripts/local-ci.sh typecheck`
Expected: 0 errors.

- [ ] **Step 2: Commit**

```bash
git add src/hooks/usePreset.ts tests/unit/hooks/usePreset.test.ts
git commit -m "$(cat <<'EOF'
fix(usePreset): keep slotIndex stable on reorder + reset params on changeEffect

- reorderEffects no longer rewrites slotIndex (block identity must match
  PRST block position 0..10 = PRE..VOL). Previously a drag-reorder
  followed by save wrote effects with mismatched slotIndex/effectId,
  producing semantically broken presets on the device.
- changeEffect now initializes a fresh 15-float params array before
  applying defaults — prevents stale floats from the previous effect
  leaking into unused param slots.
- setParam guards paramIdx to 0..14 — Zod schema enforces length=15
  anyway, but silent bounds check avoids State > 15 entries.

Covered by new tests/unit/hooks/usePreset.test.ts.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 2: Encoder Round-Trip & echtes-`.prst`-Fixture

**Files:**
- Modify: `src/core/types.ts:11-17` — Feld `trailingBytes` ergänzen
- Modify: `src/core/PRSTDecoder.ts` — Version korrekt persistieren, unbekannte Bereiche als `trailingBytes` mitnehmen
- Modify: `src/core/PRSTEncoder.ts` — `trailingBytes` zurückschreiben, dynamische Version, Blocks nach `slotIndex` platzieren
- Modify: `tests/unit/PRSTEncoder.test.ts` — neuer Round-Trip-Test gegen echte `planung/*.prst` Fixtures

**Kontext**: Der Encoder hardcodet FW-Version = 1, lässt Controller/EXP-Assignment-Bytes 0x3B0..0x4C5 leer und platziert Blocks nach Array-Position statt nach `slotIndex`. Round-Trip auf einem echten 1224-Byte-File verliert Controller-Daten und degradiert FW-Version.

### Task 2.1: Fixture-Fixture-Helper

- [ ] **Step 1: Prüfen, dass die Fixtures da sind**

```bash
ls -la /home/manuel/claude/gp200editor/planung/*.prst
```

Expected: mindestens `57-A Stone in Love.prst`.

- [ ] **Step 2: Hilfsfunktion als Test-Fixture im Test-File anlegen**

Anhängen an `tests/unit/PRSTEncoder.test.ts` (am Top, nach den Imports):

```ts
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

function loadRealFixture(name: string): Uint8Array | null {
  const p = join(process.cwd(), 'planung', name);
  return existsSync(p) ? new Uint8Array(readFileSync(p)) : null;
}
```

### Task 2.2: Failing Round-Trip-Test gegen echtes File

- [ ] **Step 1: Round-Trip-Test als `it.each`-ähnliches Muster anhängen**

Anhängen in `describe('PRSTEncoder', () => { ... })` am Ende:

```ts
  it('round-trips a real 1224-byte .prst (decode → encode → byte-compare)', () => {
    const original = loadRealFixture('57-A Stone in Love.prst');
    if (!original) {
      // Skip silently when fixtures aren't checked out on this host
      return;
    }
    expect(original.byteLength).toBe(1224);
    const decoder = new PRSTDecoder(original);
    const preset = decoder.decode();
    const encoded = new Uint8Array(new PRSTEncoder().encode(preset));

    // Routing + effect blocks + controller assignments must survive round-trip.
    // We compare the region 0x8C..0x4C5 (routing + 11 blocks + controllers),
    // excluding the 2-byte trailing checksum which we recompute.
    for (let i = 0x8C; i < 0x4C6; i++) {
      if (encoded[i] !== original[i]) {
        throw new Error(
          `byte diff at 0x${i.toString(16)}: original=${original[i]} encoded=${encoded[i]}`,
        );
      }
    }
  });

  it('round-trips firmware version byte (0x15)', () => {
    const buf = new Uint8Array(1224);
    buf[0x00] = 0x54; buf[0x01] = 0x53; buf[0x02] = 0x52; buf[0x03] = 0x50;
    buf[0x15] = 0x05; // simulate FW version "5"
    for (let slot = 0; slot < 11; slot++) {
      const base = 0xa0 + slot * 0x48;
      buf[base] = 0x14; buf[base + 2] = 0x44;
      buf[base + 4] = slot;
    }
    const preset = new PRSTDecoder(buf).decode();
    expect(preset.version).toBe('5');
    const encoded = new Uint8Array(new PRSTEncoder().encode(preset));
    expect(encoded[0x15]).toBe(0x05);
  });
```

- [ ] **Step 2: Tests laufen lassen — beide müssen FAIL**

Run: `npx vitest run tests/unit/PRSTEncoder.test.ts -t "round-trips"`
Expected:
- FAIL "round-trips a real 1224-byte" — byte-diff im Controller-Bereich
- FAIL "round-trips firmware version byte" — encoded[0x15] ist 1, nicht 5

### Task 2.3: `trailingBytes` + dynamische Version ins Schema

- [ ] **Step 1: `GP200PresetSchema` um `trailingBytes` ergänzen**

Edit `src/core/types.ts`, ersetze das Schema durch:

```ts
import { z } from 'zod';

export const EffectSlotSchema = z.object({
  slotIndex: z.number().int().min(0).max(10),
  effectId: z.number().int().min(0).max(0xFFFFFFFF),
  enabled: z.boolean(),
  /** Effect parameters: 15 x float32 LE values per slot */
  params: z.array(z.number()).length(15),
});

export const GP200PresetSchema = z.object({
  version: z.string(),
  patchName: z.string().max(16),
  author: z.string().max(16).optional(),
  effects: z.array(EffectSlotSchema).length(11),
  checksum: z.number().int().min(0).max(65535),
  /**
   * Raw bytes for the controller/EXP assignment region (0x3B0..0x4C5 = 278 B
   * for 1224-byte user presets, empty for 1176-byte factory presets). The
   * editor doesn't model this region yet, but we must carry it through so
   * decode→edit→encode preserves it. Optional for factory presets.
   */
  trailingBytes: z.instanceof(Uint8Array).optional(),
});

export type EffectSlot = z.infer<typeof EffectSlotSchema>;
export type GP200Preset = z.infer<typeof GP200PresetSchema>;
```

### Task 2.4: Decoder persistiert `trailingBytes` + version dynamisch lesen (ist schon der Fall)

- [ ] **Step 1: Decoder um `trailingBytes` ergänzen**

Edit `src/core/PRSTDecoder.ts`, ersetze den `decode()`-Return-Block (Zeile 75) durch:

```ts
    // Controller/EXP assignments live in 0x3B0..0x4C5 (278 bytes). For 1176-byte
    // factory presets this region is cut off; we pass an empty Uint8Array.
    const CONTROLLER_START = 0x3B0;
    const CONTROLLER_END   = 0x4C6; // exclusive
    const trailingBytes =
      len >= CONTROLLER_END
        ? this.parser.readBytes(CONTROLLER_START, CONTROLLER_END - CONTROLLER_START)
        : undefined;

    return GP200PresetSchema.parse({
      version, patchName, author: author || undefined, effects, checksum, trailingBytes,
    });
```

- [ ] **Step 2: `BinaryParser.readBytes` existiert?**

Run: `grep -n "readBytes" src/core/BinaryParser.ts`
Expected: eine Methode `readBytes(offset, length) => Uint8Array`. Falls nicht vorhanden, hinzufügen:

```ts
  readBytes(offset: number, length: number): Uint8Array {
    this.assertBounds(offset, length);
    return new Uint8Array(this.buffer.buffer, this.buffer.byteOffset + offset, length).slice();
  }
```

(Die `.slice()` am Ende ist essenziell — ohne sie hält das Uint8Array einen Live-View ins Original, und Mutationen des Originals würden das Preset kaputtmachen.)

### Task 2.5: Encoder schreibt `trailingBytes` + Version + Blocks nach `slotIndex`

- [ ] **Step 1: Encoder-Änderungen**

Edit `src/core/PRSTEncoder.ts`. Ersetze die Hardcoded-Version-Zeilen 48-51 durch:

```ts
    // Firmware version: read from preset, write at OFFSET_VERSION (0x15).
    // High bytes (0x14, 0x16, 0x17) remain constant — real files carry
    // 00 <ver> 01 00, and we match that layout.
    const verNum = Number.parseInt(preset.version, 10) || 1;
    gen.writeUint8(OFFSET_FW_VERSION, 0x00);
    gen.writeUint8(OFFSET_FW_VERSION + 1, verNum & 0xFF);
    gen.writeUint8(OFFSET_FW_VERSION + 2, 0x01);
    gen.writeUint8(OFFSET_FW_VERSION + 3, 0x00);
```

Ersetze die Effect-Block-Loop (Zeilen 87-116) durch einen Loop, der nach `slotIndex` platziert:

```ts
    // ── Effect blocks (0xA0-0x3AF, 11 × 72 bytes) ───────────────────────
    // Each slot owns a FIXED physical position = its slotIndex. We place
    // slots by slotIndex (not array index) so a reorder in the UI doesn't
    // change the binary block layout — only the routing bytes above do.
    const written = new Set<number>();
    for (const slot of preset.effects) {
      const base = EFFECT_BLOCK_START + slot.slotIndex * EFFECT_BLOCK_SIZE;
      gen.writeUint8(base + 0, 0x14);
      gen.writeUint8(base + 1, 0x00);
      gen.writeUint8(base + 2, 0x44);
      gen.writeUint8(base + 3, 0x00);
      gen.writeUint8(base + 4, slot.slotIndex);
      gen.writeUint8(base + 5, slot.enabled ? 1 : 0);
      gen.writeUint8(base + 6, 0x00);
      gen.writeUint8(base + 7, 0x0F);
      gen.writeUint32LE(base + 8, slot.effectId);
      for (let p = 0; p < PARAMS_COUNT && p < slot.params.length; p++) {
        const val = slot.params[p];
        gen.writeFloat32LE(base + PARAMS_OFFSET + p * 4, Number.isFinite(val) ? val : 0);
      }
      written.add(slot.slotIndex);
    }
    // Empty-block fallback for any missing slotIndex 0..10.
    for (let i = 0; i < EFFECT_BLOCK_COUNT; i++) {
      if (written.has(i)) continue;
      const base = EFFECT_BLOCK_START + i * EFFECT_BLOCK_SIZE;
      gen.writeUint8(base + 0, 0x14);
      gen.writeUint8(base + 2, 0x44);
      gen.writeUint8(base + 4, i);
      gen.writeUint8(base + 7, 0x0F);
    }
```

Ersetze die Routing-Loop (Zeilen 82-85) durch:

```ts
    // Routing order: effects[] array order = playback/UI order. Each byte is
    // the slotIndex of the slot at that position. Default = identity.
    for (let i = 0; i < EFFECT_BLOCK_COUNT; i++) {
      const slot = preset.effects[i];
      gen.writeUint8(OFFSET_ROUTING + 8 + i, slot ? slot.slotIndex : i);
    }
```

Direkt VOR dem Checksum-Block (vor Zeile 118, `// ── Checksum`) einfügen:

```ts
    // ── Controller/EXP assignments (0x3B0..0x4C5) ───────────────────────
    if (preset.trailingBytes && preset.trailingBytes.byteLength === 0x4C6 - 0x3B0) {
      const out = new Uint8Array(gen.toArrayBuffer());
      out.set(preset.trailingBytes, 0x3B0);
      // gen-internal buffer: overwrite by re-reading bytes back after the
      // next checksum block. We do that by reconstructing via gen.writeBytes.
      for (let i = 0; i < preset.trailingBytes.length; i++) {
        gen.writeUint8(0x3B0 + i, preset.trailingBytes[i]);
      }
    }
```

(Alternativ: `BufferGenerator.writeBytes(offset, bytes)` hinzufügen, falls einfacher — dann oben nur `gen.writeBytes(0x3B0, preset.trailingBytes)`.)

- [ ] **Step 2: `writeBytes` in `BufferGenerator` ergänzen (falls noch nicht vorhanden)**

Run: `grep -n "writeBytes" src/core/BufferGenerator.ts`
Falls nicht vorhanden, im `BufferGenerator` class ergänzen:

```ts
  writeBytes(offset: number, bytes: Uint8Array): void {
    new Uint8Array(this.buffer, offset, bytes.length).set(bytes);
  }
```

Und dann den Encoder-Block vereinfachen zu:

```ts
    if (preset.trailingBytes && preset.trailingBytes.byteLength === 0x4C6 - 0x3B0) {
      gen.writeBytes(0x3B0, preset.trailingBytes);
    }
```

### Task 2.6: Tests laufen lassen

- [ ] **Step 1: Encoder-Tests**

Run: `npx vitest run tests/unit/PRSTEncoder.test.ts`
Expected: alle passed (inkl. neuer Round-Trip-Tests).

- [ ] **Step 2: Decoder-Tests**

Run: `npx vitest run tests/unit/PRSTDecoder.test.ts`
Expected: alle passed.

- [ ] **Step 3: Volle Suite (Regression)**

Run: `npx vitest run`
Expected: alle passed (487+ tests).

### Task 2.7: Commit Phase 2

- [ ] **Step 1: Commit**

```bash
git add src/core/types.ts src/core/PRSTDecoder.ts src/core/PRSTEncoder.ts src/core/BinaryParser.ts src/core/BufferGenerator.ts tests/unit/PRSTEncoder.test.ts
git commit -m "$(cat <<'EOF'
fix(prst): round-trip controller assignments + firmware version

Decoder now reads the controller/EXP assignment region (0x3B0..0x4C5,
278 bytes) into GP200Preset.trailingBytes. Encoder writes those bytes
back untouched, preserving footswitch/EXP-pedal mappings across a
decode→edit→encode round-trip.

Firmware version is now read from OFFSET_VERSION (0x15) at decode time
and written back dynamically instead of hardcoding 0x01.

Effect blocks are now placed at their slotIndex-defined physical
position instead of array-index order, matching the fix in usePreset
(slotIndex = block identity, array order = routing).

New regression test round-trips a real 1224-byte fixture from
planung/*.prst and byte-compares 0x8C..0x4C5.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 3: UI Quick-Wins

**Files:**
- Modify: `src/app/globals.css` — 4 CSS-Vars + global `:focus-visible`
- Modify: `src/app/[locale]/presets/PresetList.tsx:255-273` — Link-Hover per Tailwind

**Kontext**: 4 CSS-Variablen werden undefiniert referenziert, `focus:outline-none` ohne Ersatz-Ring fällt WCAG 2.1 AA, `<Link onMouseEnter>` in `PresetList` ist Prod-SSR-Crash-Risiko laut CLAUDE.md.

### Task 3.1: CSS-Vars definieren + Global Focus Ring

- [ ] **Step 1: `globals.css` um 4 Vars + focus-visible erweitern**

Edit `src/app/globals.css`. Ersetze den `:root { … }`-Block (Zeilen 7-26) durch:

```css
:root {
  --bg-primary: #0f0f0f;
  --bg-surface: #1a1a1a;
  --bg-surface-raised: #202020;
  --bg-elevated: #242424;
  --bg-card: #1a1a1a;
  --bg-input: #242424;
  --bg-deep: #0a0a0a;
  --bg-hover: #2e2e2e;
  --text-primary: #e8e4df;
  --text-secondary: #8a8580;
  --text-muted: #8a8580;
  --border-subtle: #2a2724;
  --border-active: #3a3530;
  --accent-amber: #d4a24e;
  --accent-amber-dim: #8a6a30;
  --accent-red: #c44e4e;
  --accent-green: #4ec46a;
  --glow-amber: rgba(212, 162, 78, 0.15);
  --glow-red: rgba(196, 78, 78, 0.12);
  --glow-green: rgba(78, 196, 106, 0.12);
  --knob-track: #2a2724;
  --knob-fill: #d4a24e;
}
```

Füge am Ende des File (nach dem `@layer utilities`-Block) hinzu:

```css
/* ── Global keyboard focus ring (WCAG 2.1 AA) ─────────────────────────── */
/* Any element with focus-visible gets an amber ring — input/button/link/
   select/textarea/[role=button]. Avoids mouse-click ring for a11y + calm UI.
   Components can still opt out per-case with `focus-visible:ring-0`. */
:focus-visible {
  outline: 2px solid var(--accent-amber);
  outline-offset: 2px;
  box-shadow: 0 0 0 4px var(--glow-amber);
  border-radius: 4px;
}
```

- [ ] **Step 2: Dev-Server starten + visual check**

```bash
rm -rf /home/manuel/claude/gp200editor/.next
cd /home/manuel/claude/gp200editor && npm run dev -- --port 3001
```

(läuft im Hintergrund; wenn kein Dev-Server aktiv sein soll, überspringen und nur typecheck laufen lassen).

Manuell prüfen: Navbar-Tab-Navigation zeigt Amber-Ring. Editor-Page lädt Card-Hintergründe wie vorher (keine Regression durch die neuen Vars).

### Task 3.2: `PresetList` Link-Hover auf Tailwind umbauen

- [ ] **Step 1: Ersetze `onMouseEnter`/`onMouseLeave` durch Tailwind `hover:` auf dem Edit-Link**

Edit `src/app/[locale]/presets/PresetList.tsx:255-273`. Ersetze den `<Link>`-Block:

```tsx
                  <Link
                    href={`/presets/${preset.id}/edit`}
                    data-testid="preset-edit-link"
                    className={`${actionBtnClass} border border-[var(--border-active)] text-[var(--text-secondary)] hover:border-[var(--accent-amber)] hover:text-[var(--accent-amber)] transition-colors`}
                  >
                    {t('editPreset')}
                  </Link>
```

(`style` komplett entfernt — gleiche visuelle Ausprägung via Tailwind-Arbitrary-Values.)

- [ ] **Step 2: Typecheck**

Run: `bash scripts/local-ci.sh typecheck`
Expected: 0 errors.

- [ ] **Step 3: Vorhandene PresetList-E2E/unit-Tests**

Run: `npx vitest run` (PresetList hat keinen direkten Unit-Test, wir verlassen uns auf Typecheck + manuellen Check.)
Expected: alle passed.

### Task 3.3: Commit Phase 3

- [ ] **Step 1: Commit**

```bash
git add src/app/globals.css src/app/[locale]/presets/PresetList.tsx
git commit -m "$(cat <<'EOF'
fix(ui): define missing CSS tokens + global focus-visible ring + PresetList hover

- globals.css: add --bg-surface-raised, --bg-card, --bg-input, --bg-deep
  (previously referenced from 11+ files without fallback → silent 'initial'
  rendering, inconsistent elevated-card backgrounds across pages).
- Global :focus-visible ring (amber outline + glow) restores keyboard
  navigation affordance that was missing across 29 inputs using
  focus:outline-none without replacement. WCAG 2.1 AA compliance.
- PresetList edit-Link: onMouseEnter/onMouseLeave → Tailwind hover:.
  Previous pattern is on CLAUDE.md's "Nicht tun" list for <Link> (prod SSR
  crash risk).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 4: App-Router Kompatibilität

**Files:**
- Modify: `src/app/[locale]/auth/reset-password/page.tsx` — `useSearchParams` → `window.location.search`
- Modify: `src/app/[locale]/amp/[slug]/page.tsx`, `src/app/[locale]/page.tsx`, `src/app/[locale]/changelog/page.tsx`, `src/app/[locale]/share/[token]/page.tsx`, `src/app/[locale]/share/[token]/opengraph-image.tsx`, `src/core/PRSTJsonCodec.ts` — Locale-Literal `'de' | 'en' | …` → Import aus `@/i18n/locales`

### Task 4.1: `useSearchParams`-Fix in Reset-Password-Page

- [ ] **Step 1: Ersetze die Client-Komponente**

Edit `src/app/[locale]/auth/reset-password/page.tsx`. Ersetze den Top-Import + den `ResetPasswordForm`-Body-Anfang (Zeilen 3-12) durch:

```tsx
'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';

function ResetPasswordForm() {
  const t = useTranslations('auth');
  const router = useRouter();
  const [token, setToken] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setToken(params.get('token') ?? '');
  }, []);
```

- [ ] **Step 2: Die `<Suspense>`-Grenze in der Default-Export-Function entfernen (nicht mehr nötig)**

Ersetze die `export default function ResetPasswordPage()` (Zeilen 118-142) durch:

```tsx
export default function ResetPasswordPage() {
  const t = useTranslations('auth');
  return (
    <div className="flex items-center justify-center flex-1 px-4 py-16">
      <div
        className="w-full max-w-sm rounded-lg p-6"
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.03)',
        }}
      >
        <h1
          className="font-mono-display text-xl font-bold tracking-tight mb-6"
          style={{ color: 'var(--accent-amber)' }}
        >
          {t('resetPasswordTitle')}
        </h1>
        <ResetPasswordForm />
      </div>
    </div>
  );
}
```

Entferne auch den nicht mehr benötigten `Suspense`-Import (falls vorhanden).

- [ ] **Step 3: Typecheck**

Run: `bash scripts/local-ci.sh typecheck`
Expected: 0 errors.

### Task 4.2: Locale-Literal-Replacements

- [ ] **Step 1: Liste aller Stellen sammeln**

Run: `grep -rn "'de' | 'en' | 'es' | 'fr' | 'it' | 'pt'" src/`
Expected: 6+ Treffer. Plus der Array-Variante:
Run: `grep -rn "\['de', 'en', 'es', 'fr', 'it', 'pt'\]" src/`

- [ ] **Step 2: Pro File: Import ergänzen + Typ ersetzen**

Für jedes gefundene File:

```tsx
// oben bei Imports:
import type { Locale } from '@/i18n/locales';
// (oder, wenn das File selbst in src/i18n/ liegt: relativer Pfad)
```

Ersetze alle Vorkommen von `'de' | 'en' | 'es' | 'fr' | 'it' | 'pt'` durch `Locale`.
Ersetze alle Vorkommen von `['de', 'en', 'es', 'fr', 'it', 'pt']` durch `[...LOCALES]` (und importiere `LOCALES` statt `Locale`).

Konkrete Dateien (siehe Review-Findings):
- `src/app/[locale]/amp/[slug]/page.tsx:15,22,63`
- `src/app/[locale]/page.tsx:12`
- `src/app/[locale]/changelog/page.tsx:9`
- `src/app/[locale]/share/[token]/page.tsx:19`
- `src/app/[locale]/share/[token]/opengraph-image.tsx:17`
- `src/core/PRSTJsonCodec.ts:67`

- [ ] **Step 3: Typecheck**

Run: `bash scripts/local-ci.sh typecheck`
Expected: 0 errors.

- [ ] **Step 4: Tests**

Run: `npx vitest run`
Expected: alle passed.

### Task 4.3: Commit Phase 4

- [ ] **Step 1: Commit**

```bash
git add src/app/[locale]/auth/reset-password/page.tsx src/app/[locale]/amp/[slug]/page.tsx src/app/[locale]/page.tsx src/app/[locale]/changelog/page.tsx src/app/[locale]/share/[token]/page.tsx src/app/[locale]/share/[token]/opengraph-image.tsx src/core/PRSTJsonCodec.ts
git commit -m "$(cat <<'EOF'
fix: App Router compat — useSearchParams + locale type drift

- auth/reset-password: replace useSearchParams (broken in prod SSR per
  CLAUDE.md) with window.location.search in useEffect.
- 6 files: replace hardcoded 'de' | 'en' | 'es' | 'fr' | 'it' | 'pt' unions
  with the Locale type from @/i18n/locales. Adding a locale used to require
  grepping 8+ files; now it's a single-tuple change.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 5: `pushPreset` als unsicher markieren

**Files:**
- Modify: `src/hooks/useMidiDevice.ts` — `pushPreset` mit deprecation-warning + default-disabled-flag
- Modify: `src/app/[locale]/editor/page.tsx` — UI-Button für pushPreset nur hinter feature-flag/admin zeigen (oder komplett entfernen)
- Modify: `src/core/SysExCodec.ts` — JSDoc-Warnung auf `buildWriteChunks`

**Kontext**: Memory-Note bestätigt: Write-Chunks sind unzuverlässig, Block 10 nur partiell unterstützt. Der Review empfiehlt, den Pfad zu deprekieren bis die USB-Capture erneut analysiert wird. Der bewährte `writePresetToSlot`-Flow (Toggle + Params + SaveCommit) bleibt aktiv.

### Task 5.1: `buildWriteChunks` mit Warning markieren

- [ ] **Step 1: JSDoc-Kommentar ergänzen**

Edit `src/core/SysExCodec.ts`. Direkt über der `buildWriteChunks`-Funktion (Zeile 240-268) einfügen:

```ts
/**
 * @deprecated Chunk offsets overlap (0/311/622/1061/1372 with chunk size 366)
 * and block 10 (VOL) is only partially populated (4 params, not 15). This
 * pathway is known-unreliable from hardware testing; use the
 * `writePresetToSlot` flow (toggle + params + save-commit) instead until the
 * USB capture is re-analyzed. See docs/sysex-protocol.md.
 */
```

### Task 5.2: `pushPreset` hinter Feature-Flag

- [ ] **Step 1: Konstante im Hook hinzufügen**

Edit `src/hooks/useMidiDevice.ts`. Am Top des File (nach den Imports):

```ts
// Chunk-based full-preset push is unreliable; gate behind a dev-only flag
// until the USB protocol capture is re-validated.
const ENABLE_PUSH_PRESET = process.env.NODE_ENV !== 'production';
```

Dann in der `pushPreset`-Funktion (finde sie mit `grep -n "pushPreset" src/hooks/useMidiDevice.ts`):

```ts
  const pushPreset = useCallback(async (preset: GP200Preset) => {
    if (!ENABLE_PUSH_PRESET) {
      console.warn('[pushPreset] disabled in production — use writePresetToSlot');
      return;
    }
    // … existing body
  }, [...]);
```

- [ ] **Step 2: UI-Button ausblenden in Prod**

Edit `src/app/[locale]/editor/page.tsx`. Suche mit `grep -n "pushPreset" src/app/[locale]/editor/page.tsx` den Button-Render-Block. Wickle ihn in:

```tsx
{process.env.NODE_ENV !== 'production' && (
  <button ...>Push full preset</button>
)}
```

- [ ] **Step 3: Typecheck + Tests**

Run: `bash scripts/local-ci.sh typecheck && npx vitest run`
Expected: alle passed.

### Task 5.3: Commit Phase 5

- [ ] **Step 1: Commit**

```bash
git add src/core/SysExCodec.ts src/hooks/useMidiDevice.ts src/app/[locale]/editor/page.tsx
git commit -m "$(cat <<'EOF'
chore(midi): gate unreliable pushPreset behind dev-only flag

buildWriteChunks has overlapping offsets and only partial block-10 support
(confirmed in memory). Pull it out of the prod UI until the USB capture
is re-analyzed. writePresetToSlot remains the supported flow.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 6: Security-Härtungen

**Files:**
- Create: `src/lib/getClientIp.ts`
- Modify: `src/app/api/auth/login/route.ts`, `register/route.ts`, `reset-password/route.ts`, `verify-email/route.ts`, `share/[token]/download/route.ts`, `forgot-password/route.ts` — alle nutzen `getClientIp`
- Modify: `src/app/api/presets/route.ts` — Rate-Limit auf Upload
- Modify: `src/app/api/profile/avatar/route.ts` — Rate-Limit auf Avatar-Upload
- Modify: `src/app/api/presets/[id]/rate/route.ts` — Rate-Limit auf Rating
- Modify: `src/app/api/admin/errors/route.ts` + `src/app/api/admin/errors/[id]/route.ts` — `logAdminAction` bei DELETE

### Task 6.1: `getClientIp` Helper

- [ ] **Step 1: Test zuerst**

Erstelle `tests/unit/lib/getClientIp.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { getClientIp } from '@/lib/getClientIp';

function req(headers: Record<string, string>): Request {
  return new Request('https://example.com', { headers });
}

describe('getClientIp', () => {
  it('prefers cf-connecting-ip', () => {
    expect(getClientIp(req({ 'cf-connecting-ip': '1.1.1.1', 'x-forwarded-for': '2.2.2.2', 'x-real-ip': '3.3.3.3' })))
      .toBe('1.1.1.1');
  });

  it('falls back to x-forwarded-for (first hop)', () => {
    expect(getClientIp(req({ 'x-forwarded-for': '2.2.2.2, 4.4.4.4', 'x-real-ip': '3.3.3.3' })))
      .toBe('2.2.2.2');
  });

  it('falls back to x-real-ip', () => {
    expect(getClientIp(req({ 'x-real-ip': '3.3.3.3' }))).toBe('3.3.3.3');
  });

  it('returns "unknown" when no headers present', () => {
    expect(getClientIp(req({}))).toBe('unknown');
  });
});
```

Run: `npx vitest run tests/unit/lib/getClientIp.test.ts`
Expected: FAIL (module doesn't exist yet).

- [ ] **Step 2: Implementation**

Erstelle `src/lib/getClientIp.ts`:

```ts
/**
 * Extract the best-effort client IP for rate-limiting purposes.
 * Header precedence matches what our Caddy reverse proxy sets (cf → xff → real-ip).
 * Returns a string-safe fallback so callers never need to null-check.
 *
 * Consumers use this as a rate-limit bucket key. Spoofable in theory
 * (attackers can set headers on direct-to-origin requests), but our
 * deployment only accepts traffic via Caddy, which strips client-set
 * variants of these headers and re-injects server-trusted values.
 */
export function getClientIp(req: Request): string {
  return (
    req.headers.get('cf-connecting-ip') ??
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  );
}
```

Run: `npx vitest run tests/unit/lib/getClientIp.test.ts`
Expected: alle passed.

### Task 6.2: `getClientIp` in allen 5 Auth-Routen einsetzen

- [ ] **Step 1: Auflisten der ad-hoc IP-Extraktionen**

Run: `grep -rn "x-real-ip\|x-forwarded-for\|cf-connecting-ip" src/app/api/`
Expected: 5 Dateien.

- [ ] **Step 2: Pro Datei ersetzen**

Für `src/app/api/auth/login/route.ts`, `register/route.ts`, `reset-password/route.ts`, `verify-email/route.ts`, `share/[token]/download/route.ts`:

Ersetze z. B.:
```ts
const ip = request.headers.get('x-real-ip') ?? 'unknown';
```

Durch:
```ts
import { getClientIp } from '@/lib/getClientIp';
// ... in handler:
const ip = getClientIp(request);
```

Und in `forgot-password/route.ts` den Inline-Block (Zeilen 23-27) durch `const ip = getClientIp(request);` ersetzen.

- [ ] **Step 3: Typecheck + Security-Tests**

Run: `bash scripts/local-ci.sh typecheck && npx vitest run tests/unit/security.test.ts`
Expected: alle passed.

### Task 6.3: Rate-Limits auf Upload-/Rate-Routen

- [ ] **Step 1: Preset-Upload-Limit**

Edit `src/app/api/presets/route.ts`. Am Anfang des `POST`-Handlers (direkt nach auth-check):

```ts
import { getClientIp } from '@/lib/getClientIp';
// ...
const userIp = getClientIp(request);
const limit = rateLimit(`preset-upload:${session.user.id}:${userIp}`, 30, 60 * 60 * 1000);
if (!limit.allowed) {
  return NextResponse.json({ error: 'Too many uploads. Try again later.' }, { status: 429 });
}
```

(30 Uploads/Stunde pro User).

- [ ] **Step 2: Avatar-Limit**

Edit `src/app/api/profile/avatar/route.ts`. Analog am Anfang des `POST`-Handlers:

```ts
const limit = rateLimit(`avatar:${session.user.id}`, 5, 60 * 60 * 1000);
if (!limit.allowed) {
  return NextResponse.json({ error: 'Too many avatar uploads.' }, { status: 429 });
}
```

- [ ] **Step 3: Rating-Limit**

Edit `src/app/api/presets/[id]/rate/route.ts`. Analog:

```ts
const limit = rateLimit(`rate:${session.user.id}`, 60, 60 * 1000);
if (!limit.allowed) {
  return NextResponse.json({ error: 'Too many rating changes.' }, { status: 429 });
}
```

- [ ] **Step 4: Typecheck**

Run: `bash scripts/local-ci.sh typecheck`
Expected: 0 errors.

### Task 6.4: Audit-Log für Error-DELETE

- [ ] **Step 1: `admin/errors/route.ts` DELETE + `admin/errors/[id]/route.ts` DELETE erweitern**

Edit `src/app/api/admin/errors/route.ts`. Ersetze den `DELETE`-Handler durch:

```ts
export const DELETE = withAdminAuth(async (_request, admin) => {
  const { count } = await prisma.errorLog.deleteMany();
  try {
    await logAdminAction({
      adminId: admin.id,
      action: 'PURGE_ERROR_LOGS',
      targetType: 'user',
      targetId: admin.id,
      metadata: { count },
    });
  } catch {
    // non-fatal — the primary action already succeeded
  }
  return NextResponse.json({ success: true, count });
});
```

Und Import ergänzen:
```ts
import { logAdminAction } from '@/lib/adminActions';
```

(falls der Name anders ist, via `grep -n "logAdminAction" src/` nachschauen.)

Analog für `src/app/api/admin/errors/[id]/route.ts:5` den DELETE-Handler.

- [ ] **Step 2: Verify `withAdminAuth` liefert admin-User als zweites Argument**

Run: `grep -A 3 "withAdminAuth = " src/lib/withAdminAuth.ts`
Falls die Signatur anders ist (z. B. kein Admin-Arg), `validateSession()` im Body aufrufen:

```ts
const { user: admin } = await validateSession();
```

### Task 6.5: Volle Suite + Commit Phase 6

- [ ] **Step 1: CI durchlaufen lassen**

Run: `bash scripts/local-ci.sh lint typecheck test`
Expected: alle passed.

- [ ] **Step 2: Commit**

```bash
git add src/lib/getClientIp.ts tests/unit/lib/getClientIp.test.ts src/app/api/auth/ src/app/api/presets/route.ts src/app/api/presets/[id]/rate/route.ts src/app/api/profile/avatar/route.ts src/app/api/admin/errors/
git commit -m "$(cat <<'EOF'
chore(security): rate-limits + getClientIp helper + error-purge audit log

- New src/lib/getClientIp.ts: unify header precedence (cf → xff → x-real-ip
  → 'unknown'). 5 auth routes previously used only x-real-ip, which lets
  clients without the header share one rate-limit bucket.
- Rate-limits on POST /api/presets (30/h/user), /api/profile/avatar (5/h),
  /api/presets/[id]/rate (60/min) — close storage/DB DoS from authenticated
  users.
- DELETE /api/admin/errors (+ /[id]) now writes a PURGE_ERROR_LOGS entry
  via logAdminAction so admin wipes are audit-trailed.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 7: `useMidiDevice` God-Hook Refactor

**Files:**
- Create: `src/hooks/midi/handshake.ts` — Connect-FSM als reine Funktion
- Create: `src/hooks/midi/presetTransfer.ts` — `saveToSlot`, `writePresetToSlot`, `pushPreset`
- Create: `src/hooks/midi/dispatcher.ts` — `onMidiMessage`-Dispatch-Logic als reine Funktion
- Modify: `src/hooks/useMidiDevice.ts` — State-Management + Wiring, delegiert an die neuen Module
- Create: `tests/unit/hooks/midi/*.test.ts` — Regression-Tests BEFORE the refactor

**Kontext**: 639-LOC-Hook mit 3 separaten Verantwortlichkeiten. Risiko = hoch, daher Tests-ZUERST-gegen-aktuelles-Verhalten, dann iterativ extrahieren.

**Scope-Warnung**: Diese Phase ist substanziell (wahrscheinlich 3-4 Stunden). Wenn Zeit knapp ist, Phase 7 in einen eigenen Plan verschieben und nach Phase 8 separat aufsetzen. Die kritischen Bugs sind in Phasen 1-5 bereits gefixt; Phase 7 ist Strukturarbeit.

### Task 7.1: Smoke-Tests für aktuelles Verhalten

- [ ] **Step 1: Test-Harness**

Erstelle `tests/unit/hooks/useMidiDevice.test.ts` mit Mock-`navigator.requestMIDIAccess`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMidiDevice } from '@/hooks/useMidiDevice';

function mockMidiAccess(inputs: MIDIInput[] = [], outputs: MIDIOutput[] = []) {
  const access = {
    inputs: new Map(inputs.map((i, n) => [String(n), i])),
    outputs: new Map(outputs.map((o, n) => [String(n), o])),
    onstatechange: null,
  };
  (globalThis as any).navigator = { requestMIDIAccess: vi.fn().mockResolvedValue(access) };
  return access;
}

describe('useMidiDevice (smoke)', () => {
  beforeEach(() => { (globalThis as any).navigator = undefined; });

  it('starts disconnected with no midi access', () => {
    const { result } = renderHook(() => useMidiDevice());
    expect(result.current.connected).toBe(false);
    expect(result.current.output).toBeNull();
  });

  it('exposes expected API surface', () => {
    const { result } = renderHook(() => useMidiDevice());
    expect(typeof result.current.connect).toBe('function');
    expect(typeof result.current.pullPreset).toBe('function');
    expect(typeof result.current.saveToSlot).toBe('function');
    expect(typeof result.current.writePresetToSlot).toBe('function');
    expect(typeof result.current.loadPresetNames).toBe('function');
    expect(typeof result.current.pauseNameLoading).toBe('function');
  });
});
```

- [ ] **Step 2: Run**

Run: `npx vitest run tests/unit/hooks/useMidiDevice.test.ts`
Expected: beide passed (Smoke).

- [ ] **Step 3: Commit Tests davor (Net für den Refactor)**

```bash
git add tests/unit/hooks/useMidiDevice.test.ts
git commit -m "test: add smoke test scaffold for useMidiDevice before refactor"
```

### Task 7.2: `handshake.ts` extrahieren

- [ ] **Step 1: Handshake-Logik identifizieren**

Lies `src/hooks/useMidiDevice.ts` Zeilen 280-366 (11-step FSM im `connect()`). Die Schritte sind:
1. Identity Request
2. Pull slot 0
3. Pull state dump
4. Warten auf alle Replies

- [ ] **Step 2: Pure Modul anlegen**

Erstelle `src/hooks/midi/handshake.ts`:

```ts
import type { MidiInput, MidiOutput } from './types';
import { buildIdentityRequest, buildStateDumpRequest, buildPullPreset, parseIdentityReply } from '@/core/SysExCodec';

export interface HandshakeResult {
  firmwareVersion: string | null;
  initialSlot: number | null;
}

/**
 * Runs the 4-step connect handshake synchronously over the given MIDI pair.
 * All responses route back through the input's onmidimessage handler, which
 * the caller wires up BEFORE invoking this function.
 *
 * Pure with respect to React state — caller reads back via shared refs.
 */
export async function runHandshake(
  output: MidiOutput,
  input: MidiInput,
): Promise<HandshakeResult> {
  // Implementation mirrors the extracted FSM. Time-stepped with small delays
  // between messages because the device drops rapid back-to-back sysex.
  await delay(50);
  output.send(buildIdentityRequest());
  await delay(150);
  output.send(buildPullPreset());
  await delay(200);
  output.send(buildStateDumpRequest());
  await delay(400);

  // Actual parsing lives in the caller's onMidiMessage dispatcher; we return
  // a stub here and let the hook populate via refs.
  return { firmwareVersion: null, initialSlot: null };
}

function delay(ms: number) { return new Promise((r) => setTimeout(r, ms)); }
```

Erstelle `src/hooks/midi/types.ts`:

```ts
export type MidiInput = WebMidi.MIDIInput;
export type MidiOutput = WebMidi.MIDIOutput;
```

- [ ] **Step 3: `useMidiDevice.connect()` umbauen**

In `src/hooks/useMidiDevice.ts` die inline-Handshake-Schritte durch einen `runHandshake(output, input)`-Aufruf ersetzen. Der Response-Handler bleibt im Hook (State-nahe).

- [ ] **Step 4: Smoke-Test erneut durchlaufen**

Run: `npx vitest run tests/unit/hooks/useMidiDevice.test.ts`
Expected: passed.

- [ ] **Step 5: Manuelles Hardware-Test-Playtest**

Da die Handshake-Sequenz Hardware-abhängig ist: Connect-Flow manuell im Dev-Server testen (USB-GP-200 anschließen, Connect klicken, Identity + Slot 0 + State-Dump sollten ankommen). **Wenn kein Gerät verfügbar: Phase 7 hier pausieren und im nächsten Session mit Gerät wiederholen.**

### Task 7.3: `presetTransfer.ts` extrahieren (analog)

- [ ] **Step 1**: `saveToSlot`, `writePresetToSlot`, `pushPreset` in `src/hooks/midi/presetTransfer.ts` auslagern, Hook delegiert.

- [ ] **Step 2**: Smoke-Tests + Hardware-Check.

- [ ] **Step 3**: Commit.

### Task 7.4: `dispatcher.ts` extrahieren

- [ ] **Step 1**: `onMidiMessage`-Body (65 Zeilen) als pure `dispatchMidiMessage(event, refs): Action | null` extrahieren.

- [ ] **Step 2**: Hook-`onMidiMessage` wird zum dünnen Wrapper, der `dispatchMidiMessage` aufruft und State-Setter triggert.

- [ ] **Step 3**: Smoke + Hardware + Commit.

### Task 7.5: `useMidiSend` 14-Helper-Deduplication

- [ ] **Step 1**: Custom Hook `useEventCallback` anlegen (`src/hooks/useEventCallback.ts`) — stabile Referenz ohne exhaustive-deps-Suppression.

- [ ] **Step 2**: Jeden der 14 Send-Helpers durch `useEventCallback((args) => sendInternal(builder(args), suppressFx?))` ersetzen.

- [ ] **Step 3**: 14 `eslint-disable`-Kommentare entfernen.

- [ ] **Step 4**: Commit.

### Task 7.6: `SysExCodec` `SYSEX_HEADER` + Effect-Block-Helper

- [ ] **Step 1**: Hoist `const SYSEX_HEADER = new Uint8Array([0xF0, 0x21, 0x25, 0x7E, 0x47, 0x50, 0x2D, 0x32])` einmalig. Alle 19 Inline-Kopien durch `msg.set(SYSEX_HEADER, 0)` ersetzen.

- [ ] **Step 2**: `writeEffectBlock(payload, view, base, effect, paramCount)`-Helper extrahieren. 4 copy-paste-Blöcke in Zeilen 201-260 ersetzen durch einen Loop.

- [ ] **Step 3**: Alle `SysExCodec.test.ts` laufen lassen — Byte-exakte Outputs dürfen sich NICHT ändern.

- [ ] **Step 4**: Commit.

---

## Phase 8: Design-System & Forms-Library

**Files:**
- Modify: `tailwind.config.ts` — Custom-Tokens
- Create: `src/components/forms/FormCard.tsx`, `FormLabel.tsx`, `FormInput.tsx`, `FormTextarea.tsx`, `PrimaryButton.tsx`, `ErrorBanner.tsx`
- Modify: 5 Auth-Pages + `ProfileEditForm` + `SavePresetDialog` — nutzen die neuen Komponenten
- Modify: diverse Files — `onMouseEnter`/`onMouseLeave` → `hover:` (Batch-Replace)

### Task 8.1: Tailwind-Tokens

- [ ] **Step 1: `tailwind.config.ts` erweitern**

Edit `tailwind.config.ts`:

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        'bg-primary':        'var(--bg-primary)',
        'bg-surface':        'var(--bg-surface)',
        'bg-surface-raised': 'var(--bg-surface-raised)',
        'bg-elevated':       'var(--bg-elevated)',
        'bg-card':           'var(--bg-card)',
        'bg-input':          'var(--bg-input)',
        'bg-deep':           'var(--bg-deep)',
        'bg-hover':          'var(--bg-hover)',
        'text-primary':      'var(--text-primary)',
        'text-secondary':    'var(--text-secondary)',
        'text-muted':        'var(--text-muted)',
        'border-subtle':     'var(--border-subtle)',
        'border-active':     'var(--border-active)',
        'accent-amber':      'var(--accent-amber)',
        'accent-amber-dim':  'var(--accent-amber-dim)',
        'accent-red':        'var(--accent-red)',
        'accent-green':      'var(--accent-green)',
      },
      boxShadow: {
        'glow-amber': '0 0 12px var(--glow-amber)',
        'glow-red':   '0 0 12px var(--glow-red)',
        'glow-green': '0 0 12px var(--glow-green)',
        'card':       '0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.03)',
      },
    },
  },
  plugins: [],
};
export default config;
```

- [ ] **Step 2: Dev-Server starten + Visual-Check**

Run: `rm -rf .next && npm run dev -- --port 3001`

Erwartet: existierende inline-`style={{color: 'var(--text-secondary)'}}` funktionieren weiterhin. Neue Utility `text-text-secondary` sollte für neue Komponenten verfügbar sein.

### Task 8.2: Forms-Komponenten

- [ ] **Step 1: `FormCard.tsx`**

Erstelle `src/components/forms/FormCard.tsx`:

```tsx
import type { ReactNode } from 'react';

export function FormCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="w-full max-w-sm rounded-lg p-6 bg-bg-surface border border-border-subtle shadow-card">
      <h1 className="font-mono-display text-xl font-bold tracking-tight mb-6 text-accent-amber">
        {title}
      </h1>
      {children}
    </div>
  );
}
```

- [ ] **Step 2: `FormLabel.tsx`, `FormInput.tsx`, `FormTextarea.tsx`**

Erstelle `src/components/forms/FormLabel.tsx`:

```tsx
import type { ReactNode } from 'react';

export function FormLabel({ htmlFor, children }: { htmlFor: string; children: ReactNode }) {
  return (
    <label
      htmlFor={htmlFor}
      className="block font-mono-display text-[11px] font-medium tracking-wider uppercase mb-1.5 text-text-secondary"
    >
      {children}
    </label>
  );
}
```

Erstelle `src/components/forms/FormInput.tsx`:

```tsx
import { forwardRef, type InputHTMLAttributes } from 'react';

export const FormInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function FormInput({ className = '', ...props }, ref) {
    return (
      <input
        ref={ref}
        {...props}
        className={`w-full rounded px-3 py-2 text-sm bg-bg-elevated border border-border-active text-text-primary focus-visible:border-accent-amber transition-colors ${className}`}
      />
    );
  },
);
```

Analog `FormTextarea.tsx`.

- [ ] **Step 3: `PrimaryButton.tsx`**

Erstelle `src/components/forms/PrimaryButton.tsx`:

```tsx
import type { ButtonHTMLAttributes, ReactNode } from 'react';

export function PrimaryButton({
  children,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return (
    <button
      {...props}
      className={`w-full font-mono-display text-sm font-bold tracking-wider uppercase rounded py-2.5 transition-all duration-150 disabled:opacity-50 bg-[var(--glow-amber)] border border-accent-amber text-accent-amber shadow-glow-amber hover:bg-accent-amber hover:text-bg-primary ${className}`}
    >
      {children}
    </button>
  );
}
```

- [ ] **Step 4: `ErrorBanner.tsx`**

Erstelle `src/components/forms/ErrorBanner.tsx`:

```tsx
export function ErrorBanner({ message }: { message: string }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="text-sm rounded px-3 py-2 text-accent-red border"
      style={{ background: 'var(--glow-red)', borderColor: 'rgba(196, 78, 78, 0.25)' }}
    >
      {message}
    </p>
  );
}
```

### Task 8.3: Migration — 5 Auth-Pages auf Forms-Library umbauen

- [ ] **Step 1: `login/page.tsx` umbauen**

Vorher: ~150 Zeilen mit inline-styles. Nachher: ~60 Zeilen mit Forms-Library.

Konkret: öffne `src/app/[locale]/auth/login/page.tsx`, ersetze den JSX-Body (Card-Wrapper + Inputs + Button) durch die `FormCard`/`FormLabel`/`FormInput`/`PrimaryButton`/`ErrorBanner`-Kompositionen. Labels + Error-Texte + Submit-Text kommen weiter aus `useTranslations`. `onFocus`/`onBlur`-Style-Swaps entfallen (Global-Focus-Ring aus Phase 3).

Muster (pseudo-diff):
```diff
- <div className="...card..." style={{background: ..., border: ..., boxShadow: ...}}>
-   <h1 ...>{t('loginTitle')}</h1>
+ <FormCard title={t('loginTitle')}>
    <form ...>
-     <label ...>{t('email')}</label>
-     <input ... style={...} onFocus={...} onBlur={...}/>
+     <FormLabel htmlFor="email">{t('email')}</FormLabel>
+     <FormInput id="email" name="email" .../>
      ...
-     <button ... onMouseEnter={...} onMouseLeave={...}>
+     <PrimaryButton disabled={loading}>
        {loading ? t('loading') : t('submit')}
-     </button>
-     {error && <p ... style={...}>{error}</p>}
+     </PrimaryButton>
+     <ErrorBanner message={error} />
    </form>
- </div>
+ </FormCard>
```

- [ ] **Step 2: Gleiche Migration für `register`, `forgot-password`, `reset-password`, `verify-email`**

- [ ] **Step 3: `ProfileEditForm.tsx` + `SavePresetDialog.tsx` wenn machbar**

(Optional — bei Zeitdruck auf separates Follow-up-Commit verschieben.)

- [ ] **Step 4: E2E-Auth-Flow**

Run: `TMPDIR=/home/manuel/.tmp-playwright npx playwright test --grep auth`
Expected: alle passed.

### Task 8.4: Batch-Replace `onMouseEnter`/`onMouseLeave` zu Tailwind

- [ ] **Step 1: Betroffene Files listen**

Run: `grep -rln "onMouseEnter" src/components src/app`
Expected: ~12 Files.

- [ ] **Step 2: Pro File manuell prüfen und umbauen**

Typisches Muster:
```tsx
// Vorher:
<button
  style={{ background: 'X', color: 'Y' }}
  onMouseEnter={(e) => { e.currentTarget.style.background = 'A'; e.currentTarget.style.color = 'B'; }}
  onMouseLeave={(e) => { e.currentTarget.style.background = 'X'; e.currentTarget.style.color = 'Y'; }}
>

// Nachher:
<button className="bg-[X] text-[Y] hover:bg-[A] hover:text-[B]">
```

- [ ] **Step 3: Visual Check Dev-Server**

Hovern über Navbar-Links, Profile-Buttons, Gallery-Cards. Kein Regression.

### Task 8.5: Commit Phase 8

- [ ] **Step 1: Commit**

```bash
git add tailwind.config.ts src/components/forms/ src/app/[locale]/auth/ src/components/ src/app/
git commit -m "$(cat <<'EOF'
refactor(ui): Tailwind design tokens + forms/* components + hover: migration

- tailwind.config.ts exposes the 16 CSS vars as Tailwind utility classes
  (text-text-secondary, bg-bg-surface, shadow-glow-amber, etc.) so
  hover:/focus-visible:/dark: variants become usable.
- New src/components/forms/ with FormCard, FormLabel, FormInput,
  FormTextarea, PrimaryButton, ErrorBanner. 5 auth pages + profile edit
  migrated, removing ~30 lines of duplicated inline-style-plus-JS-hover
  per page.
- All remaining onMouseEnter/onMouseLeave for hover effects replaced with
  Tailwind hover: classes (closes the CLAUDE.md "Nicht tun" item).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Abschluss

### Final-CI + optional Deploy

- [ ] **Final-CI**

Run: `bash scripts/local-ci.sh`
Expected: lint + typecheck + test + build alle grün.

- [ ] **Push (pro Phase einzelner Commit, einmal push am Ende)**

```bash
git push origin master
```

- [ ] **Optional: Deploy in einem Rutsch**

```bash
ssh musikersuche@82.165.40.140 "cd /opt/gp200editor && bash scripts/deploy-update.sh"
```

(Feedback aus Memory: mehrere Commits OK, aber Deploy einmal am Session-Ende.)

### Erwartetes Ergebnis

- 7 kritische Korrektheits-Bugs gefixt (usePreset + PRST-Encoder)
- 8 Security-Härtungen eingebaut (Rate-Limits, IP-Helper, Audit-Log)
- UI-A11y und Prod-SSR-Crash-Risiken entschärft
- Locale-Duplication eliminiert
- Unzuverlässiger `pushPreset` deprekiert
- God-Hook + God-Component zerlegt (Phase 7 — **wenn Zeit**)
- Design-System konsolidiert, Forms-Library produktiv (Phase 8 — **wenn Zeit**)
