import { LOCALES, type Locale } from '@/i18n/locales';

/**
 * Long-form guide content. Lives here rather than in messages/*.json so the
 * prose stays out of the flat key-parity system (it would dwarf the UI strings
 * and a missing paragraph shouldn't fail the parity test). Each guide is
 * authored per locale; a slug only renders a page for locales present in
 * GUIDES, and its hreflang set is exactly those locales. Locales without a
 * translation fall back to the English guide on the /guides index (flagged
 * with a badge) and are excluded from that guide's sitemap + hreflang.
 *
 * First entry: "GP-200 on Linux" — the site's unique angle (the official
 * Valeton editor is Windows-only). Follow-up guides (HX Stomp comparison,
 * effects glossary) and the ES/FR/IT/PT translations are tracked in
 * docs/content-roadmap.md.
 */

export type GuideSection = {
  heading: string;
  /** Prose paragraphs rendered as <p>. */
  body?: string[];
  /** Optional ordered steps rendered as <ol>. */
  steps?: string[];
};

export type Guide = {
  slug: string;
  /** H1 + meta title core. */
  title: string;
  /** Meta description. */
  description: string;
  /** ISO date — drives <time>, sitemap lastmod, and Article.dateModified. */
  updated: string;
  /** Lead paragraph under the H1. */
  intro: string;
  sections: GuideSection[];
};

const GP200_ON_LINUX_EN: Guide = {
  slug: 'gp-200-on-linux',
  title: 'How to use the Valeton GP-200 on Linux',
  description:
    "The official Valeton GP-200 editor is Windows-only. Here's how to edit, organise, and live-control your GP-200 presets on Linux with Preset Forge and a Chromium-based browser.",
  updated: '2026-05-30',
  intro:
    "The Valeton GP-200 is a capable multi-effects floor unit, but its official editor only runs on Windows. If you're on Linux — Mint, Ubuntu, Fedora, Arch, or anything else — you don't have to dual-boot or spin up a Windows VM just to tweak your tone. Preset Forge runs entirely in the browser and is the only GP-200 editor with real Linux support. This guide covers the whole workflow: editing presets, and live USB-MIDI control straight from a Linux machine.",
  sections: [
    {
      heading: 'Why Linux users need a different editor',
      body: [
        'Valeton ships its GP-200 editor as a Windows desktop application. There is no native Linux build, and no macOS build either. For years that left Linux guitarists editing presets by hand on the unit’s small screen, or keeping a Windows machine around purely for tone tweaks.',
        'Preset Forge replaces that workflow. It is a web app: open it in a browser, load a .prst file, and edit every effect slot, every parameter, and the full signal chain. Nothing is installed, and your presets never leave your machine unless you choose to share them.',
      ],
    },
    {
      heading: 'What you need',
      body: [
        'Editing presets works in any modern browser on Linux. Live USB-MIDI control — sending changes to the pedal in real time — needs the Web MIDI API, which on Linux is only available in Chromium-based browsers (Chrome, Chromium, Brave, Edge). Firefox and WebKit browsers do not implement Web MIDI.',
      ],
      steps: [
        'A Linux machine (tested on Linux Mint; any distro with a current Chromium works).',
        'Google Chrome, Chromium, Brave, or Edge for live MIDI — any browser is fine for offline editing.',
        'A USB cable to connect the GP-200 (only needed for live editing).',
        'Optionally, your existing .prst preset files.',
      ],
    },
    {
      heading: 'Editing presets in the browser',
      steps: [
        'Open the editor at preset-forge.com/editor.',
        'Drag a .prst file onto the page, or start from a preset in the community gallery.',
        'Adjust any effect: toggle slots on and off, change effect types, and turn the parameter knobs.',
        'Reorder the signal chain by dragging slots — or, for keyboard users, focus a slot and use the arrow keys to move it.',
        'Save the edited preset back to a .prst file, ready to send live or copy onto the device.',
      ],
    },
    {
      heading: 'Connecting the GP-200 over USB MIDI on Linux',
      body: [
        'The GP-200 is a class-compliant USB MIDI device, so Linux recognises it without any driver. ALSA exposes it to the browser automatically — there are no udev rules or kernel modules to configure for normal use.',
      ],
      steps: [
        'Plug the GP-200 into your computer with a USB cable and power it on.',
        'Open the editor in Chrome or Chromium and click “Connect GP-200”.',
        'The browser asks for permission to access MIDI devices (including SysEx). Click Allow — that is what lets Preset Forge talk to the pedal.',
        'Preset Forge runs through Identity, Firmware Check, and Slot Names; the device bar at the top then shows the connected pedal.',
        'Edit as normal: toggling effects, changing parameters, and reordering the chain are sent to the GP-200 instantly. Use “Load” to pull a preset off the device and “Save to [Slot]” to write your changes back.',
      ],
    },
    {
      heading: 'Troubleshooting on Linux',
      steps: [
        '“Connect” does nothing or no permission prompt appears: you are probably in Firefox or Safari. Switch to Chrome, Chromium, Brave, or Edge — Web MIDI is not available elsewhere.',
        'The pedal is not listed: make sure no other application (a DAW, another browser tab, or a MIDI tool) is already holding the device — ALSA gives exclusive access. Close it and reconnect.',
        'Permission was blocked: click the lock / MIDI icon in the address bar, re-enable MIDI for preset-forge.com, and reload.',
        'Firmware differences: Preset Forge is verified against firmware 1.8.0. Other versions usually work, but if something behaves oddly, check your firmware version first.',
      ],
    },
    {
      heading: 'Does it work offline?',
      body: [
        'Yes. Preset Forge is a PWA, so after your first visit the editor loads without a connection — handy at a rehearsal space or on stage with no Wi-Fi. The community gallery and sharing need the network, but editing and live USB-MIDI control do not.',
      ],
    },
  ],
};

