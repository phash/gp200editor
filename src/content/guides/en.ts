import type { Guide } from './types';

export const GP200_ON_LINUX_EN: Guide = {
  slug: 'gp-200-on-linux',
  title: 'How to use the Valeton GP-200 on Linux',
  description:
    "The official Valeton GP-200 editor is Windows-only. Here's how to edit, organise, and live-control your GP-200 presets on Linux with Preset Forge in Chrome, Chromium or Firefox.",
  updated: '2026-10-22',
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
        'Editing presets works in any modern browser on Linux. Live USB-MIDI control — sending changes to the pedal in real time — needs the Web MIDI API. On Linux that means a Chromium-based browser (Chrome, Chromium, Brave, Edge) or Firefox 108 or newer. The first time you connect, Firefox offers to install a small site-permission add-on for MIDI; accept it once and from then on Firefox asks for MIDI access just like Chrome. WebKit browsers such as GNOME Web do not implement Web MIDI.',
      ],
      steps: [
        'A Linux machine (tested on Linux Mint; any distro with a current Chromium or Firefox works).',
        'Chrome, Chromium, Brave, Edge, or Firefox 108+ for live MIDI — any browser is fine for offline editing.',
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
        'Open the editor in Chrome, Chromium or Firefox and click “Connect GP-200”.',
        'The browser asks for permission to access MIDI devices (including SysEx). Click Allow — that is what lets Preset Forge talk to the pedal. In Firefox, the very first connection installs a one-time MIDI site-permission add-on before this prompt appears.',
        'Preset Forge runs through Identity, Firmware Check, and Slot Names; the device bar at the top then shows the connected pedal.',
        'Edit as normal: toggling effects, changing parameters, and reordering the chain are sent to the GP-200 instantly. Use “Load” to pull a preset off the device and “Save to [Slot]” to write your changes back.',
        'Load a .prst file while the pedal is connected and Preset Forge pushes the whole preset to the GP-200 automatically, block by block, with a progress bar in the device bar. You can keep editing meanwhile; loading another preset or disconnecting cancels the running push. The pushed preset is a live preview until you save it to a slot.',
      ],
    },
    {
      heading: 'Troubleshooting on Linux',
      steps: [
        '“Connect” does nothing or no permission prompt appears: you are probably in Safari or another WebKit browser, or on a phone or tablet — mobile browsers do not support Web MIDI. Use Chrome, Chromium, Brave, Edge, or Firefox 108+ on the desktop. In Firefox, make sure you accepted the MIDI site-permission add-on.',
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

export const GP200_EDITOR_EN: Guide = {
  slug: 'valeton-gp-200-editor',
  title: 'Valeton GP-200 Editor for Windows, Mac and Linux',
  description:
    'Edit Valeton GP-200 presets on any computer: what the official editor does, where it stops, and how the free Preset Forge browser editor fills the gaps.',
  updated: '2026-10-22',
  intro:
    'Turning knobs on the GP-200 itself works, but building a preset on a small screen is slow. A software editor shows the whole signal chain at once, lets you save presets as files and share them. This guide compares the two ways to edit the GP-200 from a computer: Valeton’s official desktop app and Preset Forge, a free editor that runs in the browser.',
  sections: [
    {
      heading: 'What a GP-200 editor does',
      body: [
        'Every GP-200 preset is a chain of eleven blocks: PRE, WAH, DST, AMP, NR, CAB, EQ, MOD, DLY, RVB and VOL. Each block holds one effect with up to fifteen parameters. An editor lets you switch blocks on and off, pick the effect type, set the parameters and change the order of the chain.',
        'Presets are stored as .prst files. An editor reads and writes these files, so you can back up your sounds, download presets from other players and keep different versions of a tone.',
      ],
    },
    {
      heading: 'The official Valeton editor',
      body: [
        'Valeton publishes its own GP-200 editor as a desktop application for Windows. It talks to the pedal over USB and is also the tool for firmware updates, so keep it at hand even if you edit your presets elsewhere.',
        'Outside Windows the choice gets thin: there is no native Linux build, and running the Windows app under Wine or in a virtual machine is fiddly when a USB MIDI device is involved.',
      ],
    },
    {
      heading: 'Preset Forge: a GP-200 editor in the browser',
      body: [
        'Preset Forge is a free, unofficial editor that runs in the browser. There is nothing to install, it works on Windows, macOS, Linux and ChromeOS, and after the first visit it also works offline as a PWA.',
      ],
      steps: [
        'Load a .prst file by dragging it onto the editor, edit every block and parameter, and save it back as a .prst file.',
        'Connect the GP-200 over USB to edit live: every change is sent to the pedal straight away (Chrome, Edge or Firefox).',
        'Pull a preset off the pedal with “Load” and write it back to a slot with “Save to [Slot]”.',
        'Import Line6 HX Stomp .hlx presets and convert them to GP-200 format (experimental).',
        'Browse the community gallery and download presets, filtered by amp model, effect or style.',
        'Build setlists with timed cue points that switch presets on the pedal during a song.',
      ],
      links: [
        { href: '/editor', label: 'Open the editor' },
        { href: '/gallery', label: 'Browse the preset gallery' },
      ],
    },
    {
      heading: 'Which one should you use?',
      body: [
        'Use Valeton’s app for firmware updates and if you are on Windows and happy with it. Use Preset Forge if you are on a Mac, Linux or a Chromebook, if you want to edit on a computer where you cannot install software, or if you want to share presets and use setlists.',
        'Both work with the same .prst files, so you can switch between them at any time.',
      ],
    },
    {
      heading: 'Getting started in five minutes',
      steps: [
        'Open preset-forge.com/editor in a desktop browser with Web MIDI: Chrome, Edge or Firefox 108+.',
        'Connect the GP-200 with a USB cable and click “Connect GP-200”. Allow MIDI access when the browser asks.',
        'Click “Load” to pull the current preset from the pedal, or drop a .prst file onto the page — it is sent to the connected pedal automatically.',
        'Change effects and parameters — with the pedal connected you hear each change immediately.',
        'Save with “Save to [Slot]” on the pedal, or with “Save preset as file” on your computer.',
      ],
      links: [
        { href: '/guides/prst-file', label: 'What is a .prst file?' },
        { href: '/guides/gp-200-on-linux', label: 'Using the GP-200 on Linux' },
      ],
    },
  ],
};

export const PRST_FILE_EN: Guide = {
  slug: 'prst-file',
  title: 'What is a .prst file? The Valeton GP-200 preset format',
  description:
    'A .prst file is one Valeton GP-200 preset: a 1224-byte binary file with the patch name and all 11 effect blocks. Open and edit it free in your browser.',
  updated: '2026-10-31',
  intro:
    'A .prst file is a single preset for the Valeton GP-200 multi-effects pedal. It is a small binary file — 1224 bytes for a user preset — that stores the preset name, the author and the settings of all eleven effect blocks. You open it with a GP-200 editor: Valeton’s own software, or Preset Forge, which opens .prst files directly in the browser. A text editor only shows gibberish because the file is binary. This guide explains what is inside, how to open and edit a .prst file, and how to get it onto your pedal.',
  sections: [
    {
      heading: 'What a .prst file is',
      body: [
        'PRST stands for preset. A .prst file holds exactly one preset for the Valeton GP-200 multi-effects pedal. It is a small binary file: user presets are exactly 1224 bytes. Because it is binary, a text editor cannot show it in a useful way.',
      ],
    },
    {
      heading: 'What is inside',
      steps: [
        'The preset name and the author name, each up to 16 characters.',
        'Eleven effect blocks in a fixed set: PRE, WAH, DST, AMP, NR, CAB, EQ, MOD, DLY, RVB and VOL.',
        'For each block: whether it is on or off, which effect it uses, and up to fifteen parameter values.',
        'The order of the signal chain, plus the expression pedal and controller assignments.',
        'A checksum at the end, which the pedal uses to reject damaged files.',
      ],
    },
    {
      heading: 'The technical layout of a .prst file',
      body: [
        'For the curious: the format is not published by Valeton, but it has been worked out byte by byte. All numbers in the effect blocks are little-endian; the checksum at the end is stored big-endian.',
        'Factory presets are slightly shorter — 1176 bytes — and have no checksum footer. Preset Forge opens both kinds and writes standard 1224-byte user presets.',
      ],
      steps: [
        'The file starts with the four characters TSRP — “PRST” backwards — which mark it as a preset. A little later comes the device ID 2-PG (“GP-2” backwards) and a format version.',
        'The preset name and the author follow at fixed positions, 16 ASCII characters each.',
        'A routing section stores the order of the signal chain and the FX loop send and return positions.',
        'Then come eleven effect blocks of 72 bytes each: the slot number, an on/off flag, a 32-bit effect code whose high byte names the module (for example AMP, DLY or RVB), and fifteen parameter values stored as 32-bit floating-point numbers.',
        'The last two bytes are a checksum: the sum of all preceding bytes. The pedal uses it to reject damaged files, and Preset Forge recalculates it every time you save.',
      ],
    },
    {
      heading: 'How to open a .prst file',
      body: [
        'You need a GP-200 editor. Preset Forge opens .prst files directly in the browser, on Windows, macOS and Linux, without installing anything.',
      ],
      steps: [
        'Open the editor.',
        'Drag the .prst file onto the page, or click “Load preset from disk” and pick the file.',
        'The editor shows the full signal chain. Click a block to see and change its parameters.',
      ],
      links: [{ href: '/editor', label: 'Open a .prst file in the editor' }],
    },
    {
      heading: 'Loading a .prst file onto the GP-200',
      steps: [
        'Open the .prst file in the editor as described above.',
        'Connect the GP-200 over USB and click “Connect GP-200” (Chrome, Edge or Firefox).',
        'Choose the target slot on the pedal and click “Save to [Slot]”. The preset is written to the GP-200 and is ready to play.',
      ],
    },
    {
      heading: 'Where to find .prst files',
      body: [
        'The Preset Forge gallery has more than 150 free GP-200 presets, sorted by the amp model they are built on. Each one downloads as a .prst file or opens straight in the editor. You can also upload your own presets and share them with a link.',
      ],
      links: [
        { href: '/gallery', label: 'Free GP-200 presets' },
        { href: '/amp/marshall-jcm800', label: 'Marshall JCM800 presets' },
        { href: '/amp/fender-65-twin-reverb', label: "Fender '65 Twin Reverb presets" },
      ],
    },
    {
      heading: 'Common problems',
      steps: [
        'The file will not load: check that it is a GP-200 preset. Files from other Valeton models are not supported.',
        'The file was renamed or zipped: unpack it first and make sure it ends in .prst.',
        'You have a Line6 HX Stomp preset (.hlx) instead: load it in the editor anyway — Preset Forge converts it to GP-200 format (experimental).',
      ],
    },
  ],
};

export const GUIDES_EN: Record<string, Guide> = {
  [GP200_EDITOR_EN.slug]: GP200_EDITOR_EN,
  [PRST_FILE_EN.slug]: PRST_FILE_EN,
  [GP200_ON_LINUX_EN.slug]: GP200_ON_LINUX_EN,
};
