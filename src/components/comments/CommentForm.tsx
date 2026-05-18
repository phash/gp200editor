'use client';
import { useState } from 'react';
import { flushSync } from 'react-dom';
import { useTranslations } from 'next-intl';

interface Props {
  presetId: string;
  parentId?: string;
  onSubmit: (body: string) => Promise<void>;
  onCancel?: () => void;
  initialValue?: string;
  isEdit?: boolean;
}

export function CommentForm({ onSubmit, onCancel, initialValue = '', isEdit = false }: Props) {
  const t = useTranslations('comments');
  const [body, setBody] = useState(initialValue);
  const [busy, setBusy] = useState(false);
  const trimmed = body.trim();
  const disabled = busy || trimmed.length === 0 || trimmed.length > 1000;

  async function handleSubmit() {
    if (disabled) return;
    setBusy(true);
    await onSubmit(trimmed);
    flushSync(() => {
      if (!isEdit) setBody('');
      setBusy(false);
    });
  }

  return (
    <div className="flex flex-col gap-1 mb-3">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value.slice(0, 1000))}
        placeholder={t('placeholder')}
        rows={3}
        className="w-full p-2 text-sm rounded resize-y"
        style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          color: 'var(--text-primary)',
        }}
      />
      <div className="flex items-center justify-between text-[10px] font-mono-display" style={{ color: 'var(--text-muted)' }}>
        <span>{t('charCount', { count: body.length })}</span>
        <div className="flex gap-2">
          {onCancel && (
            <button onClick={onCancel} type="button" className="px-2 py-1 rounded" style={{ color: 'var(--text-muted)' }}>
              {t('cancel')}
            </button>
          )}
          <button
            onClick={handleSubmit}
            type="button"
            disabled={disabled}
            className="px-3 py-1 rounded uppercase tracking-wider"
            style={{
              background: disabled ? 'transparent' : 'var(--glow-amber)',
              color: disabled ? 'var(--text-muted)' : 'var(--accent-amber)',
              border: '1px solid var(--accent-amber-dim)',
              opacity: disabled ? 0.4 : 1,
            }}
          >
            {isEdit ? t('save') : t('post')}
          </button>
        </div>
      </div>
    </div>
  );
}
