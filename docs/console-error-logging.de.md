# Fehler über die Browser-Konsole protokollieren (Support-Anleitung)

> **Wofür ist das?** Wenn in Preset Forge etwas nicht funktioniert — der GP-200
> verbindet sich nicht, ein Preset lässt sich nicht laden, ein Upload schlägt
> fehl, oder das Live-Editing reagiert nicht — stecken die entscheidenden Hinweise
> fast immer in der **Browser-Konsole**. Diese Anleitung zeigt dir Schritt für
> Schritt, wie du diese Meldungen sichtbar machst, aufzeichnest und an die
> Entwicklung schickst. Mit einem Konsolen-Mitschnitt lässt sich ein Bug oft in
> Minuten finden — ohne ihn raten wir nur.

Viele offene Themen drehen sich um die Gerätekommunikation per USB-MIDI
(z. B. IR-/NAM-Upload, Effekt-Änderungen ans Gerät senden, SysEx-Captures —
siehe die [GitHub Issues](https://github.com/phash/gp200editor/issues)). Genau
hier helfen deine Konsolen-Logs am meisten.

---

## TL;DR (Kurzfassung)

1. **Chrome, Edge oder Brave** öffnen (für Geräte-/MIDI-Probleme zwingend — Web MIDI
   gibt es nur in Chromium-Browsern).
2. Preset Forge öffnen, dann `F12` drücken → Tab **Console**.
3. **„Preserve log"** / **„Protokoll beibehalten"** anhaken (Zahnrad oben rechts in
   den DevTools, falls die Option fehlt).
4. Das Problem **nachstellen** (z. B. Gerät verbinden, Preset laden, Upload starten).
5. Rechtsklick in die Konsole → **„Save as…"** / **„Speichern unter…"** → Datei sichern.
6. Datei (oder einen Screenshot der roten Meldungen) per **E-Mail an
   [phash@phash.de](mailto:phash@phash.de)** oder als **GitHub-Issue** schicken.

---

## 1. Was ist die Konsole?

Jeder moderne Browser hat eingebaute „Entwicklerwerkzeuge" (DevTools). Die
**Konsole** ist der Teil davon, in dem Webseiten technische Meldungen ausgeben:
Statusmeldungen, Warnungen (gelb) und Fehler (rot). Preset Forge schreibt dort
gezielt nachvollziehbare Meldungen hinein, z. B. jeden MIDI-Befehl, der ans
Pedal geht.

Du veränderst durch das Öffnen der Konsole **nichts** an deinen Presets oder am
Gerät — du schaust nur zu.

---

## 2. Die Konsole öffnen

> **Wichtig für Geräte-Probleme:** Das Live-Editing per USB nutzt die **Web-MIDI-
> API**. Die gibt es nur in **Chromium-basierten Browsern** (Google Chrome,
> Microsoft Edge, Brave, Chromium). **Firefox und Safari** unterstützen kein
> Web MIDI — bei MIDI-Themen also bitte Chrome oder Edge verwenden.

### Chrome / Edge / Brave / Chromium

| System | Tastenkürzel (öffnet direkt die Konsole) |
|--------|-------------------------------------------|
| Windows / Linux | `F12` oder `Strg` + `Umschalt` + `J` |
| macOS | `Cmd` + `Option` + `J` |

Alternativ: Rechtsklick irgendwo auf der Seite → **„Untersuchen"** → Tab **Console**.

### Firefox (nur für Nicht-MIDI-Probleme)

| System | Tastenkürzel |
|--------|--------------|
| Windows / Linux | `F12` oder `Strg` + `Umschalt` + `K` |
| macOS | `Cmd` + `Option` + `K` |

### Safari (nur für Nicht-MIDI-Probleme)

1. Erst das Entwicklermenü aktivieren: **Safari → Einstellungen → Erweitert →
   „Funktionen für Webentwickler anzeigen"** (bzw. „Develop-Menü anzeigen").
2. Dann Konsole öffnen mit `Cmd` + `Option` + `C`.

---

## 3. Vor dem Nachstellen: zwei wichtige Einstellungen

1. **„Preserve log" / „Protokoll beibehalten" aktivieren.**
   Ohne diese Option wird die Konsole bei jedem Neuladen oder Seitenwechsel
   geleert — und genau die Meldung kurz vor dem Fehler geht verloren. In Chrome/Edge
   steht die Checkbox oben in der Konsolen-Leiste oder hinter dem Zahnrad-Symbol
   (⚙) → „Preserve log".

2. **Log-Level auf „Alle" stellen.**
   Stelle sicher, dass nicht versehentlich nur „Errors" gefiltert sind. Über dem
   Log gibt es Filter-Buttons (Verbose / Info / Warnings / Errors) — am besten
   alle aktiv lassen.

Tipp: Mit dem Mülltonnen-Symbol (🚫) kannst du die Konsole vorher einmal leeren,
damit nur die Meldungen ab jetzt aufgezeichnet werden.

---

## 4. Das Problem nachstellen

Lass die Konsole offen und mach genau die Schritte, die zum Fehler führen —
z. B.:

- Gerät verbinden / „Connect" klicken
- Preset laden, speichern oder ans Gerät senden
- Effekt umschalten oder Parameter ändern
- Datei hochladen (Gallery, IR/NAM)

Merke dir, **was du geklickt hast** und **was passiert ist** (oder eben nicht).
Diese Beschreibung gehört mit in die Meldung.

---

## 5. Die Meldungen von Preset Forge lesen

Preset Forge versieht seine Meldungen mit eindeutigen Präfixen — danach kannst du
im **Filter-Feld** der Konsole suchen:

| Präfix | Bedeutung |
|--------|-----------|
| `[GP-200]` | USB-MIDI-Kommunikation mit dem Gerät (am wichtigsten bei Geräte-Bugs). Enthält gesendete/empfangene Befehle, z. B. `pull rx:` / `pull tx:` mit Hex-Daten. |
| `[ErrorLog:...]` | Server-/App-Fehler, die zusätzlich in der Konsole gespiegelt werden. |

- **Rote** Zeilen sind Fehler, **gelbe** sind Warnungen.
- Tippe `[GP-200]` ins **Filter-Feld** (Lupe/Textfeld über dem Log), um nur die
  Gerätekommunikation zu sehen.
- Ein kleines Dreieck ▸ vor einer Zeile lässt sich aufklappen — bei Fehlern steckt
  dort der **Stack-Trace** (technische Herkunft des Fehlers). Bitte mit aufzeichnen.

---

## 6. Die Logs aufzeichnen und verschicken

### Variante A — Als Datei speichern (am vollständigsten)

In **Chrome / Edge / Brave**:

1. **Rechtsklick** irgendwo in die Konsole.
2. **„Save as…"** / **„Speichern unter…"** wählen.
3. Die `.log`-Datei speichern und der Meldung anhängen.

### Variante B — Kopieren & einfügen

1. In die Konsole klicken, `Strg` + `A` (alles markieren), `Strg` + `C` (kopieren).
2. In die E-Mail oder das GitHub-Issue einfügen — am besten in einen Code-Block
   (drei Backticks ``` davor und danach), damit es lesbar bleibt.

### Variante C — Screenshot

Reicht oft schon für offensichtliche rote Fehler: Screenshot der Konsole machen.
Achte darauf, dass die **komplette rote Fehlermeldung inkl. aufgeklapptem
Stack-Trace** sichtbar ist.

---

## 7. Netzwerk-Fehler erfassen (Upload, Gallery, Login, API)

Wenn etwas mit dem Server schiefgeht (Upload schlägt fehl, Login klappt nicht,
Gallery lädt nicht), hilft der **Network**-Tab zusätzlich zur Konsole:

1. In den DevTools auf den Tab **„Network" / „Netzwerkanalyse"** wechseln.
2. **„Preserve log"** auch hier anhaken.
3. Das Problem nachstellen.
4. Die **rot markierte** (fehlgeschlagene) Anfrage anklicken — oben steht der
   **Status-Code** (z. B. `400`, `403`, `500`), unter **„Response"** die Antwort
   des Servers.
5. Screenshot von Status + Response machen, oder Rechtsklick auf die Anfrage →
   **„Copy" → „Copy as cURL"**.

> ⚠️ **Vorsicht mit HAR-Dateien:** Ein „Save all as HAR" enthält **Cookies und
> Login-Token**. Bitte HAR-Dateien **nicht öffentlich** posten — nur per E-Mail,
> oder vorher sensible Daten entfernen.

---

## 8. Bei MIDI-/Geräte-Problemen: das sollte rein

Für Geräte-Bugs (Verbindung, Pull/Push, Effekt senden, IR/NAM-Upload) bitte
zusätzlich angeben:

- **Browser + Version** (z. B. „Chrome 126 unter Linux Mint 21").
- **Betriebssystem.**
- **Genaue Schritte:** Was geklickt, in welcher Reihenfolge?
- Alle Zeilen mit `[GP-200]` — besonders die **Hex-Dumps** `pull rx:` / `pull tx:`.
- Ob das Gerät woanders (offizieller Valeton-Editor) normal funktioniert.

Hintergrund: Mehrere offene Themen (USB-Captures, IR-/NAM-Upload, SysEx) lassen
sich **nur** mit echten Mitschnitten vom Gerät lösen — siehe die
[GitHub Issues](https://github.com/phash/gp200editor/issues).

---

## 9. Datenschutz — vor dem Verschicken kurz prüfen

Konsolen- und Netzwerk-Logs können Daten enthalten wie:

- Preset- und Autoren-Namen,
- deine E-Mail-Adresse / Benutzername,
- Login-Token (vor allem in HAR-Dateien).

Schau die Logs vor dem öffentlichen Posten kurz durch und **schwärze, was du nicht
teilen möchtest**. Sensibles am besten per E-Mail statt im öffentlichen Issue.

---

## 10. Wohin damit?

| Weg | Wann |
|-----|------|
| **GitHub-Issue:** <https://github.com/phash/gp200editor/issues> | Bugs, Feature-Wünsche, Captures (öffentlich nachvollziehbar). |
| **E-Mail:** [phash@phash.de](mailto:phash@phash.de) | Wenn die Logs sensible Daten enthalten oder du kein GitHub-Konto hast. |

### Checkliste für eine gute Fehlermeldung

- [ ] Was wolltest du tun? Was ist passiert? Was hattest du erwartet?
- [ ] Browser + Version + Betriebssystem
- [ ] Schritte zum Nachstellen (1, 2, 3 …)
- [ ] Konsolen-Log (Datei, Text-Block oder Screenshot mit Stack-Trace)
- [ ] Bei Server-Fehlern: Network-Status + Response
- [ ] Bei Geräte-Fehlern: alle `[GP-200]`-Zeilen inkl. Hex-Dumps
- [ ] Sensible Daten geprüft / geschwärzt

Danke fürs Mithelfen — jeder Mitschnitt macht Preset Forge stabiler. 🎸
