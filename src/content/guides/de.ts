import type { Guide } from './types';

export const GP200_ON_LINUX_DE: Guide = {
  slug: 'gp-200-on-linux',
  title: 'Valeton GP-200 unter Linux nutzen',
  description:
    'Der offizielle Valeton-GP-200-Editor läuft nur unter Windows. So bearbeitest und steuerst du deine GP-200-Presets unter Linux – live per USB-MIDI, mit Preset Forge in Chrome, Chromium oder Firefox.',
  updated: '2026-10-22',
  intro:
    'Der Valeton GP-200 ist ein leistungsfähiges Multieffekt-Bodengerät, doch der offizielle Editor läuft ausschließlich unter Windows. Wenn du Linux nutzt – Mint, Ubuntu, Fedora, Arch oder etwas anderes – brauchst du dafür kein Dual-Boot und keine Windows-VM. Preset Forge läuft komplett im Browser und ist der einzige GP-200-Editor mit echter Linux-Unterstützung. Diese Anleitung deckt den ganzen Ablauf ab: Presets bearbeiten und live per USB-MIDI direkt vom Linux-Rechner steuern.',
  sections: [
    {
      heading: 'Warum Linux-Nutzer einen anderen Editor brauchen',
      body: [
        'Valeton liefert den GP-200-Editor als Windows-Desktop-Anwendung aus. Es gibt keine native Linux-Version – und auch keine für macOS. Jahrelang blieb Linux-Gitarrist:innen nur, Presets mühsam am kleinen Gerätedisplay zu bearbeiten oder einen Windows-Rechner allein fürs Sound-Tuning bereitzuhalten.',
        'Preset Forge ersetzt diesen Umweg. Es ist eine Web-App: im Browser öffnen, eine .prst-Datei laden und jeden Effekt-Slot, jeden Parameter und die komplette Signalkette bearbeiten. Es wird nichts installiert, und deine Presets verlassen deinen Rechner nur, wenn du sie selbst teilst.',
      ],
    },
    {
      heading: 'Was du brauchst',
      body: [
        'Das Bearbeiten von Presets funktioniert in jedem modernen Browser unter Linux. Für die Live-Steuerung per USB-MIDI – Änderungen in Echtzeit ans Pedal senden – wird die Web-MIDI-API benötigt. Unter Linux heißt das: ein Chromium-basierter Browser (Chrome, Chromium, Brave, Edge) oder Firefox ab Version 108. Beim ersten Verbinden bietet Firefox an, ein kleines Website-Berechtigungs-Add-on für MIDI zu installieren; einmal bestätigen, danach fragt Firefox den MIDI-Zugriff genauso ab wie Chrome. WebKit-Browser wie GNOME Web unterstützen Web MIDI nicht.',
      ],
      steps: [
        'Einen Linux-Rechner (getestet unter Linux Mint; jede Distribution mit aktuellem Chromium oder Firefox funktioniert).',
        'Chrome, Chromium, Brave, Edge oder Firefox ab 108 für Live-MIDI – zum reinen Offline-Bearbeiten genügt jeder Browser.',
        'Ein USB-Kabel für die Verbindung zum GP-200 (nur fürs Live-Bearbeiten nötig).',
        'Optional deine vorhandenen .prst-Preset-Dateien.',
      ],
    },
    {
      heading: 'Presets im Browser bearbeiten',
      steps: [
        'Öffne den Editor unter preset-forge.com/editor.',
        'Zieh eine .prst-Datei auf die Seite oder starte mit einem Preset aus der Community-Galerie.',
        'Passe jeden Effekt an: Slots ein- und ausschalten, Effekttypen wechseln und an den Parameter-Reglern drehen.',
        'Ordne die Signalkette per Drag-and-drop neu – oder fokussiere als Tastaturnutzer:in einen Slot und verschiebe ihn mit den Pfeiltasten.',
        'Speichere das bearbeitete Preset wieder als .prst-Datei – bereit zum Live-Senden oder zum Kopieren aufs Gerät.',
      ],
    },
    {
      heading: 'Den GP-200 unter Linux per USB-MIDI verbinden',
      body: [
        'Der GP-200 ist ein klassenkonformes USB-MIDI-Gerät, daher erkennt Linux ihn ohne Treiber. ALSA stellt ihn dem Browser automatisch bereit – für den normalen Betrieb sind keine udev-Regeln oder Kernel-Module einzurichten.',
      ],
      steps: [
        'Verbinde den GP-200 per USB-Kabel mit dem Rechner und schalte ihn ein.',
        'Öffne den Editor in Chrome, Chromium oder Firefox und klicke auf „GP-200 verbinden“.',
        'Der Browser fragt nach der Berechtigung für MIDI-Geräte (inklusive SysEx). Klicke auf Zulassen – das erlaubt Preset Forge die Kommunikation mit dem Pedal. In Firefox wird beim allerersten Verbinden vorher einmalig ein MIDI-Berechtigungs-Add-on installiert.',
        'Preset Forge durchläuft Identity, Firmware-Check und Slot-Namen; die Geräteleiste oben zeigt anschließend das verbundene Pedal.',
        'Bearbeite wie gewohnt: Effekte schalten, Parameter ändern und die Kette umsortieren werden sofort an den GP-200 gesendet. Mit „Laden“ holst du ein Preset vom Gerät, mit „Auf [Slot] speichern“ schreibst du deine Änderungen zurück.',
        'Lädst du bei verbundenem Pedal eine .prst-Datei, schickt Preset Forge das komplette Preset automatisch an den GP-200 – Block für Block, mit Fortschrittsbalken in der Geräteleiste. Du kannst währenddessen weiterarbeiten; ein neu geladenes Preset oder das Trennen bricht die laufende Übertragung ab. Das übertragene Preset ist eine Live-Vorschau, bis du es auf einem Slot speicherst.',
      ],
    },
    {
      heading: 'Fehlerbehebung unter Linux',
      steps: [
        '„Connect“ reagiert nicht oder es erscheint keine Berechtigungsabfrage: Du bist vermutlich in Safari bzw. einem anderen WebKit-Browser oder auf Smartphone/Tablet – mobile Browser unterstützen Web MIDI nicht. Nimm am Desktop Chrome, Chromium, Brave, Edge oder Firefox ab 108. In Firefox: Prüfe, ob du das MIDI-Berechtigungs-Add-on bestätigt hast.',
        'Das Pedal wird nicht aufgelistet: Stelle sicher, dass keine andere Anwendung (eine DAW, ein anderer Browser-Tab oder ein MIDI-Tool) das Gerät bereits belegt – ALSA vergibt exklusiven Zugriff. Schließe sie und verbinde neu.',
        'Berechtigung wurde blockiert: Klicke auf das Schloss-/MIDI-Symbol in der Adressleiste, aktiviere MIDI für preset-forge.com wieder und lade neu.',
        'Firmware-Unterschiede: Preset Forge ist gegen Firmware 1.8.0 verifiziert. Andere Versionen funktionieren meist, aber wenn sich etwas seltsam verhält, prüfe zuerst deine Firmware-Version.',
      ],
    },
    {
      heading: 'Funktioniert es offline?',
      body: [
        'Ja. Preset Forge ist eine PWA: Nach dem ersten Besuch lädt der Editor auch ohne Verbindung – praktisch im Proberaum oder auf der Bühne ohne WLAN. Galerie und Teilen brauchen das Netz, das Bearbeiten und die Live-USB-MIDI-Steuerung nicht.',
      ],
    },
  ],
};

