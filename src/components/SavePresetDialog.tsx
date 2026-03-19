'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

const PRESET_STYLES = [
  'Rock', 'Metal', 'Blues', 'Jazz', 'Country', 'Funk',
  'Pop', 'Punk', 'Ambient', 'Clean', 'Acoustic', 'Experimental',
];

interface SavePresetDialogProps {
  presetName: string;
  defaultAuthor: string;
  onSave: (data: { author: string; style: string; note: string; publish: boolean }) => void;
  onCancel: () => void;
  saving: boolean;
}

export function SavePresetDialog({ presetName, defaultAuthor, onSave, onCancel, saving }: SavePresetDialogProps) {
  const t = useTranslations('editor');
  const [author, setAuthor] = useState(defaultAuthor);
  const [style, setStyle] = useState('');
  const [customStyle, setCustomStyle] = useState('');
  const [note, setNote] = useState('');
  const [publish, setPublish] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const finalStyle = style === '__custom__' ? customStyle.trim() : style;
    onSave({ author: author.trim(), style: finalStyle, note: note.trim(), publish });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        className="w-full max-w-md rounded-lg p-6"
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.6)',
        }}
      >
        <h2
          className="font-mono-display text-lg font-bold tracking-tight mb-1"
          style={{ color: 'var(--accent-amber)' }}
        >
          {t('saveToPresets')}
        </h2>
        <p className="text-sm mb-5" style={{ color: 'var(--text-muted)' }}>
          {presetName}
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Author */}
          <div>
            <label
              className="block font-mono-display text-[11px] font-medium tracking-wider uppercase mb-1.5"
              htmlFor="save-author"
              style={{ color: 'var(--text-secondary)' }}
            >
              Author
            </label>
            <input
              id="save-author"
              type="text"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              maxLength={50}
              className="w-full rounded px-3 py-2 text-sm focus:outline-none"
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-active)',
                color: 'var(--text-primary)',
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent-amber)'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border-active)'; }}
            />
          </div>

          {/* Style */}
          <div>
            <label
              className="block font-mono-display text-[11px] font-medium tracking-wider uppercase mb-1.5"
              htmlFor="save-style"
              style={{ color: 'var(--text-secondary)' }}
            >
              Style
            </label>
            <select
              id="save-style"
              value={style}
              onChange={(e) => setStyle(e.target.value)}
              className="w-full rounded px-3 py-2 text-sm focus:outline-none"
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-active)',
                color: 'var(--text-primary)',
              }}
            >
              <option value="">—</option>
              {PRESET_STYLES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
              <option value="__custom__">{t('customStyle')}</option>
            </select>
            {style === '__custom__' && (
              <input
                type="text"
                value={customStyle}
                onChange={(e) => setCustomStyle(e.target.value)}
                maxLength={50}
                placeholder={t('customStylePlaceholder')}
                className="w-full rounded px-3 py-2 text-sm focus:outline-none mt-2"
                style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-active)',
                  color: 'var(--text-primary)',
                }}
                autoFocus
              />
            )}
          </div>

          {/* Note */}
          <div>
            <label
              className="block font-mono-display text-[11px] font-medium tracking-wider uppercase mb-1.5"
              htmlFor="save-note"
              style={{ color: 'var(--text-secondary)' }}
            >
              Note
            </label>
            <textarea
              id="save-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              rows={3}
              className="w-full rounded px-3 py-2 text-sm focus:outline-none resize-none"
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-active)',
                color: 'var(--text-primary)',
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent-amber)'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border-active)'; }}
            />
          </div>

          {/* Publish checkbox */}
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={publish}
              onChange={(e) => setPublish(e.target.checked)}
              className="w-4 h-4 rounded"
              style={{ accentColor: 'var(--accent-amber)' }}
            />
            <span className="font-mono-display text-sm" style={{ color: 'var(--text-secondary)' }}>
              {t('publishToGallery')}
            </span>
          </label>

          {/* Buttons */}
          <div className="flex gap-3 mt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 font-mono-display text-sm font-bold tracking-wider uppercase rounded py-2.5 transition-all duration-150 disabled:opacity-50"
              style={{
                background: 'var(--glow-amber)',
                border: '1px solid var(--accent-amber)',
                color: 'var(--accent-amber)',
              }}
            >
              {saving ? t('savingPreset') : t('saveToPresets')}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="font-mono-display text-sm tracking-wider uppercase rounded py-2.5 px-4"
              style={{
                border: '1px solid var(--border-active)',
                color: 'var(--text-muted)',
                background: 'transparent',
              }}
            >
              {t('cancel')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
