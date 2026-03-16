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

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Name */}
      <div>
        <label className="block text-sm font-medium mb-1" htmlFor="preset-name">
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
          className="w-full border rounded px-3 py-2"
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium mb-1" htmlFor="preset-description">
          {t('description')}
        </label>
        <textarea
          id="preset-description"
          data-testid="preset-description-input"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={500}
          rows={4}
          className="w-full border rounded px-3 py-2"
        />
      </div>

      {/* Tags */}
      <div>
        <label className="block text-sm font-medium mb-1">{t('tags')}</label>
        <div className="flex flex-wrap gap-1 mb-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-700 text-sm rounded"
            >
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className="ml-1 text-gray-400 hover:text-gray-700"
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
          className="border rounded px-3 py-2 w-full"
          disabled={tags.length >= 10}
        />
      </div>

      {/* Replace file */}
      <div>
        <label className="block text-sm font-medium mb-1" htmlFor="preset-replace-file">
          {t('replaceFile')}
        </label>
        <input
          ref={fileInputRef}
          id="preset-replace-file"
          type="file"
          accept=".prst"
          data-testid="preset-replace-file-input"
          onChange={(e) => setReplaceFile(e.target.files?.[0] ?? null)}
          className="block"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-4">
        <button
          type="submit"
          data-testid="preset-save-button"
          disabled={status === 'saving'}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {status === 'saving' ? t('saving') : t('save')}
        </button>

        <Link href="/presets" className="text-sm text-gray-500 hover:underline">
          {t('backToPresets')}
        </Link>

        {status === 'saved' && (
          <span data-testid="preset-saved-indicator" className="text-green-600 text-sm">
            {t('saved')}
          </span>
        )}
        {status === 'error' && (
          <span className="text-red-500 text-sm">{t('saveFailed')}</span>
        )}
      </div>
    </form>
  );
}
