import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { validateSession } from '@/lib/session';
import { buildAlternates, type Locale } from '@/lib/hreflang';
import { FeedbackForm, type FeedbackAccess } from '@/components/FeedbackForm';

type Props = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'feedback' });
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
    // A form behind a login wall has nothing to rank for; keep it out of the
    // index but let link signal flow.
    robots: { index: false, follow: true },
    alternates: buildAlternates('/feedback', locale),
  };
}

export default async function FeedbackPage() {
  const t = await getTranslations('feedback');
  const { user } = await validateSession();
  const access: FeedbackAccess = !user ? 'anonymous' : user.emailVerified ? 'verified' : 'unverified';

  return (
    <main className="max-w-2xl mx-auto px-4 py-10 w-full">
      <h1
        className="font-mono-display text-3xl font-bold tracking-tight mb-3"
        style={{ color: 'var(--accent-amber)' }}
      >
        {t('title')}
      </h1>
      <p className="text-sm md:text-base mb-8" style={{ color: 'var(--text-secondary)' }}>
        {t('intro')}
      </p>
      <FeedbackForm access={access} email={access === 'unverified' ? user?.email ?? null : null} />
    </main>
  );
}
