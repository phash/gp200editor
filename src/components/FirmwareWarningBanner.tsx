'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

interface FirmwareWarningBannerProps {
  firmwareVersion: string;
  onDismiss: () => void;
}

export function FirmwareWarningBanner({ firmwareVersion, onDismiss }: FirmwareWarningBannerProps) {
  const t = useTranslations('device');
  const [acknowledged, setAcknowledged] = useState(false);

  return (
    <div
      className="rounded-lg p-4 mb-4"
      style={{
        background: 'rgba(196, 78, 78, 0.08)',
        border: '1px solid rgba(196, 78, 78, 0.3)',
      }}
      role="alert"
    >
      <p className="text-sm mb-3" style={{ color: 'var(--accent-red)' }}>
        {t('firmwareBannerText', { version: firmwareVersion })}
      </p>
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--text-secondary)' }}>
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
            className="accent-[var(--accent-amber)]"
          />
          {t('firmwareBannerAck')}
        </label>
        <button
          onClick={onDismiss}
          disabled={!acknowledged}
          className="font-mono-display text-xs font-bold uppercase px-4 py-1.5 rounded transition-all disabled:opacity-40"
          style={{
            border: '1px solid rgba(212,162,78,0.4)',
            color: 'var(--accent-amber)',
            background: acknowledged ? 'rgba(212,162,78,0.1)' : 'transparent',
          }}
        >
          {t('firmwareBannerContinue')}
        </button>
      </div>
    </div>
  );
}
