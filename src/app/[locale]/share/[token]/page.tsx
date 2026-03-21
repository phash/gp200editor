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
      <div
        className="rounded-lg p-6"
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.03)',
        }}
      >
        <h1
          data-testid="share-preset-name"
          className="font-mono-display text-2xl font-bold tracking-tight mb-4"
          style={{ color: 'var(--accent-amber)' }}
        >
          {preset.name}
        </h1>

        {preset.description && (
          <p className="mb-4" style={{ color: 'var(--text-secondary)' }}>
            {preset.description}
          </p>
        )}

        {preset.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-4">
            {preset.tags.map((tag) => (
              <span
                key={tag}
                className="font-mono-display text-[10px] tracking-wider px-2 py-0.5 rounded uppercase"
                style={{
                  color: 'var(--accent-amber)',
                  background: 'var(--glow-amber)',
                  border: '1px solid var(--accent-amber-dim)',
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        <dl className="text-sm space-y-1.5 mb-6" style={{ color: 'var(--text-muted)' }}>
          <div className="flex gap-2">
            <dt>{t('memberSince')}:</dt>
            <dd className="font-mono-display" style={{ color: 'var(--text-secondary)' }}>
              @{preset.user.username}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt>{t('uploadedOn')}:</dt>
            <dd style={{ color: 'var(--text-secondary)' }}>
              {new Date(preset.createdAt).toLocaleDateString()}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt style={{ color: 'var(--text-secondary)' }}>{preset.downloadCount}</dt>
            <dd>{t('downloads')}</dd>
          </div>
        </dl>

        <a
          href={`/api/share/${token}/download`}
          data-testid="share-download-button"
          className="inline-block font-mono-display text-sm font-bold tracking-wider uppercase px-8 py-3 rounded-lg transition-all duration-150 hover:shadow-[0_0_20px_var(--glow-amber)]"
          style={{
            background: 'var(--glow-amber)',
            border: '1px solid var(--accent-amber)',
            color: 'var(--accent-amber)',
            boxShadow: '0 0 12px var(--glow-amber)',
          }}
        >
          {t('download')}
        </a>
      </div>
    </main>
  );
}
