import type { Guide } from './types';

export const GP200_ON_LINUX_EN: Guide = {
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

export const GP200_EDITOR_EN: Guide = {
  slug: 'valeton-gp-200-editor',
  title: 'Valeton GP-200 Editor for Windows, Mac and Linux',
  description:
    'Edit Valeton GP-200 presets on any computer: what the official editor does, where it stops, and how the free Preset Forge browser editor fills the gaps.',
  updated: '2026-10-17',
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
        'Connect the GP-200 over USB to edit live: every change is sent to the pedal straight away (Chrome or Edge).',
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
        'Open preset-forge.com/editor in Chrome or Edge.',
        'Connect the GP-200 with a USB cable and click “Connect GP-200”. Allow MIDI access when the browser asks.',
        'Click “Load” to pull the current preset from the pedal, or drop a .prst file onto the page.',
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
  title: 'What is a .prst file? Opening Valeton GP-200 presets',
  description:
    'A .prst file is a Valeton GP-200 preset. Learn what it contains, how to open and edit one in the browser, and how to load it onto your pedal.',
  updated: '2026-10-17',
  intro:
    'If you download a GP-200 preset from a forum, a friend or a preset site, you get a file ending in .prst. Your computer will not know what to do with it, and opening it in a text editor shows only gibberish. This guide explains what is inside a .prst file and how to open, edit and use one.',
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
        'Connect the GP-200 over USB and click “Connect GP-200” (Chrome or Edge).',
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
