import type { Metadata } from 'next';
import { buildAlternates, BASE_URL, type Locale } from '@/lib/hreflang';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: 'GP-200 Preset Editor for Mac, Linux & Windows — Live USB MIDI | Preset Forge',
    description: 'Edit Valeton GP-200 presets in the browser on Mac, Linux, or Windows. Load .prst files, tweak 305 effects with real parameters, send changes live via USB MIDI. No install needed.',
    alternates: buildAlternates('/editor', locale as Locale),
    openGraph: {
      title: 'GP-200 Preset Editor for Mac, Linux & Windows | Preset Forge',
      description: 'GP-200 editor that runs on Mac, Linux, and Windows. Load presets, edit all 11 effect slots with real parameters, push changes live to your device via USB MIDI. Free, browser-based, offline PWA.',
      images: [{ url: `${BASE_URL}/og-image.png`, width: 1200, height: 630 }],
    },
  };
}

export default function EditorLayout({ children }: { children: React.ReactNode }) {
  return children;
}
