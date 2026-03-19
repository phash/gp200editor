import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/routing';

export default async function HomePage() {
  const t = await getTranslations('home');
  return (
    <div className="flex flex-col items-center justify-center flex-1 px-4 py-20 text-center">
      <h1
        className="font-mono-display text-3xl sm:text-4xl font-bold tracking-tight mb-4"
        style={{ color: 'var(--text-primary)' }}
      >
        {t('headline')}
      </h1>
      <p
        className="text-lg mb-8 max-w-md"
        style={{ color: 'var(--text-secondary)' }}
      >
        {t('subtitle')}
      </p>
      <Link
        href="/editor"
        data-testid="home-upload-cta"
        className="font-mono-display text-sm font-bold tracking-wider uppercase px-8 py-3 rounded-lg transition-all duration-150 hover:!bg-[var(--accent-amber)] hover:!text-[var(--bg-primary)] hover:shadow-[0_0_20px_var(--glow-amber)]"
        style={{
          background: 'var(--glow-amber)',
          border: '1px solid var(--accent-amber)',
          color: 'var(--accent-amber)',
          boxShadow: '0 0 12px var(--glow-amber)',
        }}
      >
        {t('uploadCta')}
      </Link>
    </div>
  );
}
