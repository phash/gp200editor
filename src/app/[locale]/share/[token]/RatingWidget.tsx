'use client';
import { useState } from 'react';
import { GuitarRating } from '@/components/GuitarRating';
import { useTranslations } from 'next-intl';

type Props = {
  presetId: string;
  initialAverage: number;
  initialCount: number;
  canRate: boolean;       // logged in + not own preset
  existingRating: number; // 0 = not yet rated
};

export function RatingWidget({ presetId, initialAverage, initialCount, canRate, existingRating }: Props) {
  const t = useTranslations('presets');
  const [avg, setAvg] = useState(initialAverage);
  const [count, setCount] = useState(initialCount);
  const [myRating, setMyRating] = useState(existingRating);
  const [status, setStatus] = useState<'idle' | 'saving' | 'error'>('idle');

  async function handleRate(score: number) {
    setStatus('saving');
    const res = await fetch(`/api/presets/${presetId}/rate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ score }),
    });
    if (res.ok) {
      // Optimistic update
      const isNew = myRating === 0;
      const newCount = isNew ? count + 1 : count;
      const newAvg = isNew
        ? (avg * count + score) / newCount
        : (avg * count - myRating + score) / count;
      setAvg(newAvg);
      setCount(newCount);
      setMyRating(score);
      setStatus('idle');
    } else {
      setStatus('error');
    }
  }

  return (
    <div className="flex items-center gap-3 my-3">
      <GuitarRating
        value={canRate ? myRating : avg}
        count={count}
        onRate={canRate ? handleRate : undefined}
        size="md"
      />
      {canRate && myRating === 0 && (
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('rateThis')}</span>
      )}
      {canRate && myRating > 0 && (
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('yourRating')}: {myRating}/5</span>
      )}
      {status === 'error' && (
        <span className="text-xs" style={{ color: '#ef4444' }}>{t('ratingError')}</span>
      )}
    </div>
  );
}
