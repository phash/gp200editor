'use client';

import { useState, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';

type Preset = {
  id: string;
  name: string;
  description: string | null;
  tags: string[];
  shareToken: string;
  downloadCount: number;
  createdAt: string | Date;
  updatedAt: string | Date;
};

type Props = {
  initialPresets: Preset[];
};

export function PresetList({ initialPresets }: Props) {
  const t = useTranslations('presets');
  const [presets, setPresets] = useState<Preset[]>(initialPresets);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.prst')) {
      setUploadError(t('invalidFile'));
      return;
    }

    setUploading(true);
    setUploadError(null);

    const formData = new FormData();
    formData.append('preset', file);

    const res = await fetch('/api/presets', { method: 'POST', body: formData });
    if (!res.ok) {
      setUploadError(t('uploadError'));
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Refresh preset list
    const listRes = await fetch('/api/presets');
    if (listRes.ok) {
      const updated: Preset[] = await listRes.json();
      setPresets(updated);
    }

    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleDelete(id: string) {
    if (!confirm(t('deleteConfirm'))) return;

    const res = await fetch(`/api/presets/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setPresets((prev) => prev.filter((p) => p.id !== id));
    }
  }

  async function handleCopyLink(preset: Preset) {
    const url = `${window.location.origin}/${window.location.pathname.split('/')[1]}/share/${preset.shareToken}`;
    await navigator.clipboard.writeText(url);
    setCopiedId(preset.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  async function handleResetLink(preset: Preset) {
    if (!confirm(t('resetLinkConfirm'))) return;

    const res = await fetch(`/api/presets/${preset.id}/share/revoke`, { method: 'POST' });
    if (res.ok) {
      const { shareToken } = await res.json();
      setPresets((prev) =>
        prev.map((p) => (p.id === preset.id ? { ...p, shareToken } : p)),
      );
    }
  }

  async function handleDownload(preset: Preset) {
    const a = document.createElement('a');
    a.href = `/api/presets/${preset.id}/download`;
    a.download = `${preset.name}.prst`;
    a.click();
  }

  return (
    <div>
      {/* Upload button */}
      <div className="mb-6">
        <input
          ref={fileInputRef}
          type="file"
          accept=".prst"
          className="hidden"
          id="preset-file-input"
          onChange={handleFileChange}
          disabled={uploading}
        />
        <label
          htmlFor="preset-file-input"
          className="cursor-pointer inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
        >
          {uploading ? t('saving') : t('upload')}
        </label>
        {uploadError && (
          <p className="mt-2 text-red-500 text-sm">{uploadError}</p>
        )}
      </div>

      {/* Preset list */}
      {presets.length === 0 ? (
        <p className="text-gray-500">{t('noPresets')}</p>
      ) : (
        <ul className="space-y-4">
          {presets.map((preset) => (
            <li
              key={preset.id}
              data-testid="preset-card"
              className="border rounded-lg p-4 flex flex-col gap-2"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-semibold text-lg">{preset.name}</h2>
                  {preset.description && (
                    <p className="text-sm text-gray-600 mt-1">{preset.description}</p>
                  )}
                  {preset.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {preset.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-gray-400 mt-2">
                    {new Date(preset.createdAt).toLocaleDateString()} &middot; {preset.downloadCount} {t('downloads')}
                  </p>
                </div>
                <div className="flex flex-col gap-2 shrink-0">
                  <Link
                    href={`/presets/${preset.id}/edit`}
                    data-testid="preset-edit-link"
                    className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
                  >
                    {t('editPreset')}
                  </Link>
                  <button
                    onClick={() => handleDownload(preset)}
                    data-testid="preset-download-button"
                    className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
                  >
                    {t('download')}
                  </button>
                  <button
                    onClick={() => handleCopyLink(preset)}
                    data-testid="preset-copy-link"
                    data-share-token={preset.shareToken}
                    className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
                  >
                    {copiedId === preset.id ? (
                      <span data-testid="preset-link-copied">{t('linkCopied')}</span>
                    ) : (
                      t('copyLink')
                    )}
                  </button>
                  <button
                    onClick={() => handleResetLink(preset)}
                    data-testid="preset-reset-link-button"
                    className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
                  >
                    {t('resetLink')}
                  </button>
                  <button
                    onClick={() => handleDelete(preset.id)}
                    data-testid="preset-delete-button"
                    className="px-3 py-1 text-sm border border-red-300 text-red-600 rounded hover:bg-red-50"
                  >
                    {t('delete')}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
