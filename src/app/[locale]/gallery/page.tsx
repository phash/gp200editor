import { getTranslations } from 'next-intl/server';
import { GalleryClient } from './GalleryClient';

export default async function GalleryPage() {
  const t = await getTranslations('gallery');

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      <h1
        className="font-mono-display text-xl font-bold tracking-tight mb-6"
        style={{ color: 'var(--accent-amber)' }}
      >
        {t('title')}
      </h1>
      <GalleryClient />
    </main>
  );
}
