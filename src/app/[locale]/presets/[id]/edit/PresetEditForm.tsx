'use client';

import { useState, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';

type PresetData = {
  id: string;
  name: string;
  description: string | null;
  tags: string[];
  shareToken: string;
};

type Props = {
  preset: PresetData;
};

export function PresetEditForm({ preset }: Props) {
  const t = useTranslations('presets');
  const [name, setName] = useState(preset.name);
  const [description, setDescription] = useState(preset.description ?? '');
  const [tags, setTags] = useState<string[]>(preset.tags);
  const [tagInput, setTagInput] = useState('');
  const [replaceFile, setReplaceFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleTagKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const value = tagInput.trim();
      if (value && !tags.includes(value) && tags.length < 10) {
        setTags((prev) => [...prev, value]);
      }
      setTagInput('');
    }
  }

  function removeTag(tag: string) {
    setTags((prev) => prev.filter((t) => t !== tag));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('saving');

    const formData = new FormData();
    formData.append('name', name);
    formData.append('description', description);
    formData.append('tags', JSON.stringify(tags));
    if (replaceFile) {
      formData.append('preset', replaceFile);
    }

    const res = await fetch(`/api/presets/${preset.id}`, {
      method: 'PATCH',
      body: formData,
    });

    if (res.ok) {
      setStatus('saved');
      setReplaceFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setTimeout(() => setStatus('idle'), 2000);
    } else {
      setStatus('error');
    }
  }

  const inputStyle = {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border-active)',
    color: 'var(--text-primary)',
  };

  function handleInputFocus(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
    e.currentTarget.style.borderColor = 'var(--accent-amber)';
    e.currentTarget.style.boxShadow = '0 0 0 2px var(--glow-amber)';
  }

  function handleInputBlur(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
    e.currentTarget.style.borderColor = 'var(--border-active)';
    e.currentTarget.style.boxShadow = 'none';
  }

  return (
    <div
      className="rounded-lg p-6"
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.03)',
      }}
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Name */}
        <div>
          <label
            className="block font-mono-display text-[11px] font-medium tracking-wider uppercase mb-1.5"
            htmlFor="preset-name"
            style={{ color: 'var(--text-secondary)' }}
          >
            {t('name')}
          </label>
          <input
            id="preset-name"
            type="text"
            data-testid="preset-name-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={32}
            required
            className="w-full rounded px-3 py-2 text-sm font-mono-display focus:outline-none transition-shadow"
            style={inputStyle}
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
          />
        </div>

        {/* Description */}
        <div>
          <label
            className="block font-mono-display text-[11px] font-medium tracking-wider uppercase mb-1.5"
            htmlFor="preset-description"
            style={{ color: 'var(--text-secondary)' }}
          >
            {t('description')}
          </label>
          <textarea
            id="preset-description"
            data-testid="preset-description-input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={500}
            rows={4}
            className="w-full rounded px-3 py-2 text-sm focus:outline-none transition-shadow resize-none"
            style={inputStyle}
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
          />
        </div>

        {/* Tags */}
        <div>
          <label
            className="block font-mono-display text-[11px] font-medium tracking-wider uppercase mb-1.5"
            style={{ color: 'var(--text-secondary)' }}
          >
            {t('tags')}
          </label>
          <div className="flex flex-wrap gap-1 mb-2">
            {tags.map((tag) => (
              <span
                key={tag}
                className="flex items-center gap-1 font-mono-display text-[10px] tracking-wider px-2 py-0.5 rounded uppercase"
                style={{
                  color: 'var(--accent-amber)',
                  background: 'var(--glow-amber)',
                  border: '1px solid var(--accent-amber-dim)',
                }}
              >
                {tag}
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  className="ml-0.5 transition-colors"
                  style={{ color: 'var(--accent-amber-dim)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent-amber)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--accent-amber-dim)')}
                  aria-label={`Remove tag ${tag}`}
                >
                  &times;
                </button>
              </span>
            ))}
          </div>
          <input
            type="text"
            data-testid="preset-tag-input"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleTagKeyDown}
            placeholder={t('addTag')}
            className="w-full rounded px-3 py-2 text-sm focus:outline-none transition-shadow"
            style={inputStyle}
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
            disabled={tags.length >= 10}
          />
        </div>

        {/* Replace file */}
        <div>
          <label
            className="block font-mono-display text-[11px] font-medium tracking-wider uppercase mb-1.5"
            htmlFor="preset-replace-file"
            style={{ color: 'var(--text-secondary)' }}
          >
            {t('replaceFile')}
          </label>
          <input
            ref={fileInputRef}
            id="preset-replace-file"
            type="file"
            accept=".prst"
            data-testid="preset-replace-file-input"
            onChange={(e) => setReplaceFile(e.target.files?.[0] ?? null)}
            className="block text-sm"
            style={{ color: 'var(--text-secondary)' }}
          />
        </div>

        {/* Actions */}
        <div
          className="flex items-center gap-4 pt-4"
          style={{ borderTop: '1px solid var(--border-subtle)' }}
        >
          <button
            type="submit"
            data-testid="preset-save-button"
            disabled={status === 'saving'}
            className="font-mono-display text-sm font-bold tracking-wider uppercase rounded px-5 py-2.5 transition-all duration-150 disabled:opacity-50"
            style={{
              background: 'var(--glow-amber)',
              border: '1px solid var(--accent-amber)',
              color: 'var(--accent-amber)',
              boxShadow: '0 0 12px var(--glow-amber)',
            }}
            onMouseEnter={(e) => {
              if (status !== 'saving') {
                e.currentTarget.style.background = 'var(--accent-amber)';
                e.currentTarget.style.color = 'var(--bg-primary)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--glow-amber)';
              e.currentTarget.style.color = 'var(--accent-amber)';
            }}
          >
            {status === 'saving' ? t('saving') : t('save')}
          </button>

          <Link
            href="/presets"
            className="text-sm transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent-amber)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            {t('backToPresets')}
          </Link>

          {status === 'saved' && (
            <span
              data-testid="preset-saved-indicator"
              className="text-sm font-mono-display"
              style={{ color: 'var(--accent-green)' }}
            >
              {t('saved')}
            </span>
          )}
          {status === 'error' && (
            <span className="text-sm font-mono-display" style={{ color: 'var(--accent-red)' }}>
              {t('saveFailed')}
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
