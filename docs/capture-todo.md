# SysEx Capture TODO (Windows)

## Kontext
Preset Forge kann jetzt Presets auf dem GP-200 speichern (Save-Commit),
aber **nicht vollständig auf andere Slots schreiben** (Write-Chunks gehen,
aber Effekt-IDs können nicht geändert werden).

## ✅ Erledigt: buildEffectChange (sub=0x14)

> **Status: implementiert & hardware-verifiziert** (Issue #58 geschlossen 2026-06-25).
> Decodiert als `SysExCodec.buildEffectChange` (`src/core/SysExCodec.ts`), gesendet via
> `sendEffectChange` (`src/hooks/useMidiSend.ts`) und im Write-to-Slot-Pfad
> (`src/hooks/useMidiDevice.ts`). Unit-Tests in `tests/unit/SysExCodec.test.ts` +
> `tests/unit/useMidiDevice.test.ts`. Format: raw[38]=block, raw[45:47]=variant
> (nibble), raw[52]=module type. Am Gerät bestätigt (#80: „manual effect changes work").
> Die folgende Capture-Anleitung ist nur noch historische Referenz.

Wenn man am Gerät oder in der Valeton-Software einen Effekt in einem Slot
**austauscht** (z.B. Green OD → Force), sendet die Software sub=0x14 (54 Bytes, raw).
Dieses Format brauchen wir für:
- Preset von Datei auf Gerät laden (alle Effekte setzen)
- Slot-Tausch in der Bank (verschiedene Effekte)

### Capture-Anleitung (historisch)

> Einfachste Variante: das GUI-Tool `scripts/gp200-capture-gui.py` —
> siehe [`capture-tool.md`](capture-tool.md). Manuell mit Wireshark:

1. Wireshark + USBPcap starten (wie bei den anderen Captures)
2. GP-200 per USB verbinden
3. Valeton GP-200 Editor öffnen
4. **In einem Slot den Effekt wechseln** — z.B.:
   - Slot DST: Green OD → Force (oder umgekehrt)
   - Slot AMP: UK 800 → Mess DualV
   - Slot DLY: Pure → Analog
5. **Für jeden Wechsel separat capturen** (klein halten)
6. Capture speichern

### Was wir sehen wollen

Host→Device Message mit:
- CMD=0x12, sub=0x14, 54 Bytes, raw (nicht nibble-encoded)
- Welche Bytes kodieren: alten Effekt-ID, neuen Effekt-ID, Slot-Index
- Device→Host Response: sub=0x0C (38 Bytes)

### Außerdem nützlich

- **Device→Host bei Hardware-Änderungen**: Am Gerät (nicht in der Software)
  einen Effekt ein-/ausschalten (Fußschalter) und schauen ob das Gerät
  SysEx-Nachrichten an den Host sendet. Wir brauchen das für die
  Live-Synchronisierung (App zeigt Änderungen vom Gerät).

### Vorhandene Captures

| Datei | Inhalt |
|-------|--------|
| gp200-capture-windows.pcap | Write-Chunks (4×366B) für Slot 9 "Pretender" |
| Captures 100548-105713 | Toggle, Reorder, Param, Author, Drum, IR |

### Analyse

```bash
python3 scripts/analyze-sysex.py <capture.pcap>
```

Zeigt alle SysEx-Messages mit Typ, Richtung und Payload.
