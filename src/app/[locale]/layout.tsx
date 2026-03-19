import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import '../globals.css'; // globals.css stays in src/app/, so relative path goes up
import { Footer } from '@/components/Footer';
import { Navbar } from '@/components/Navbar';

export const metadata: Metadata = {
  title: 'Preset Forge — GP-200 Editor',
  description: 'Edit, share, and sync Valeton GP-200 presets. Real-time USB MIDI editing, preset gallery, and community sharing.',
  openGraph: {
    title: 'Preset Forge — GP-200 Editor',
    description: 'Edit, share, and sync Valeton GP-200 presets. Real-time USB MIDI editing, preset gallery, and community sharing.',
    siteName: 'Preset Forge',
    type: 'website',
    url: 'https://preset-forge.com',
  },
};

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as 'de' | 'en')) notFound();
  const messages = await getMessages();
  return (
    <html lang={locale}>
      <body className="flex flex-col min-h-screen">
        <NextIntlClientProvider messages={messages}>
          <Navbar />
          <main className="flex-1">{children}</main>
          <Footer />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
