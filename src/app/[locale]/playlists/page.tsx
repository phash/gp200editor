import type { Metadata } from 'next';
import { PlaylistPageRouter } from './PlaylistPageRouter';

const BASE_URL = 'https://preset-forge.com';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: 'Live Playlists & Cue Points — GP-200 Setlist Builder | Preset Forge',
    description: 'Build timed setlists for live gigs with the Valeton GP-200. Automatic preset switching with cue points, 3-2-1 count-in, works offline as PWA.',
    alternates: {
      canonical: `${BASE_URL}/${locale}/playlists`,
      languages: { de: `${BASE_URL}/de/playlists`, en: `${BASE_URL}/en/playlists` },
    },
    openGraph: {
      title: 'GP-200 Live Playlists — Timed Preset Switching | Preset Forge',
      description: 'Automate your live set with timed cue points. Build playlists, assign GP-200 presets to songs, let the app switch presets at the right moment.',
      images: [{ url: `${BASE_URL}/og-image.png`, width: 1200, height: 630 }],
    },
  };
}

export default function PlaylistsPage() {
  return <PlaylistPageRouter />;
}
