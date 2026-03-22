import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import { GalleryClient } from './GalleryClient';
import { HelpButton } from '@/components/HelpButton';

const BASE_URL = 'https://preset-forge.com';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: 'Preset Gallery — Browse & Share GP-200 Presets | Preset Forge',
    description: 'Browse community presets for the Valeton GP-200. Filter by effect type across 305 effects, download presets directly into the editor, and share your own tones. Free, no account needed to browse.',
    alternates: {
      canonical: `${BASE_URL}/${locale}/gallery`,
      languages: { de: `${BASE_URL}/de/gallery`, en: `${BASE_URL}/en/gallery` },
    },
    openGraph: {
      title: 'GP-200 Preset Gallery — 305 Effects, Community Sharing | Preset Forge',
      description: 'Discover Valeton GP-200 presets shared by the community. Filter by amp, distortion, delay, reverb and 305 other effects. Download and edit in the browser — works on Linux, Windows, macOS.',
      images: [{ url: `${BASE_URL}/og-image.png`, width: 1200, height: 630 }],
    },
  };
}

export default async function GalleryPage() {
  const t = await getTranslations('gallery');

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <h1
          className="font-mono-display text-xl font-bold tracking-tight"
          style={{ color: 'var(--accent-amber)' }}
        >
          {t('title')}
        </h1>
        <HelpButton section="gallery" />
      </div>
      <GalleryClient />
    </main>
  );
}
