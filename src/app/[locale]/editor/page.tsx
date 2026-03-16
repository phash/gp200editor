import { getTranslations } from 'next-intl/server';

export default async function EditorPage() {
  const t = await getTranslations('editor');
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      <p className="text-gray-500 mt-2">{t('placeholder')}</p>
    </div>
  );
}
