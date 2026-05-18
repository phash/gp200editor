'use client';
import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAudioPlayerManager } from './AudioPlayerProvider';

interface Props {
  src: string;
  mime: string;
  durationMs: number;
  variant: 'full' | 'icon';
}

function fmt(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function AudioPlayer({ src, mime, durationMs, variant }: Props) {
  const t = useTranslations('audio.player');
  const tGallery = useTranslations('gallery.audio');
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const mgr = useAudioPlayerManager();
  const total = durationMs / 1000;

  function toggle() {
    const el = ref.current;
    if (!el) return;
    if (el.paused) {
      mgr.notifyPlay(el);
      el.play().catch(() => {});
    } else {
      el.pause();
    }
  }

  function onTimeUpdate() {
    if (ref.current) setCurrent(ref.current.currentTime);
  }

  function onPlay() { setPlaying(true); }
  function onPause() { setPlaying(false); }
  function onEnded() {
    setPlaying(false);
    setCurrent(0);
    if (ref.current) mgr.notifyEnded(ref.current);
  }

  if (variant === 'icon') {
    return (
      <>
        <button
          type="button"
          onClick={toggle}
          aria-label={tGallery('iconLabel')}
          aria-pressed={playing}
          className="inline-flex items-center justify-center w-6 h-6 rounded"
          style={{ color: 'var(--accent-amber)', border: '1px solid var(--accent-amber-dim)' }}
        >
          <span aria-hidden="true">{playing ? '❚❚' : '▶'}</span>
        </button>
        <audio
          ref={ref}
          src={src}
          preload="none"
          onTimeUpdate={onTimeUpdate}
          onPlay={onPlay}
          onPause={onPause}
          onEnded={onEnded}
          aria-hidden="true"
        >
          <source src={src} type={mime} />
        </audio>
      </>
    );
  }

  return (
    <div
      role="application"
      aria-label={t('duration', { seconds: Math.round(total) })}
      className="flex items-center gap-3 p-2 rounded"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? t('pauseLabel') : t('playLabel')}
        aria-pressed={playing}
        className="inline-flex items-center justify-center w-8 h-8 rounded"
        style={{ color: 'var(--accent-amber)', border: '1px solid var(--accent-amber-dim)' }}
      >
        <span aria-hidden="true">{playing ? '❚❚' : '▶'}</span>
      </button>
      <div className="flex-1 flex flex-col gap-1">
        <div
          className="h-1 rounded overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.08)' }}
          role="progressbar"
          aria-label={t('progressLabel', { current: fmt(current), total: fmt(total) })}
          aria-valuemin={0}
          aria-valuemax={Math.round(total)}
          aria-valuenow={Math.round(current)}
        >
          <div
            className="h-full"
            style={{
              width: total > 0 ? `${(current / total) * 100}%` : '0%',
              background: 'var(--accent-amber)',
            }}
          />
        </div>
        <span className="text-[10px] font-mono-display" style={{ color: 'var(--text-muted)' }}>
          {fmt(current)} / {fmt(total)}
        </span>
      </div>
      <audio
        ref={ref}
        src={src}
        preload="none"
        onTimeUpdate={onTimeUpdate}
        onPlay={onPlay}
        onPause={onPause}
        onEnded={onEnded}
        aria-hidden="true"
      >
        <source src={src} type={mime} />
      </audio>
    </div>
  );
}
