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
import { buildAlternates, BASE_URL, type Locale } from '@/lib/hreflang';
import { serializeJsonLd } from '@/lib/jsonLd';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return {
    // metadataBase makes every relative image/URL in downstream metadata
    // resolve to the production origin. Without it, dynamic opengraph-image
    // routes end up tagged as http://localhost:3000 because that's the
    // Next.js default when rendered inside a prod container that doesn't
    // know its own external host.
    metadataBase: new URL(BASE_URL),
    title: 'Preset Forge — GP-200 Preset Editor | Linux & Windows | HX Stomp Import',
    description: 'Free browser-based editor for Valeton GP-200 guitar presets — the only GP-200 editor that runs on Linux (tested on Linux Mint). Import Line6 HX Stomp .hlx files, live USB MIDI editing, timed preset switching for gigs, 305 effects with per-effect gallery filtering, community sharing. No install needed — works offline as PWA.',
    keywords: [
      'Valeton GP-200', 'GP-200 preset editor', 'GP-200 Linux', 'GP-200 Linux Mint',
      'GP-200 editor Linux', 'Valeton GP-200 Linux', 'GP-200 Ubuntu', 'GP-200 editor alternative',
      'guitar effects', 'multi-effects pedal', 'USB MIDI', 'Web MIDI', '.prst editor',
      'pedalboard', 'tone sharing', 'guitar presets', 'Line6 HX Stomp',
      'HX Stomp preset converter', '.hlx import', 'Helix preset', 'preset converter',
      'guitar tone', 'amp simulator', 'signal chain editor', 'GP-200 firmware 1.8',
      'live setlist', 'cue points', 'preset switching', 'gig automation',
      'guitar preset gallery', 'effect filter', 'pedalboard view', 'PWA offline', 'MIDI auto-reconnect',
    ],
    manifest: '/manifest.json',
    alternates: buildAlternates('/', locale as Locale),
    openGraph: {
      title: 'Preset Forge — GP-200 Preset Editor | Linux & Windows | HX Stomp Import',
      description: 'The only GP-200 editor that runs on Linux (tested on Linux Mint). Import HX Stomp .hlx presets, build timed setlists with cue points for live gigs, browse 305 effects in the gallery. USB MIDI, offline PWA.',
      siteName: 'Preset Forge',
      type: 'website',
      url: `${BASE_URL}/${locale}`,
      images: [{ url: `${BASE_URL}/og-image.png`, width: 1200, height: 630, alt: 'Preset Forge — GP-200 Preset Editor' }],
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Preset Forge — GP-200 Preset Editor',
      description: 'The only GP-200 editor that runs on Linux. Edit presets, sync via USB MIDI, import HX Stomp .hlx files.',
      images: [`${BASE_URL}/og-image.png`],
    },
  };
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'Preset Forge',
  description: 'Free browser-based editor for Valeton GP-200 guitar presets — the only GP-200 editor that runs on Linux (tested on Linux Mint). The official Valeton app is Windows-only. Import Line6 HX Stomp .hlx files, build timed setlists with automatic preset switching, browse 305 effects in the community gallery.',
  url: 'https://preset-forge.com',
  applicationCategory: 'Music',
  operatingSystem: 'Windows, macOS, Linux, Linux Mint, Ubuntu, Chrome OS',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
  browserRequirements: 'Requires Chrome or Edge for USB MIDI features',
  featureList: 'GP-200 preset editing, Linux support (Linux Mint tested), Line6 HX Stomp .hlx import, USB MIDI live editing, timed cue points for live setlists, 3-2-1 count-in, auto-reconnect, preset gallery with per-effect filtering (305 effects), pedalboard view, offline PWA, community sharing',
};

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  if (!(routing.locales as readonly string[]).includes(locale)) notFound();
  const messages = await getMessages();
  const jsonLdString = serializeJsonLd(jsonLd);
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
