import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { prisma } from '@/lib/prisma';

type Props = {
  params: Promise<{ token: string }>;
};

export default async function SharePage({ params }: Props) {
  const { token } = await params;
  const t = await getTranslations('presets');

  const preset = await prisma.preset.findUnique({
    where: { shareToken: token },
    include: { user: { select: { username: true } } },
  });

  if (!preset) notFound();

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <h1
        data-testid="share-preset-name"
        className="text-3xl font-bold mb-4"
      >
        {preset.name}
      </h1>

      {preset.description && (
        <p className="text-gray-700 mb-4">{preset.description}</p>
      )}

      {preset.tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {preset.tags.map((tag) => (
            <span
              key={tag}
              className="px-2 py-1 bg-gray-100 text-gray-700 text-sm rounded"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      <dl className="text-sm text-gray-600 space-y-1 mb-6">
        <div className="flex gap-2">
          <dt>{t('memberSince')}:</dt>
          <dd>@{preset.user.username}</dd>
        </div>
        <div className="flex gap-2">
          <dt>{t('uploadedOn')}:</dt>
          <dd>{new Date(preset.createdAt).toLocaleDateString()}</dd>
        </div>
        <div className="flex gap-2">
          <dt>{preset.downloadCount}</dt>
          <dd>{t('downloads')}</dd>
        </div>
      </dl>

      <a
        href={`/api/share/${token}/download`}
        data-testid="share-download-button"
        className="inline-block px-6 py-3 bg-blue-600 text-white rounded hover:bg-blue-700 transition font-medium"
      >
        {t('download')}
      </a>
    </main>
  );
}
