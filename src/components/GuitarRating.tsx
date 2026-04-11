'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';

type Props = {
  value: number;          // 0–5, supports decimals for display (avg)
  count?: number;         // show rating count if provided
  onRate?: (score: number) => void;  // if provided: interactive mode
  size?: 'sm' | 'md';
};

export function GuitarRating({ value, count, onRate, size = 'md' }: Props) {
  const t = useTranslations('gallery');
  const [hover, setHover] = useState(0);
  const fontSize = size === 'sm' ? '0.7rem' : '1.1rem';
  const display = hover || Math.round(value);

  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= display;
        const opacity = filled ? 1 : 0.25;

        if (onRate) {
          return (
            <button
              key={n}
              onClick={() => onRate(n)}
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(0)}
              style={{ fontSize, opacity, lineHeight: 1, background: 'none', border: 'none', cursor: 'pointer', padding: '0 1px' }}
              aria-label={filled ? t('ratingStarFilled') : t('ratingStarEmpty')}
            >
              <span role="img" aria-hidden="true">🎸</span>
            </button>
          );
        }

        return (
          <span
            key={n}
            style={{ fontSize, opacity, lineHeight: 1, padding: '0 1px' }}
            aria-label={filled ? t('ratingStarFilled') : t('ratingStarEmpty')}
            role="img"
          >
            🎸
          </span>
        );
      })}
      {count !== undefined && count > 0 && (
        <span className="font-mono text-[10px] ml-1 text-gray-400">
          ({count})
        </span>
      )}
    </span>
  );
}