export const GP200_EDITOR_DE: Guide = {
  slug: 'valeton-gp-200-editor',
  title: 'Valeton GP-200 Editor für Windows, Mac und Linux',
  description:
    'GP-200-Presets am Rechner bearbeiten: Was der offizielle Valeton GP-200 Editor kann, wo er endet und wie der kostenlose Browser-Editor Preset Forge hilft.',
  updated: '2026-10-22',
  intro:
    'Am GP-200 selbst an den Reglern zu drehen funktioniert – aber ein Preset auf dem kleinen Display zusammenzubauen dauert. Ein Software-Editor zeigt dir die komplette Signalkette auf einen Blick, speichert Presets als Dateien und macht sie teilbar. Diese Anleitung vergleicht die zwei Wege, den GP-200 vom Rechner aus zu bearbeiten: den offiziellen Valeton GP-200 Editor als Desktop-App und Preset Forge, einen kostenlosen Editor, der im Browser läuft.',
  sections: [
    {
      heading: 'Was ein GP-200-Editor macht',
      body: [
        'Jedes GP-200-Preset ist eine Kette aus elf Blöcken: PRE, WAH, DST, AMP, NR, CAB, EQ, MOD, DLY, RVB und VOL. Jeder Block enthält einen Effekt mit bis zu fünfzehn Parametern. Mit einem Editor schaltest du Blöcke ein und aus, wählst den Effekttyp, stellst die Parameter ein und änderst die Reihenfolge der Kette.',
        'Presets werden als .prst-Dateien gespeichert. Ein Editor liest und schreibt diese Dateien – so kannst du deine Sounds sichern, Presets von anderen Spieler:innen herunterladen und verschiedene Versionen eines Sounds aufheben.',
      ],
    },
    {
      heading: 'Der offizielle Valeton-Editor',
      body: [
        'Valeton bietet einen eigenen GP-200-Editor als Desktop-Anwendung für Windows an. Er spricht per USB mit dem Pedal und ist außerdem das Werkzeug für Firmware-Updates – behalte ihn also griffbereit, auch wenn du deine Presets woanders bearbeitest.',
        'Außerhalb von Windows wird es dünn: Es gibt keine native Linux-Version, und die Windows-App unter Wine oder in einer virtuellen Maschine zu betreiben, ist mit einem USB-MIDI-Gerät eine ziemliche Fummelei.',
      ],
    },
    {
      heading: 'Preset Forge: ein GP-200-Editor im Browser',
      body: [
        'Preset Forge ist ein kostenloser, inoffizieller Editor, der im Browser läuft. Du installierst nichts, er funktioniert unter Windows, macOS, Linux und ChromeOS, und nach dem ersten Besuch läuft er als PWA auch offline.',
      ],
      steps: [
        'Lade eine .prst-Datei per Drag-and-drop in den Editor, bearbeite jeden Block und jeden Parameter und speichere sie wieder als .prst-Datei.',
        'Verbinde den GP-200 per USB und bearbeite live: Jede Änderung geht sofort ans Pedal (Chrome, Edge oder Firefox).',
        'Hol dir mit „Laden“ ein Preset vom Pedal und schreib es mit „Auf [Slot] speichern“ in einen Slot zurück.',
        'Importiere Line6-HX-Stomp-Presets (.hlx) und wandle sie ins GP-200-Format um (experimentell).',
        'Stöbere in der Community-Galerie und lade Presets herunter – filterbar nach Amp-Modell, Effekt oder Stil.',
        'Stell Setlists mit zeitgesteuerten Cue-Points zusammen, die während eines Songs die Presets am Pedal umschalten.',
      ],
      links: [
        { href: '/editor', label: 'Editor öffnen' },
        { href: '/gallery', label: 'Zur Preset-Galerie' },
      ],
    },
    {
      heading: 'Welcher Editor passt zu dir?',
      body: [
        'Nimm die Valeton-App für Firmware-Updates und wenn du unter Windows arbeitest und damit zufrieden bist. Nimm Preset Forge, wenn du einen Mac, Linux oder ein Chromebook nutzt, an einem Rechner arbeitest, auf dem du keine Software installieren darfst, oder Presets teilen und Setlists nutzen willst.',
        'Beide arbeiten mit denselben .prst-Dateien, du kannst also jederzeit wechseln.',
      ],
    },
    {
      heading: 'In fünf Minuten startklar',
      steps: [
        'Öffne preset-forge.com/editor in einem Desktop-Browser mit Web MIDI: Chrome, Edge oder Firefox ab 108.',
        'Schließ den GP-200 per USB-Kabel an und klicke auf „GP-200 verbinden“. Erlaube den MIDI-Zugriff, wenn der Browser danach fragt.',
        'Klicke auf „Laden“, um das aktuelle Preset vom Pedal zu holen, oder zieh eine .prst-Datei auf die Seite – sie wird automatisch ans verbundene Pedal geschickt.',
        'Ändere Effekte und Parameter – mit angeschlossenem Pedal hörst du jede Änderung sofort.',
        'Speichere mit „Auf [Slot] speichern“ auf dem Pedal oder mit „Preset als Datei speichern“ auf deinem Rechner.',
      ],
      links: [
        { href: '/guides/prst-file', label: 'Was ist eine .prst-Datei?' },
        { href: '/guides/gp-200-on-linux', label: 'Den GP-200 unter Linux nutzen' },
      ],
    },
  ],
};

