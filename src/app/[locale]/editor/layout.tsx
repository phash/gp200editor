import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { buildAlternates, BASE_URL, type Locale } from '@/lib/hreflang';
import { EditorAbout } from '@/components/EditorAbout';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'editorAbout' });
  const title = t('metaTitle');
  const description = t('metaDescription');
  return {
    title,
    description,
    alternates: buildAlternates('/editor', locale as Locale),
    openGraph: {
      title,
      description,
      images: [{ url: `${BASE_URL}/og-image.png`, width: 1200, height: 630 }],
    },
  };
}

export default async function EditorLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return (
    <>
      {children}
      <EditorAbout locale={locale as Locale} />
    </>
  );
}
