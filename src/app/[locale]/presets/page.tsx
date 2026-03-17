import { redirect } from 'next/navigation';
import { getTranslations, getLocale } from 'next-intl/server';
import { prisma } from '@/lib/prisma';
import { validateSession } from '@/lib/session';
import { PresetList } from './PresetList';

export default async function PresetsPage() {
  const { user } = await validateSession();
  if (!user) {
    const locale = await getLocale();
    redirect(`/${locale}/auth/login`);
  }

  const t = await getTranslations('presets');

  const presets = await prisma.preset.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      description: true,
      tags: true,
      modules: true,
      public: true,
      shareToken: true,
      downloadCount: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <h1
        className="font-mono-display text-xl font-bold tracking-tight mb-6"
        style={{ color: 'var(--accent-amber)' }}
      >
        {t('title')}
      </h1>
      <PresetList initialPresets={presets} />
    </main>
  );
}
