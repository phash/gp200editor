# .prst Binärformat (Reverse Engineered, 2026-03-16)

**Alle bekannten echten .prst-Dateien sind exakt 1224 Bytes** (User-Presets; Factory-Presets: 1176 Bytes).

## Datei-Header (0x00–0x2F, 48 Bytes)

| Offset | Größe | Inhalt                          |
|--------|-------|---------------------------------|
| 0x00   | 4     | Magic: `TSRP` ("PRST" reversed) |
| 0x10   | 4     | Device ID: `2-PG` ("GP-2" rev.) |
| 0x14   | 4     | Firmware-Version: `00 01 01 00` |
| 0x1C   | 4     | Timestamp / Preset-ID           |
| 0x28   | 4     | Chunk-Marker: `MRAP`            |
| 0x2C   | 4     | Chunk-Größe (LE uint32 = 1172)  |

## Preset-Name + Author (0x44–0x63)

| Offset | Größe | Inhalt                          |
|--------|-------|---------------------------------|
| 0x44   | 16    | Preset-Name (null-terminiert)   |
| 0x54   | 16    | Author (null-terminiert)        |

- Beide Felder: ASCII, null-terminiert, max 16 Zeichen (nicht 32 wie ursprünglich angenommen)
- Author wird auch per SysEx Live-Message (sub=0x20) ans Gerät gesendet

## Effekt-Blöcke (0xa0–0x3AF, 11× 72 Bytes)

```
+0   4  Marker: 14 00 44 00
+4   1  Slot-Index (0–10)
+5   1  Aktiv-Flag (0 = bypass, 1 = aktiv)
+6   2  Konstante: 0x000F
+8   4  Effekt-Code (LE uint32) — High-Byte = Modul-Typ, Low-Bytes = Variante
+12  60 Parameter (15× LE float32)
```

**Wichtig:** Blockgröße = **72 Bytes (0x48)**, nicht 64 (0x40).

## Effekt-Code Struktur (uint32)

| High-Byte | Modul | Beispiele |
|-----------|-------|-----------|
| 0x00 | PRE/NR | COMP, Gate, Boost |
| 0x01 | PRE/EQ/MOD | AC Sim, Guitar EQ, Detune |
| 0x03 | DST | Green OD, Force, Scream OD |
| 0x04 | MOD | Chorus, Flanger, Phaser, Tremolo |
| 0x05 | WAH | V-Wah, C-Wah |
| 0x06 | VOL | Volume |
| 0x07 | AMP | UK 800, Mess DualV, Eagle 120+ |
| 0x08 | AMP (extra) | AC Pre, Mini Bass |
| 0x0A | CAB | UK GRN 2, EV, User IR |
| 0x0B | DLY | Pure, Analog, Tape |
| 0x0C | RVB | Room, Hall, Shimmer |
| 0x0F | SnapTone | SnapTone (AMP/DST) |

## Effekt-Datenbank

- **305 Effekte** mit Namen aus der offiziellen Valeton GP-200 Editor Software (`algorithm.xml`)
- **322 Parameter-Definitionen** (Knob, Slider, Switch, Combox) pro Effekt
- Quelle: `~/.wine/drive_c/Program Files/Valeton/GP-200/Resource/GP-200/File/algorithm.xml`
- Generator: `scripts/generate-effect-params.mjs` → `src/core/effectParams.ts`

## Checksum (letzte 2 Bytes, 0x4C6)

**Algorithmus gelöst (2026-03-18):** `sum(bytes[0:0x4C6]) & 0xFFFF`, gespeichert als BE16.
Decoder liest `readUint16BE`, Encoder schreibt High-Byte zuerst.