const GP200_ON_LINUX_DE: Guide = {
  slug: 'gp-200-on-linux',
  title: 'Valeton GP-200 unter Linux nutzen',
  description:
    'Der offizielle Valeton-GP-200-Editor läuft nur unter Windows. So bearbeitest und steuerst du deine GP-200-Presets unter Linux – live per USB-MIDI, mit Preset Forge und einem Chromium-Browser.',
  updated: '2026-05-30',
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
        'Das Bearbeiten von Presets funktioniert in jedem modernen Browser unter Linux. Für die Live-Steuerung per USB-MIDI – Änderungen in Echtzeit ans Pedal senden – wird die Web-MIDI-API benötigt, die unter Linux nur in Chromium-basierten Browsern verfügbar ist (Chrome, Chromium, Brave, Edge). Firefox und WebKit-Browser unterstützen Web MIDI nicht.',
      ],
      steps: [
        'Einen Linux-Rechner (getestet unter Linux Mint; jede Distribution mit aktuellem Chromium funktioniert).',
        'Google Chrome, Chromium, Brave oder Edge für Live-MIDI – zum reinen Offline-Bearbeiten genügt jeder Browser.',
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
        'Öffne den Editor in Chrome oder Chromium und klicke auf „Connect GP-200“.',
        'Der Browser fragt nach der Berechtigung für MIDI-Geräte (inklusive SysEx). Klicke auf Zulassen – das erlaubt Preset Forge die Kommunikation mit dem Pedal.',
        'Preset Forge durchläuft Identity, Firmware-Check und Slot-Namen; die Geräteleiste oben zeigt anschließend das verbundene Pedal.',
        'Bearbeite wie gewohnt: Effekte schalten, Parameter ändern und die Kette umsortieren werden sofort an den GP-200 gesendet. Mit „Load“ holst du ein Preset vom Gerät, mit „Save to [Slot]“ schreibst du deine Änderungen zurück.',
      ],
    },
    {
      heading: 'Fehlerbehebung unter Linux',
      steps: [
        '„Connect“ reagiert nicht oder es erscheint keine Berechtigungsabfrage: Du bist vermutlich in Firefox oder Safari. Wechsle zu Chrome, Chromium, Brave oder Edge – Web MIDI ist anderswo nicht verfügbar.',
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

/** Guide content keyed by locale -> slug. Only locales present here render a
 *  page for that slug. */
export const GUIDES: Partial<Record<Locale, Record<string, Guide>>> = {
  en: { [GP200_ON_LINUX_EN.slug]: GP200_ON_LINUX_EN },
  de: { [GP200_ON_LINUX_DE.slug]: GP200_ON_LINUX_DE },
};

/** Canonical slug order for the /guides index. */
export const GUIDE_SLUGS = ['gp-200-on-linux'] as const;

/** The exact guide for a (locale, slug), or null when that locale has no
 *  translation of it. */
export function getGuide(locale: Locale, slug: string): Guide | null {
  return GUIDES[locale]?.[slug] ?? null;
}

/** Locales that have a translation of this slug — its hreflang set and the
 *  basis for generateStaticParams. */
export function guideLocales(slug: string): Locale[] {
  return LOCALES.filter((l) => GUIDES[l]?.[slug]);
}

/** Every (locale, slug) pair with real content, for generateStaticParams. */
export function allGuideParams(): { locale: Locale; slug: string }[] {
  return (Object.keys(GUIDES) as Locale[]).flatMap((locale) =>
    Object.keys(GUIDES[locale] ?? {}).map((slug) => ({ locale, slug })),
  );
}

export type GuideIndexRow = { slug: string; guide: Guide; localized: boolean };

/** Index rows for a preferred locale: the localized guide when it exists,
 *  otherwise the English fallback flagged `localized: false`. */
export function listGuidesForIndex(preferred: Locale): GuideIndexRow[] {
  return GUIDE_SLUGS.flatMap((slug): GuideIndexRow[] => {
    const localized = GUIDES[preferred]?.[slug];
    if (localized) return [{ slug, guide: localized, localized: true }];
    const fallback = GUIDES.en?.[slug];
    return fallback ? [{ slug, guide: fallback, localized: false }] : [];
  });
}