export const PRST_FILE_DE: Guide = {
  slug: 'prst-file',
  title: '.prst-Datei öffnen: Valeton-GP-200-Presets erklärt',
  description:
    'Eine .prst-Datei ist ein Valeton-GP-200-Preset. So erfährst du, was drinsteckt, wie du eine .prst-Datei im Browser öffnest und bearbeitest und aufs Pedal lädst.',
  updated: '2026-10-22',
  intro:
    'Wenn du ein GP-200-Preset aus einem Forum, von Freund:innen oder einer Preset-Seite herunterlädst, bekommst du eine Datei mit der Endung .prst. Dein Rechner weiß damit nichts anzufangen, und im Texteditor siehst du nur Zeichensalat. Diese Anleitung erklärt, was in einer .prst-Datei steckt und wie du eine .prst-Datei öffnest, bearbeitest und nutzt.',
  sections: [
    {
      heading: 'Was eine .prst-Datei ist',
      body: [
        'PRST steht für Preset. Eine .prst-Datei enthält genau ein Preset für das Multieffektpedal Valeton GP-200. Es ist eine kleine Binärdatei: User-Presets sind exakt 1224 Bytes groß. Weil sie binär ist, kann ein Texteditor sie nicht sinnvoll anzeigen.',
      ],
    },
    {
      heading: 'Was drinsteckt',
      steps: [
        'Der Preset-Name und der Name des Autors, jeweils bis zu 16 Zeichen.',
        'Elf Effektblöcke in fester Besetzung: PRE, WAH, DST, AMP, NR, CAB, EQ, MOD, DLY, RVB und VOL.',
        'Für jeden Block: ob er an oder aus ist, welchen Effekt er nutzt und bis zu fünfzehn Parameterwerte.',
        'Die Reihenfolge der Signalkette sowie die Zuweisungen für Expression-Pedal und Controller.',
        'Eine Prüfsumme am Ende, mit der das Pedal beschädigte Dateien zurückweist.',
      ],
    },
    {
      heading: 'So öffnest du eine .prst-Datei',
      body: [
        'Du brauchst einen GP-200-Editor. Preset Forge öffnet .prst-Dateien direkt im Browser – unter Windows, macOS und Linux, ohne Installation.',
      ],
      steps: [
        'Öffne den Editor.',
        'Zieh die .prst-Datei auf die Seite oder klicke auf „Preset von Festplatte laden“ und wähle die Datei aus.',
        'Der Editor zeigt die komplette Signalkette. Klicke auf einen Block, um seine Parameter zu sehen und zu ändern.',
      ],
      links: [{ href: '/editor', label: '.prst-Datei im Editor öffnen' }],
    },
    {
      heading: 'Eine .prst-Datei auf den GP-200 laden',
      steps: [
        'Öffne die .prst-Datei wie oben beschrieben im Editor.',
        'Verbinde den GP-200 per USB und klicke auf „GP-200 verbinden“ (Chrome, Edge oder Firefox).',
        'Wähle den Ziel-Slot auf dem Pedal und klicke auf „Auf [Slot] speichern“. Das Preset wird auf den GP-200 geschrieben und ist sofort spielbereit.',
      ],
    },
    {
      heading: 'Wo du .prst-Dateien findest',
      body: [
        'Die Galerie von Preset Forge bietet über 150 kostenlose GP-200-Presets, sortiert nach dem Amp-Modell, auf dem sie aufbauen. Jedes lässt sich als .prst-Datei herunterladen oder direkt im Editor öffnen. Du kannst auch eigene Presets hochladen und per Link teilen.',
      ],
      links: [
        { href: '/gallery', label: 'Kostenlose GP-200-Presets' },
        { href: '/amp/marshall-jcm800', label: 'Presets mit Marshall JCM800' },
        { href: '/amp/fender-65-twin-reverb', label: "Presets mit Fender '65 Twin Reverb" },
      ],
    },
    {
      heading: 'Häufige Probleme',
      steps: [
        'Die Datei lädt nicht: Prüfe, ob es wirklich ein GP-200-Preset ist. Dateien anderer Valeton-Modelle werden nicht unterstützt.',
        'Die Datei wurde umbenannt oder gezippt: Entpacke sie zuerst und achte darauf, dass sie auf .prst endet.',
        'Du hast stattdessen ein Line6-HX-Stomp-Preset (.hlx): Lade es trotzdem in den Editor – Preset Forge wandelt es ins GP-200-Format um (experimentell).',
      ],
    },
  ],
};

export const GUIDES_DE: Record<string, Guide> = {
  [GP200_EDITOR_DE.slug]: GP200_EDITOR_DE,
  [PRST_FILE_DE.slug]: PRST_FILE_DE,
  [GP200_ON_LINUX_DE.slug]: GP200_ON_LINUX_DE,
};
