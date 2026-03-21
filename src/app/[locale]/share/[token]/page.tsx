import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import { validateSession } from '@/lib/session';
import { RatingWidget } from './RatingWidget';

type Props = {
  params: Promise<{ token: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const preset = await prisma.preset.findUnique({
    where: { shareToken: token },
    select: { name: true, description: true, user: { select: { username: true } } },
  });
  if (!preset) return {};
  const title = `${preset.name} — GP-200 Preset by @${preset.user.username} | Preset Forge`;
  const description = preset.description
    ? `${preset.description} — Download this free Valeton GP-200 preset and edit it in the browser.`
    : `Free Valeton GP-200 preset "${preset.name}" by @${preset.user.username}. Open in the browser editor — works on Linux, Windows, macOS.`;
  return {
    title,
    description,
    openGraph: { title, description },
  };
}

export default async function SharePage({ params }: Props) {
  const { token } = await params;
  const t = await getTranslations('presets');

  const preset = await prisma.preset.findUnique({
    where: { shareToken: token },
    select: {
      id: true,
      userId: true,
      name: true,
      description: true,
      tags: true,
      downloadCount: true,
      ratingAverage: true,
      ratingCount: true,
      createdAt: true,
      user: { select: { username: true } },
    },
  });

  if (!preset) notFound();

  // Check session and existing rating for interactive widget
  let existingRating = 0;
  let canRate = false;
  let sessionUserId: string | null = null;

  const { user } = await validateSession();
  if (user) {
    sessionUserId = user.id;
    // Can rate if logged in and not the preset owner
    if (preset.userId !== sessionUserId) {
      canRate = true;
      // Look up existing rating
      const existing = await prisma.presetRating.findUnique({
        where: { presetId_userId: { presetId: preset.id, userId: sessionUserId } },
        select: { score: true },
      });
      if (existing) {
        existingRating = existing.score;
      }
    }
  }

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

        <RatingWidget
          presetId={preset.id}
          initialAverage={preset.ratingAverage}
          initialCount={preset.ratingCount}
          canRate={canRate}
          existingRating={existingRating}
        />

        <a
          href={`/api/share/${token}/download`}
          data-testid="share-download-button"
          className="inline-block font-mono-display text-sm font-bold tracking-wider uppercase px-8 py-3 rounded-lg transition-all duration-150"
          style={{
            background: 'var(--glow-amber)',
            border: '1px solid var(--accent-amber)',
            color: 'var(--accent-amber)',
            boxShadow: '0 0 12px var(--glow-amber)',
          }}
          onMouseEnter={(e: React.MouseEvent<HTMLAnchorElement>) => {
            e.currentTarget.style.background = 'var(--accent-amber)';
            e.currentTarget.style.color = 'var(--bg-primary)';
            e.currentTarget.style.boxShadow = '0 0 20px var(--glow-amber)';
          }}
          onMouseLeave={(e: React.MouseEvent<HTMLAnchorElement>) => {
            e.currentTarget.style.background = 'var(--glow-amber)';
            e.currentTarget.style.color = 'var(--accent-amber)';
            e.currentTarget.style.boxShadow = '0 0 12px var(--glow-amber)';
          }}
        >
          {t('download')}
        </a>
      </div>
    </main>
  );
}
