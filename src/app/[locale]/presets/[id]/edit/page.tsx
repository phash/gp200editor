import { notFound, redirect } from 'next/navigation';
import { getTranslations, getLocale } from 'next-intl/server';
import { prisma } from '@/lib/prisma';
import { validateSession } from '@/lib/session';
import { PresetEditForm } from './PresetEditForm';

type Props = {
  params: Promise<{ id: string }>;
};

export default async function EditPresetPage({ params }: Props) {
  const { user } = await validateSession();
  if (!user) {
    const locale = await getLocale();
    redirect(`/${locale}/auth/login`);
  }

  const { id } = await params;

  const preset = await prisma.preset.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      description: true,
      tags: true,
      shareToken: true,
      userId: true,
    },
  });

  if (!preset) notFound();
  if (preset.userId !== user.id) notFound();

  const t = await getTranslations('presets');

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">{t('editPreset')}</h1>
      <PresetEditForm preset={preset} />
    </main>
  );
}
