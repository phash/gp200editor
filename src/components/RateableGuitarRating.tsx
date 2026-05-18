'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { GuitarRating } from './GuitarRating';

export interface Props {
  presetId: string;
  average: number;
  count: number;
  canRate: boolean;
  existing: number;
  reason: 'anon' | 'own' | 'unverified' | null;
  size?: 'sm' | 'md';
}

export function RateableGuitarRating({ presetId, average, count, canRate, existing, reason, size = 'sm' }: Props) {
  const t = useTranslations('gallery.rate');
  const [avg, setAvg] = useState(average);
  const [cnt, setCnt] = useState(count);
  const [mine, setMine] = useState(existing);
  const [tip, setTip] = useState<string | null>(null);

  async function handleRate(score: number) {
    if (!canRate) {
      setTip(reason === 'own' ? t('ownPresetTooltip') : t('signInTooltip'));
      setTimeout(() => setTip(null), 2500);
      return;
    }

    // Snapshot for rollback before applying the optimistic update.
    const prevAvg = avg, prevCnt = cnt, prevMine = mine;
    const wasNew = mine === 0;
    const newCount = wasNew ? cnt + 1 : cnt;
    const newAvg = wasNew ? (avg * cnt + score) / newCount : (avg * cnt - mine + score) / cnt;
    setAvg(newAvg); setCnt(newCount); setMine(score);

    try {
      const res = await fetch(`/api/presets/${presetId}/rate`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ score }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch {
      // Roll back optimistic state — the rating did not persist.
      setAvg(prevAvg); setCnt(prevCnt); setMine(prevMine);
      setTip(t('errorTooltip'));
      setTimeout(() => setTip(null), 2500);
    }
  }

  return (
    <div className="relative inline-block">
      <GuitarRating value={canRate && mine > 0 ? mine : avg} count={cnt} onRate={handleRate} size={size} />
      {tip && (
        <span
          role="tooltip"
          className="absolute left-0 top-full mt-1 text-[10px] px-2 py-1 rounded whitespace-nowrap z-10"
          style={{ background: 'var(--surface)', color: 'var(--text-primary)', border: '1px solid var(--accent-amber-dim)' }}
        >
          {tip}
          {reason === 'anon' && (
            <Link href="/auth/login" className="ml-1 underline" style={{ color: 'var(--accent-amber)' }}>
              →
            </Link>
          )}
        </span>
      )}
    </div>
  );
}
