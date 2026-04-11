import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import { validateSession } from '@/lib/session';
import { RatingWidget } from './RatingWidget';
import { downloadPresetBuffer } from '@/lib/storage';
import { PRSTDecoder } from '@/core/PRSTDecoder';
import { encodeToJson } from '@/core/PRSTJsonCodec';
import { SignalChainSection } from './SignalChainSection';

export const revalidate = 3600;

type Props = {
  params: Promise<{ token: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const preset = await prisma.preset.findUnique({
    where: { shareToken: token },
    select: {
      name: true,
      description: true,
      presetKey: true,
      public: true,
      user: { select: { username: true } },
    },
  });
  if (!preset || !preset.public) return {};

  let amp: string | null = null;
  let cab: string | null = null;
  let drive: string | null = null;
  try {
    const buffer = await downloadPresetBuffer(preset.presetKey);
    const decoded = new PRSTDecoder(buffer).decode();
    const json = encodeToJson(decoded, {
      shareToken: token,
      locale: 'en',
      sourceUrl: null,
      sourceLabel: null,
      description: null,
    });
    amp = json.highlights.amp?.realName ?? json.highlights.amp?.valetonName ?? null;
    cab = json.highlights.cab?.realName ?? json.highlights.cab?.valetonName ?? null;
    drive = json.highlights.drive?.realName ?? json.highlights.drive?.valetonName ?? null;
  } catch {
    // On S3 / decode error, fall back to plain metadata.
  }

  const title = `${preset.name}${amp ? ` — ${amp} preset` : ''} by @${preset.user.username} | Preset Forge`;
  const description =
    [
      preset.description,
      amp,
      cab && `through ${cab}`,
      drive && `with ${drive}`,
    ]
      .filter(Boolean)
      .join(' · ') + ' — Free Valeton GP-200 preset, open in browser editor.';

  return { title, description, openGraph: { title, description } };
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
      presetKey: true,
      sourceUrl: true,
      sourceLabel: true,
      downloadCount: true,
      ratingAverage: true,
      ratingCount: true,
      createdAt: true,
      user: { select: { username: true } },
    },
  });

  if (!preset) notFound();

  // Load + decode the .prst binary so we can render the SEO-friendly signal chain.
  // Cache budget is the page-level revalidate below — this S3 GET happens at
  // most once per hour per preset.
  let json: Awaited<ReturnType<typeof encodeToJson>> | null = null;
  try {
    const buffer = await downloadPresetBuffer(preset.presetKey);
    const decoded = new PRSTDecoder(buffer).decode();
    json = encodeToJson(decoded, {
      shareToken: token,
      locale: 'en',
      sourceUrl: preset.sourceUrl,
      sourceLabel: preset.sourceLabel,
      description: preset.description,
    });
  } catch {
    // S3 or decode error: render the share page without the signal chain.
  }

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

        {json && <SignalChainSection json={json} />}

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
          className="inline-block font-mono-display text-sm font-bold tracking-wider uppercase px-8 py-3 rounded-lg transition-all duration-150 bg-[var(--glow-amber)] text-[var(--accent-amber)] border border-[var(--accent-amber)] [box-shadow:0_0_12px_var(--glow-amber)] hover:!bg-[var(--accent-amber)] hover:!text-[var(--bg-primary)] hover:[box-shadow:0_0_20px_var(--glow-amber)]"
        >
          {t('download')}
        </a>

        {preset.sourceLabel && (
          <p className="text-xs mt-6" style={{ color: 'var(--text-muted)' }}>
            Source:{' '}
            {preset.sourceUrl ? (
              <a href={preset.sourceUrl} rel="nofollow noopener" target="_blank">
                {preset.sourceLabel}
              </a>
            ) : (
              preset.sourceLabel
            )}
          </p>
        )}
      </div>
    </main>
  );
}
