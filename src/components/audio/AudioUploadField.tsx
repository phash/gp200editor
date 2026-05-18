'use client';
import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

interface UploadResult {
  audioKey: string;
  audioUrl: string;
  audioMimeType: string;
  audioDurationMs: number;
}

interface Props {
  presetId: string;
  hasAudio: boolean;
  onChange: (result: UploadResult | null) => void;
}

const ERROR_KEYS = new Set(['tooLong', 'tooBig', 'wrongType', 'notAuthorized']);

export function AudioUploadField({ presetId, hasAudio, onChange }: Props) {
  const t = useTranslations('audio.upload');
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [present, setPresent] = useState(hasAudio);

  async function handlePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setBusy(true);

    const fd = new FormData();
    fd.append('audio', file);

    try {
      const res = await fetch(`/api/presets/${presetId}/audio`, { method: 'POST', body: fd });
      if (res.ok) {
        const data = (await res.json()) as UploadResult;
        setPresent(true);
        onChange(data);
      } else if (res.status === 401 || res.status === 403) {
        setError(t('notAuthorized'));
      } else if (res.status === 400) {
        const data = await res.json().catch(() => null);
        const code = data?.error;
        setError(ERROR_KEYS.has(code) ? t(code as 'tooLong' | 'tooBig' | 'wrongType' | 'notAuthorized') : t('genericError'));
      } else {
        setError(t('genericError'));
      }
    } catch {
      setError(t('genericError'));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function handleRemove() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/presets/${presetId}/audio`, { method: 'DELETE' });
      if (res.ok) {
        setPresent(false);
        onChange(null);
      } else {
        setError(t('genericError'));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-mono-display uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
        {t('label')}
      </label>
      <div className="flex items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="audio/mpeg,audio/mp4,audio/x-m4a,.mp3,.m4a"
          onChange={handlePick}
          disabled={busy}
          className="text-xs"
          aria-label={t('label')}
        />
        {present && (
          <>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="text-[10px] uppercase tracking-wider px-2 py-1 rounded"
              style={{ color: 'var(--accent-amber)', border: '1px solid var(--accent-amber-dim)' }}
            >
              {t('replace')}
            </button>
            <button
              type="button"
              onClick={handleRemove}
              disabled={busy}
              className="text-[10px] uppercase tracking-wider px-2 py-1 rounded"
              style={{ color: '#ef4444', border: '1px solid #ef4444' }}
            >
              {t('remove')}
            </button>
          </>
        )}
      </div>
      {!error && (
        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
          {busy ? t('uploading') : t('placeholder')}
        </span>
      )}
      {error && (
        <span className="text-[10px]" style={{ color: '#ef4444' }}>{error}</span>
      )}
    </div>
  );
}
