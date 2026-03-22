import type { Metadata } from 'next';

const BASE_URL = 'https://preset-forge.com';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: 'GP-200 Preset Editor — Live USB MIDI, 305 Effects | Preset Forge',
    description: 'Edit Valeton GP-200 presets in the browser. Load .prst files, tweak 305 effects with real parameters, send changes live via USB MIDI. Works on Linux (Linux Mint tested), Windows, and macOS. No install needed.',
    alternates: {
      canonical: `${BASE_URL}/${locale}/editor`,
      languages: { de: `${BASE_URL}/de/editor`, en: `${BASE_URL}/en/editor` },
    },
    openGraph: {
      title: 'GP-200 Preset Editor — Live USB MIDI Editing | Preset Forge',
      description: 'The only GP-200 editor that runs on Linux. Load presets, edit all 11 effect slots with real parameters, push changes live to your device via USB MIDI. Free, browser-based, offline PWA.',
      images: [{ url: `${BASE_URL}/og-image.png`, width: 1200, height: 630 }],
    },
  };
}

export default function EditorLayout({ children }: { children: React.ReactNode }) {
  return children;
}
