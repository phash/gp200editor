'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { TESTED_FIRMWARE_VERSIONS } from '@/core/firmware';

interface FirmwareCompatDialogProps {
  detectedVersion: string;
  onContinue: () => void;
  onDisconnect: () => void;
}

export function FirmwareCompatDialog({ detectedVersion, onContinue, onDisconnect }: FirmwareCompatDialogProps) {
  const t = useTranslations('device');
  const [acknowledged, setAcknowledged] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onDisconnect(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onDisconnect]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={(e) => e.target === e.currentTarget && onDisconnect()}
    >
      <div
        className="w-full max-w-md rounded-lg p-6"
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid rgba(196, 78, 78, 0.4)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.6)',
        }}
        role="alertdialog"
        aria-labelledby="fw-compat-title"
        aria-describedby="fw-compat-desc"
      >
        <h2
          id="fw-compat-title"
          className="mb-4 font-mono-display text-lg font-bold"
          style={{ color: 'var(--accent-red, #c44e4e)' }}
        >
          ⚠ {t('firmwareCompatTitle')}
        </h2>

        <p
          id="fw-compat-desc"
          className="mb-3 font-mono-display text-sm"
          style={{ color: 'var(--text-primary)' }}
        >
          {t('firmwareCompatInfo', {
            versions: TESTED_FIRMWARE_VERSIONS.join(', '),
            detected: detectedVersion,
          })}
        </p>

        <p
          className="mb-6 font-mono-display text-sm"
          style={{ color: 'var(--accent-red, #c44e4e)' }}
        >
          {t('firmwareCompatRisk')}
        </p>

        <label
          className="mb-6 flex cursor-pointer items-center gap-2 font-mono-display text-sm"
          style={{ color: 'var(--text-secondary)' }}
        >
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
            className="accent-[var(--accent-amber)]"
          />
          {t('firmwareCompatAck')}
        </label>

        <div className="flex justify-end gap-3">
          <button
            onClick={onDisconnect}
            className="rounded-lg px-4 py-2 font-mono-display text-sm transition-all"
            style={{
              color: 'var(--accent-red, #c44e4e)',
              border: '1px solid rgba(196, 78, 78, 0.4)',
            }}
          >
            {t('firmwareCompatDisconnect')}
          </button>
          <button
            onClick={onContinue}
            disabled={!acknowledged}
            className="rounded-lg px-4 py-2 font-mono-display text-sm font-bold transition-all disabled:opacity-40"
            style={{
              background: acknowledged ? 'var(--accent-amber)' : 'transparent',
              color: acknowledged ? 'var(--bg-deep)' : 'var(--accent-amber)',
              border: '1px solid var(--accent-amber)',
            }}
          >
            {t('firmwareCompatContinue')}
          </button>
        </div>
      </div>
    </div>
  );
}
