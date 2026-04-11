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
import { slugifyAmpName } from '@/core/ampCategories';
import { Link } from '@/i18n/routing';

export const revalidate = 3600;

import { buildAlternates, BASE_URL } from '@/lib/hreflang';

type Props = {
  params: Promise<{ token: string; locale: 'de' | 'en' }>;
};

/** Guess the amp brand from a real name like "Marshall® JCM800".
 *  Used for schema.org/Product "brand" field. Falls back to "Valeton"
 *  (since every preset is ultimately a Valeton GP-200 file). */
function guessBrand(realName: string | null): string {
  if (!realName) return 'Valeton';
  const match = realName.match(/^([A-Za-z][A-Za-z0-9/]*(?:[ /][A-Za-z][A-Za-z0-9]*)*)®?/);
  return match?.[1]?.trim() || 'Valeton';
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token, locale } = await params;
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

  const canonical = `${BASE_URL}/${locale}/share/${token}`;

  return {
    title,
    description,
    alternates: buildAlternates(`/share/${token}`, locale),
    openGraph: {
      title,
      description,
      url: canonical,
      type: 'website',
      siteName: 'Preset Forge',
      locale: locale === 'de' ? 'de_DE' : 'en_US',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}

export default async function SharePage({ params }: Props) {
  const { token, locale } = await params;
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

  // schema.org/Product markup — Google renders this as a rich result with
  // the preset name, brand (the amp manufacturer), and "free" price. Key
  // for long-tail amp-based queries like "Marshall JCM800 GP-200 preset".
  const brand = guessBrand(json?.highlights.amp?.realName ?? null);
  const productJsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: preset.name,
    description: preset.description ?? `Valeton GP-200 preset by @${preset.user.username}`,
    brand: { '@type': 'Brand', name: brand },
    category: 'Guitar effect preset',
    url: `${BASE_URL}/${locale}/share/${token}`,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
      url: `${BASE_URL}/${locale}/share/${token}`,
    },
  };
  if (preset.ratingCount > 0 && preset.ratingAverage > 0) {
    productJsonLd.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: preset.ratingAverage.toFixed(1),
      ratingCount: preset.ratingCount,
      bestRating: '5',
      worstRating: '1',
    };
  }
  // Escape < to \u003c so a malicious preset name can't inject a </script>
  // tag and break out of the JSON-LD block. JSON.stringify doesn't do this
  // by itself, so we do it in one step after serialization.
  const productJsonLdString = JSON.stringify(productJsonLd).replace(/</g, '\\u003c');

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: productJsonLdString }}
      />
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

        {/* Internal link to the amp category landing page — gives Google a
            clear content cluster signal ("presets grouped by amp") and lets
            users discover more presets for the same amp in one click. */}
        {json?.highlights.amp?.realName && (
          <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
            →{' '}
            <Link
              href={`/amp/${slugifyAmpName(json.highlights.amp.realName)}`}
              className="hover:underline"
              style={{ color: 'var(--accent-amber)' }}
            >
              More {json.highlights.amp.realName} presets
            </Link>
          </p>
        )}

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
