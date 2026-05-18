import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { prisma } from '@/lib/prisma';
import { pickFeaturedPreset } from '@/lib/featuredPreset';
import { GuitarRating } from './GuitarRating';
import { SignalChainStrip } from './SignalChainStrip';
import { AutoLink } from '@/lib/autoLink';
import type { Locale } from '@/i18n/locales';

interface Props { locale: Locale }

export async function FeaturedPresetBlock({ locale }: Props) {
  const featured = await pickFeaturedPreset();
  if (!featured) return null;

  const t = await getTranslations({ locale, namespace: 'home.featured' });

  const recentComments = await prisma.comment.findMany({
    where: { presetId: featured.id, parentId: null, deletedAt: null },
    orderBy: { createdAt: 'desc' },
    take: 3,
    include: { user: { select: { username: true } } },
  });

  const description = featured.description
    ? featured.description.length > 160
      ? featured.description.slice(0, 157) + '…'
      : featured.description
    : null;

  return (
    <section
      className="rounded-lg p-5 mb-10"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--accent-amber-dim)',
        boxShadow: '0 0 24px var(--glow-amber)',
      }}
    >
      <p
        className="font-mono-display text-[11px] uppercase tracking-widest mb-3"
        style={{ color: 'var(--accent-amber)' }}
      >
        ★ {t('title')}
      </p>

      <SignalChainStrip effects={featured.effects} />

      <h2 className="font-mono-display text-2xl mt-4 mb-1" style={{ color: 'var(--text-primary)' }}>
        {featured.name}
      </h2>
      <div className="mb-2 flex items-center gap-2">
        <GuitarRating value={featured.ratingAverage} count={featured.ratingCount} size="md" />
        <span className="font-mono-display text-xs" style={{ color: 'var(--text-muted)' }}>
          {featured.ratingAverage.toFixed(1)}
        </span>
      </div>
      {description && (
        <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>{description}</p>
      )}

      {recentComments.length > 0 && (
        <div className="mt-4 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="font-mono-display text-[10px] uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
            {t('recentComments')} ({recentComments.length})
          </p>
          <ul className="space-y-1.5 text-sm">
            {recentComments.map((c) => (
              <li key={c.id} style={{ color: 'var(--text-secondary)' }}>
                <span className="font-mono-display text-xs mr-2" style={{ color: 'var(--accent-amber)' }}>
                  @{c.user.username}
                </span>
                <AutoLink text={c.body ?? ''} />
              </li>
            ))}
          </ul>
        </div>
      )}

      <Link
        href={`/share/${featured.shareToken}`}
        className="inline-block mt-4 font-mono-display text-xs uppercase tracking-wider"
        style={{ color: 'var(--accent-amber)' }}
      >
        {t('openPreset')}
      </Link>
    </section>
  );
}
