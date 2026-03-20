'use client';

import { useMemo, useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { extractYouTubeId } from '@/lib/youtube';

interface YouTubeEmbedProps {
  url?: string;
  songName: string;
}

export function YouTubeEmbed({ url, songName }: YouTubeEmbedProps) {
  const t = useTranslations('playlists');
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const videoId = useMemo(() => url ? extractYouTubeId(url) : null, [url]);

  if (!videoId || !isOnline) {
    return (
      <div
        className="flex aspect-video w-full items-center justify-center rounded-lg"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
      >
        <p style={{ color: 'var(--text-secondary)' }}>
          {!videoId ? songName : t('offlineVideo')}
        </p>
      </div>
    );
  }

  return (
    <iframe
      className="aspect-video w-full rounded-lg"
      src={`https://www.youtube.com/embed/${videoId}`}
      title={`YouTube: ${songName}`}
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowFullScreen
    />
  );
}
