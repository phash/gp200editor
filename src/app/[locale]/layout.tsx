import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Script from 'next/script';
import '../globals.css'; // globals.css stays in src/app/, so relative path goes up
import { Footer } from '@/components/Footer';
import { Navbar } from '@/components/Navbar';
import { ClientProviders } from './ClientProviders';

export const metadata: Metadata = {
  title: 'Preset Forge — GP-200 Editor',
  description: 'Edit, share, and sync Valeton GP-200 presets. Real-time USB MIDI editing, preset gallery, and community sharing.',
  keywords: [
    'Valeton GP-200',
    'preset editor',
    'guitar effects',
    'multi-effects pedal',
    'USB MIDI',
    'Web MIDI',
    '.prst editor',
    'pedalboard',
    'tone sharing',
    'guitar presets',
  ],
  openGraph: {
    title: 'Preset Forge — GP-200 Editor',
    description: 'Edit, share, and sync Valeton GP-200 presets. Real-time USB MIDI editing, preset gallery, and community sharing.',
    siteName: 'Preset Forge',
    type: 'website',
    url: 'https://preset-forge.com',
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'Preset Forge',
  description: 'Edit, share, and sync Valeton GP-200 presets. Real-time USB MIDI editing, preset gallery, and community sharing.',
  url: 'https://preset-forge.com',
  applicationCategory: 'Music',
  operatingSystem: 'Web',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
  browserRequirements: 'Requires Chrome or Edge for USB MIDI features',
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
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="flex flex-col min-h-screen">
        <NextIntlClientProvider messages={messages}>
          <ClientProviders>
            <Navbar />
            <main className="flex-1">{children}</main>
            <Footer />
          </ClientProviders>
        </NextIntlClientProvider>
        {/* Matomo Analytics — Site ID 2 on musikersuche.org/matomo */}
        <Script id="matomo" strategy="afterInteractive">{`
          var _paq=window._paq=window._paq||[];
          _paq.push(["trackPageView"]);
          _paq.push(["enableLinkTracking"]);
          (function(){var u="//musikersuche.org/matomo/";
          _paq.push(["setTrackerUrl",u+"matomo.php"]);
          _paq.push(["setSiteId","2"]);
          var d=document,g=d.createElement("script"),s=d.getElementsByTagName("script")[0];
          g.async=true;g.src=u+"matomo.js";s.parentNode.insertBefore(g,s)})();
        `}</Script>
      </body>
    </html>
  );
}
