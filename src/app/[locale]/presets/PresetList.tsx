'use client';

import { useState, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';

type Preset = {
  id: string;
  name: string;
  description: string | null;
  tags: string[];
  modules: string[];
  public: boolean;
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

    if (!file.name.endsWith('.prst') && !file.name.endsWith('.hlx')) {
      setUploadError(t('invalidFile'));
      return;
    }

    setUploading(true);
    setUploadError(null);

    let uploadFile = file;

    // Convert .hlx → .prst before upload
    if (file.name.endsWith('.hlx')) {
      try {
        const text = await file.text();
        const hlx = JSON.parse(text);
        const { convertHLX } = await import('@/core/HLXConverter');
        const { PRSTEncoder } = await import('@/core/PRSTEncoder');
        const preset = convertHLX(hlx);
        const encoder = new PRSTEncoder();
        const buf = encoder.encode(preset);
        const blob = new Blob([buf], { type: 'application/octet-stream' });
        const name = (preset.patchName || 'HLX Import').replace(/[^a-zA-Z0-9 _-]/g, '') + '.prst';
        uploadFile = new File([blob], name, { type: 'application/octet-stream' });
      } catch {
        setUploadError('HLX conversion failed');
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
    }

    const formData = new FormData();
    formData.append('preset', uploadFile);

    const res = await fetch('/api/presets', { method: 'POST', body: formData });
    if (!res.ok) {
      setUploadError(t('uploadError'));
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Use the created preset from the POST response instead of re-fetching the
    // whole list — saves a round-trip and is O(1) on a long list.
    try {
      const created = await res.json();
      const optimistic: Preset = {
        id: created.id,
        name: created.name,
        description: null,
        tags: [],
        modules: created.modules ?? [],
        public: created.public ?? false,
        shareToken: created.shareToken,
        downloadCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setPresets((prev) => [optimistic, ...prev]);
    } catch {
      // If the response wasn't JSON for some reason, fall back to a refetch.
      const listRes = await fetch('/api/presets');
      if (listRes.ok) {
        const payload = await listRes.json();
        const updated: Preset[] = Array.isArray(payload) ? payload : payload.presets ?? [];
        setPresets(updated);
      }
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

  async function handlePublish(preset: Preset) {
    const res = await fetch(`/api/presets/${preset.id}/publish`, { method: 'POST' });
    if (res.ok) {
      const data = await res.json() as { public: boolean };
      setPresets((prev) =>
        prev.map((p) => (p.id === preset.id ? { ...p, public: data.public } : p)),
      );
    }
  }

  async function handleDownload(preset: Preset) {
    const a = document.createElement('a');
    a.href = `/api/presets/${preset.id}/download`;
    a.download = `${preset.name}.prst`;
    a.click();
  }

  const actionBtnClass = "font-mono-display text-[11px] font-medium tracking-wider uppercase px-3 py-1.5 rounded transition-all duration-150";

  return (
    <div>
      {/* Upload button */}
      <div className="mb-6">
        <input
          ref={fileInputRef}
          type="file"
          accept=".prst,.hlx"
          className="hidden"
          id="preset-file-input"
          onChange={handleFileChange}
          disabled={uploading}
        />
        <label
          htmlFor="preset-file-input"
          className="cursor-pointer inline-block font-mono-display text-sm font-bold tracking-wider uppercase px-6 py-2.5 rounded transition-all duration-150"
          style={{
            background: 'var(--glow-amber)',
            border: '1px solid var(--accent-amber)',
            color: 'var(--accent-amber)',
            boxShadow: '0 0 12px var(--glow-amber)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--accent-amber)';
            e.currentTarget.style.color = 'var(--bg-primary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--glow-amber)';
            e.currentTarget.style.color = 'var(--accent-amber)';
          }}
        >
          {uploading ? t('saving') : t('upload')}
        </label>
        {uploadError && (
          <p
            className="mt-2 text-sm rounded px-3 py-2 inline-block ml-3"
            style={{
              color: 'var(--accent-red)',
              background: 'var(--glow-red)',
              border: '1px solid rgba(196, 78, 78, 0.25)',
            }}
          >
            {uploadError}
          </p>
        )}
      </div>

      {/* Preset list */}
      {presets.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>{t('noPresets')}</p>
      ) : (
        <ul className="space-y-3">
          {presets.map((preset) => (
            <li
              key={preset.id}
              data-testid="preset-card"
              className="rounded-lg p-4 flex flex-col gap-2"
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2
                    className="font-mono-display font-bold text-lg truncate"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {preset.name}
                  </h2>
                  {preset.description && (
                    <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                      {preset.description}
                    </p>
                  )}
                  {preset.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {preset.tags.map((tag) => (
                        <span
                          key={tag}
                          className="font-mono-display text-[10px] tracking-wider px-2 py-0.5 rounded uppercase"
                          style={{
                            color: 'var(--accent-amber)',
                            background: 'var(--glow-amber)',
                            border: '1px solid var(--accent-amber-dim)',
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                    {new Date(preset.createdAt).toLocaleDateString()}
                    <span className="mx-2" style={{ color: 'var(--border-active)' }}>&middot;</span>
                    {preset.downloadCount} {t('downloads')}
                  </p>
                </div>
                <div className="flex flex-col gap-1.5 shrink-0">
                  <Link
                    href={`/presets/${preset.id}/edit`}
                    data-testid="preset-edit-link"
                    className={`${actionBtnClass} border border-[var(--border-active)] text-[var(--text-secondary)] hover:border-[var(--accent-amber)] hover:text-[var(--accent-amber)] transition-colors`}
                  >
                    {t('editPreset')}
                  </Link>
                  <button
                    onClick={() => handleDownload(preset)}
                    data-testid="preset-download-button"
                    className={actionBtnClass}
                    style={{
                      border: '1px solid var(--border-active)',
                      color: 'var(--text-secondary)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--accent-amber)';
                      e.currentTarget.style.color = 'var(--accent-amber)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border-active)';
                      e.currentTarget.style.color = 'var(--text-secondary)';
                    }}
                  >
                    {t('download')}
                  </button>
                  <button
                    onClick={() => handleCopyLink(preset)}
                    data-testid="preset-copy-link"
                    data-share-token={preset.shareToken}
                    className={actionBtnClass}
                    style={{
                      border: copiedId === preset.id ? '1px solid var(--accent-green)' : '1px solid var(--border-active)',
                      color: copiedId === preset.id ? 'var(--accent-green)' : 'var(--text-secondary)',
                    }}
                    onMouseEnter={(e) => {
                      if (copiedId !== preset.id) {
                        e.currentTarget.style.borderColor = 'var(--accent-amber)';
                        e.currentTarget.style.color = 'var(--accent-amber)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (copiedId !== preset.id) {
                        e.currentTarget.style.borderColor = 'var(--border-active)';
                        e.currentTarget.style.color = 'var(--text-secondary)';
                      }
                    }}
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
                    className={actionBtnClass}
                    style={{
                      border: '1px solid var(--border-active)',
                      color: 'var(--text-secondary)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--accent-amber)';
                      e.currentTarget.style.color = 'var(--accent-amber)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border-active)';
                      e.currentTarget.style.color = 'var(--text-secondary)';
                    }}
                  >
                    {t('resetLink')}
                  </button>
                  <button
                    onClick={() => handlePublish(preset)}
                    data-testid="preset-publish-button"
                    className={actionBtnClass}
                    style={{
                      border: preset.public
                        ? '1px solid var(--accent-green)'
                        : '1px solid var(--border-active)',
                      color: preset.public
                        ? 'var(--accent-green)'
                        : 'var(--text-secondary)',
                      background: preset.public ? 'var(--glow-green)' : 'transparent',
                    }}
                  >
                    {preset.public ? t('published') : t('publish')}
                  </button>
                  <button
                    onClick={() => handleDelete(preset.id)}
                    data-testid="preset-delete-button"
                    className={actionBtnClass}
                    style={{
                      border: '1px solid rgba(196, 78, 78, 0.3)',
                      color: 'var(--accent-red)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--glow-red)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                    }}
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
