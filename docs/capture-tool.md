# GP-200 USB-Capture Tool — Anleitung

Mit diesem Tool nimmst du die USB-Kommunikation zwischen deinem PC und dem
Valeton GP-200 auf. Solche Aufnahmen (**Captures**, `.pcap`-Dateien) helfen den
Entwicklern, **Probleme nachzuvollziehen** — z. B. wenn das Live-USB-Editing
nicht funktioniert, ein Preset nicht korrekt geschrieben wird oder ein IR/NAM
nicht lädt.

Es gibt zwei Varianten — beide nehmen dasselbe auf:

| Variante | Datei | Für wen |
|----------|-------|---------|
| **GUI (empfohlen)** | `scripts/gp200-capture-gui.py` | Anwender, keine Kommandozeile nötig |
| Kommandozeile | `scripts/capture-windows.ps1` | Power-User / Skripting |

Analysiert werden die Aufnahmen mit `scripts/analyze-sysex.py`; eine Übersicht
aller vorhandenen Captures steht in [`capture-catalog.md`](capture-catalog.md).

---

## 1. Voraussetzungen / Installation

Es werden **keine pip-Pakete** benötigt — nur zwei Programme:

### a) Wireshark mit TShark + USBPcap

Das Tool nutzt im Hintergrund `tshark` (Teil von Wireshark) sowie den
USB-Mitschnitt-Treiber `USBPcap`.

**Windows:**
1. Wireshark herunterladen: <https://www.wireshark.org/download.html>
2. Im Installer **beide Haken setzen**:
   - ☑ **TShark**
   - ☑ **USBPcap** (USB-Capture-Treiber)
3. Nach der Installation den **PC neu starten** (USBPcap-Treiber wird sonst nicht aktiv).

> Ohne USBPcap erscheinen keine USB-Interfaces — dann lässt sich nichts aufnehmen.

**Linux:**
```bash
sudo apt install tshark        # Debian/Ubuntu/Mint
sudo modprobe usbmon           # USB-Monitoring aktivieren
sudo usermod -aG wireshark $USER && newgrp wireshark   # Capture ohne root erlauben
```

### b) Python 3 (mit Tkinter)

- **Windows:** Python von <https://www.python.org/downloads/> installieren —
  Tkinter ist dort **bereits enthalten**. (Beim Installer „Add python.exe to PATH" ankreuzen.)
- **Linux:** Tkinter ggf. nachinstallieren:
  ```bash
  sudo apt install python3-tk
  ```

Prüfen:
```bash
python --version          # Python 3.x
python -m tkinter         # öffnet kurz ein kleines Testfenster
```

---

## 2. Tool starten

**Windows (empfohlen: als Administrator):**

USB-Aufnahmen brauchen i. d. R. Administratorrechte. Am einfachsten:
PowerShell **als Administrator** öffnen, dann:

```powershell
cd <projektordner>
python scripts\gp200-capture-gui.py
```

Das Tool warnt oben im Fenster, falls es **nicht** als Administrator läuft.

**Linux:**
```bash
python3 scripts/gp200-capture-gui.py
```

---

## 3. Capture durchführen (GUI)

1. **GP-200 per USB anschließen** und einschalten (Normalmodus).
2. Tool starten — oben muss stehen **„✓ tshark gefunden"**.
3. **USB-Interface auswählen.** Es werden nur USB-Interfaces gezeigt
   (Windows: `USBPcap1`, `USBPcap2`, …). Wenn du nicht weißt, welches:
   nacheinander ausprobieren — beim falschen bleibt die Datei winzig (siehe unten).
4. **„Problem (kurz)"** eintippen, z. B. `ir-load-crash` — landet im Dateinamen,
   das erleichtert die Zuordnung.
5. **„● Aufnahme starten"** klicken.
6. **Jetzt das Problem reproduzieren** — im Browser-Editor (preset-forge.com)
   oder in der Valeton-Software die Aktion ausführen, die nicht funktioniert
   (Effekt wechseln, Preset speichern, IR/NAM laden, …).
   Möglichst **kurz** halten und nur die problematische Aktion machen.
7. **„■ Aufnahme stoppen"** klicken.
8. Das Tool zeigt den **Speicherort** und die **Dateigröße** an.
   Über **„Analysieren"** kannst du dir eine Kurzauswertung ansehen,
   über **„Ordner öffnen"** den Speicherort öffnen.

**Speicherort:** standardmäßig dein **Desktop**, Dateiname
`gp200-capture-JJJJMMTT-HHMMSS[-beschreibung].pcap`.

---

## 4. Capture an die Entwickler schicken

- **GitHub-Issue (bevorzugt):** <https://github.com/phash/gp200editor/issues> →
  „New Issue" → Problem beschreiben und die `.pcap`-Datei anhängen.
- **E-Mail:** Datei an den im Repository angegebenen Kontakt senden.

Bitte dazuschreiben: **was** du getan hast, **was** passieren sollte und **was**
stattdessen passiert ist, sowie deine **Firmware-Version** (GP-200: 1.8.0 wird unterstützt).

> Eine `.pcap` enthält nur die USB-MIDI-Kommunikation mit dem Pedal
> (Preset-/Effektdaten). Keine persönlichen Dateien.

---

## 5. Problembehebung

| Symptom | Ursache / Lösung |
|---------|------------------|
| „✗ tshark NICHT gefunden" | Wireshark mit **TShark** installieren; danach Tool neu starten |
| Keine USB-Interfaces in der Liste | **USBPcap** nicht installiert oder PC nach Installation nicht neu gestartet. Notfalls Haken „nur USB-Interfaces" entfernen |
| Datei ist winzig (< 2 KB) | Falsches Interface erwischt — anderes `USBPcap`-Interface wählen und erneut aufnehmen |
| „Nicht als Administrator gestartet" | PowerShell als Administrator öffnen und Tool erneut starten |
| Fenster öffnet nicht (Linux) | `sudo apt install python3-tk` |

---

## 6. Alternative: Kommandozeile

Ohne GUI geht es auch direkt:

```powershell
# Windows: aufnehmen (interaktive Interface-Auswahl, PowerShell als Administrator)
.\scripts\capture-windows.ps1
```
```bash
# Linux: aufnehmen
sudo modprobe usbmon
tshark -i usbmon3 -w capture.pcap     # Bus-Nr. aus: lsusb | grep -i valeton

# auswerten
python scripts/analyze-sysex.py capture.pcap
```

Siehe auch: [`sysex-protocol.md`](sysex-protocol.md) · [`capture-todo.md`](capture-todo.md) · [`capture-catalog.md`](capture-catalog.md)
