'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

interface WarnDialogProps {
  open: boolean;
  username: string;
  onSend: (reason: string, message?: string) => void;
  onCancel: () => void;
  loading?: boolean;
}

export function WarnDialog({ open, username, onSend, onCancel, loading }: WarnDialogProps) {
  const t = useTranslations('admin.warn');
  const [reason, setReason] = useState('inappropriate');
  const [message, setMessage] = useState('');

  if (!open) return null;

  const reasons = ['inappropriate', 'spam', 'copyright', 'other'] as const;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onCancel}>
      <div
        className="rounded-xl p-6 max-w-md w-full mx-4"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
          {t('title', { username })}
        </h3>
        <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>{t('subtitle')}</p>

        <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>{t('reason')}</label>
        <select
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-full px-3 py-2 rounded-lg text-sm mb-3"
          style={{ background: 'var(--bg-input, #2a2a2a)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
        >
          {reasons.map((r) => (
            <option key={r} value={r}>{t(`reasons.${r}`)}</option>
          ))}
        </select>

        <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>{t('message')}</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="w-full px-3 py-2 rounded-lg text-sm mb-4 resize-y"
          style={{ background: 'var(--bg-input, #2a2a2a)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', minHeight: '80px' }}
        />

        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-sm"
            style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
            disabled={loading}
          >
            {t('cancel')}
          </button>
          <button
            onClick={() => onSend(t(`reasons.${reason as typeof reasons[number]}`), message || undefined)}
            className="px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ background: 'var(--accent-amber)', color: '#000' }}
            disabled={loading}
          >
            {loading ? '...' : t('send')}
          </button>
        </div>
      </div>
    </div>
  );
}
