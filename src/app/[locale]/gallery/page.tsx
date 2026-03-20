import { getTranslations } from 'next-intl/server';
import { GalleryClient } from './GalleryClient';
import { HelpButton } from '@/components/HelpButton';

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
