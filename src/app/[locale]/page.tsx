import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/routing';

export default async function HomePage() {
  const t = await getTranslations('home');
  return (
    <div className="flex flex-col items-center justify-center flex-1 px-4 py-20 text-center">
      <h1 className="text-4xl font-bold mb-4">{t('headline')}</h1>
      <p className="text-lg text-gray-600 mb-8 max-w-md">{t('subtitle')}</p>
      <Link
        href="/editor"
        className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        data-testid="home-upload-cta"
      >
        {t('uploadCta')}
      </Link>
    </div>
  );
}
