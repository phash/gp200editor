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
  title: 'Preset Forge — GP-200 Preset Editor | Line6 HX Stomp Import',
  description: 'Free browser-based editor for Valeton GP-200 guitar presets. Import Line6 HX Stomp .hlx files, live USB MIDI editing, preset gallery, and community sharing. No install needed.',
  keywords: [
    'Valeton GP-200',
    'GP-200 preset editor',
    'guitar effects',
    'multi-effects pedal',
    'USB MIDI',
    'Web MIDI',
    '.prst editor',
    'pedalboard',
    'tone sharing',
    'guitar presets',
    'Line6 HX Stomp',
    'HX Stomp preset converter',
    '.hlx import',
    'Helix preset',
    'preset converter',
    'guitar tone',
    'amp simulator',
    'signal chain editor',
    'GP-200 firmware 1.8',
  ],
  manifest: '/manifest.json',
  openGraph: {
    title: 'Preset Forge — GP-200 Preset Editor | HX Stomp Import',
    description: 'Free browser-based editor for Valeton GP-200. Import Line6 HX Stomp .hlx presets, edit effects live via USB MIDI, share with the community. Works offline as PWA.',
    siteName: 'Preset Forge',
    type: 'website',
    url: 'https://preset-forge.com',
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'Preset Forge',
  description: 'Free browser-based editor for Valeton GP-200 guitar presets. Import Line6 HX Stomp .hlx files, live USB MIDI editing, preset gallery, and community sharing.',
  url: 'https://preset-forge.com',
  applicationCategory: 'Music',
  operatingSystem: 'Web',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
  browserRequirements: 'Requires Chrome or Edge for USB MIDI features',
  featureList: 'GP-200 preset editing, Line6 HX Stomp .hlx import, USB MIDI live editing, preset gallery, offline PWA, signal chain editor, pedalboard view',
};

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as 'de' | 'en')) notFound();
  const messages = await getMessages();
  const jsonLdString = JSON.stringify(jsonLd);
  return (
    <html lang={locale}>
      <head>
        <meta name="theme-color" content="#d97706" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        {/* JSON-LD structured data — static constant, not user input */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString }} />
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
