import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'GP-200 Preset Editor — Live USB MIDI, 305 Effects | Preset Forge',
  description: 'Edit Valeton GP-200 presets in the browser. Load .prst files, tweak 305 effects with real parameters, send changes live via USB MIDI. Works on Linux (Linux Mint tested), Windows, and macOS. No install needed.',
  openGraph: {
    title: 'GP-200 Preset Editor — Live USB MIDI Editing | Preset Forge',
    description: 'The only GP-200 editor that runs on Linux. Load presets, edit all 11 effect slots with real parameters, push changes live to your device via USB MIDI. Free, browser-based, offline PWA.',
  },
};

export default function EditorLayout({ children }: { children: React.ReactNode }) {
  return children;
}
