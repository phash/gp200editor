# Firmware-Kompatibilitätscheck — Design Spec

**Issue:** #13 (Kompatibilitätscheck)
**Date:** 2026-03-20

---

## Zusammenfassung

Nach dem MIDI-Handshake wird die Geräte-Firmware gegen eine Liste getesteter Versionen geprüft. Bei Mismatch erscheint ein blockierender Dialog — der User muss entweder das Risiko bestätigen oder die Verbindung wird getrennt.

---

## 1. Getestete Firmware-Versionen

Zentrale Konstante, erweiterbar:

```typescript
export const TESTED_FIRMWARE_VERSIONS = ['1.8.0'];
```

Definiert in `src/core/firmware.ts` (neue Datei, klein und fokussiert). Wird von `useMidiDevice`, `FirmwareCompatDialog` und `DeviceStatusBar` importiert.

---

## 2. FirmwareCompatDialog (ersetzt FirmwareWarningBanner)

Blockierender modaler Dialog (gleich wie SavePresetDialog-Pattern):

- **Titel:** "Firmware-Kompatibilitätswarnung" / "Firmware Compatibility Warning"
- **Info:** "Diese App wurde nur mit Firmware {versions} getestet. Dein Gerät hat Firmware {detected}."
- **Warnung:** "Bei nicht getesteter Firmware können Presets beschädigt werden oder das Gerät unerwartet reagieren."
- **Checkbox:** "Mir ist das Risiko bewusst" / "I understand the risk"
- **Buttons:**
  - "Verbindung trennen" / "Disconnect" — immer aktiv, ruft `midiDevice.disconnect()` auf
  - "Weiter" / "Continue" — erst aktiv nach Checkbox-Bestätigung

Dialog blockiert die UI: kein Pull/Push möglich solange Dialog offen.

---

## 3. Hook-Integration

`useMidiDevice` bekommt kein neues Flag — die Firmware-Info ist bereits in `deviceInfo.firmwareValues` verfügbar. Die Prüflogik liegt in den Konsumenten (Editor, Player).

**Logik in Editor/Player:**

```typescript
const firmwareVersion = midiDevice.deviceInfo?.firmwareValues.join('.') ?? '';
const firmwareOk = TESTED_FIRMWARE_VERSIONS.includes(firmwareVersion);
const showFirmwareDialog = midiDevice.status === 'connected' && !firmwareOk && !firmwareDismissed;
```

`firmwareDismissed` ist lokaler `useState(false)` — wird pro Session zurückgesetzt. Kein Persist nötig.

---

## 4. DeviceStatusBar

Bestehende hardcodierte `!== '1.2'` Logik ersetzen durch:

```typescript
import { TESTED_FIRMWARE_VERSIONS } from '@/core/firmware';
const firmwareOk = TESTED_FIRMWARE_VERSIONS.includes(firmwareVersion);
```

Rotes ⚠ erscheint wenn `!firmwareOk`.

---

## 5. Dateien

| Datei | Änderung |
|-------|----------|
| `src/core/firmware.ts` | Neu: `TESTED_FIRMWARE_VERSIONS` Konstante |
| `src/components/FirmwareCompatDialog.tsx` | Neu: Blockierender Dialog (ersetzt FirmwareWarningBanner) |
| `src/components/FirmwareWarningBanner.tsx` | Löschen |
| `src/app/[locale]/editor/page.tsx` | FirmwareWarningBanner → FirmwareCompatDialog, Logik anpassen |
| `src/app/[locale]/playlists/PlaylistPlayer.tsx` | FirmwareCompatDialog einbinden |
| `src/components/DeviceStatusBar.tsx` | Hardcoded `!== '1.2'` → `TESTED_FIRMWARE_VERSIONS` Check |
| `messages/de.json` | Neue Keys im `device` Namespace |
| `messages/en.json` | Neue Keys im `device` Namespace |

---

## 6. i18n Keys (device Namespace)

```
device.firmwareCompatTitle: "Firmware-Kompatibilitätswarnung" / "Firmware Compatibility Warning"
device.firmwareCompatInfo: "Diese App wurde nur mit Firmware {versions} getestet. Dein Gerät hat Firmware {detected}." / "This app was only tested with firmware {versions}. Your device has firmware {detected}."
device.firmwareCompatRisk: "Bei nicht getesteter Firmware können Presets beschädigt werden oder das Gerät unerwartet reagieren." / "With untested firmware, presets may get corrupted or the device may behave unexpectedly."
device.firmwareCompatAck: "Mir ist das Risiko bewusst" / "I understand the risk"
device.firmwareCompatContinue: "Weiter" / "Continue"
device.firmwareCompatDisconnect: "Verbindung trennen" / "Disconnect"
```

---

## 7. Nicht im Scope

- Firmware-Update-Funktion
- Automatisches Testen gegen mehrere Firmware-Versionen
- Persistierung der Bestätigung über Sessions hinweg
