'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslations } from 'next-intl';
import type { PlaylistPreset } from '@/lib/playlistDb';

interface GalleryPreset {
  id: string;
  name: string;
  author: string | null;
  style: string | null;
  modules: string[];
  shareToken: string;
  downloadCount: number;
  user: { username: string };
}

interface GalleryPickerDialogProps {
  onAdd: (presets: PlaylistPreset[]) => void;
  onClose: () => void;
}

const MODULE_NAMES = ['Amp', 'Distortion', 'Modulation', 'Delay', 'Reverb', 'Wah', 'Compressor', 'EQ', 'Cabinet'];
const STYLES = ['Rock', 'Metal', 'Blues', 'Jazz', 'Country', 'Funk', 'Pop', 'Punk', 'Ambient', 'Clean', 'Acoustic', 'Experimental'];
const MAX_SELECTION = 5;

export function GalleryPickerDialog({ onAdd, onClose }: GalleryPickerDialogProps) {
  const t = useTranslations('playlists');
  const tGallery = useTranslations('gallery');

  const [query, setQuery] = useState('');
  const [styleFilter, setStyleFilter] = useState('');
  const [activeModules, setActiveModules] = useState<string[]>([]);
  const [presets, setPresets] = useState<GalleryPreset[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Fetch gallery presets
  const fetchPresets = useCallback(async (p: number, append: boolean) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (activeModules.length > 0) params.set('modules', activeModules.join(','));
    if (styleFilter) params.set('style', styleFilter);
    params.set('sort', 'popular');
    params.set('page', String(p));
    params.set('limit', '20');

    try {
      const res = await fetch(`/api/gallery?${params}`);
      if (res.ok) {
        const data = await res.json();
        setPresets(prev => append ? [...prev, ...data.presets] : data.presets);
        setTotal(data.total);
      }
    } finally {
      setLoading(false);
    }
  }, [query, activeModules, styleFilter]);

  // Fetch on filter change (debounced for query)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
      fetchPresets(1, false);
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [fetchPresets]);

  // ESC to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  function toggleModule(mod: string) {
    setActiveModules(prev =>
      prev.includes(mod) ? prev.filter(m => m !== mod) : [...prev, mod]
    );
  }

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < MAX_SELECTION) {
        next.add(id);
      }
      return next;
    });
  }

  async function handleAdd() {
    if (selected.size === 0) return;
    setAdding(true);

    try {
      const selectedPresets = presets.filter(p => selected.has(p.id));
      const results: PlaylistPreset[] = [];

      for (const preset of selectedPresets) {
        const res = await fetch(`/api/share/${preset.shareToken}/download`);
        if (!res.ok) continue;
        const buffer = await res.arrayBuffer();
        results.push({
          id: crypto.randomUUID(),
          label: preset.name,
          presetName: preset.name,
          binary: buffer.slice(0, 1224),
        });
      }

      if (results.length > 0) onAdd(results);
    } finally {
      setAdding(false);
    }
  }

  function loadMore() {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchPresets(nextPage, true);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="flex w-full max-w-2xl flex-col rounded-lg"
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.6)',
          maxHeight: '80vh',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: 'var(--border-subtle)' }}>
          <div>
            <h2 className="font-mono-display text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
              {t('galleryPickerTitle')}
            </h2>
            <p className="font-mono-display text-xs" style={{ color: 'var(--text-secondary)' }}>
              {t('galleryPickerHint')}
            </p>
          </div>
          <button onClick={onClose} className="font-mono-display text-lg" style={{ color: 'var(--text-secondary)' }}>✕</button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 border-b px-5 py-3" style={{ borderColor: 'var(--border-subtle)' }}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tGallery('search')}
            className="flex-1 rounded px-2 py-1 font-mono-display text-xs"
            style={{ background: 'var(--bg-deep)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', minWidth: '150px' }}
          />
          <select
            value={styleFilter}
            onChange={(e) => setStyleFilter(e.target.value)}
            className="rounded px-2 py-1 font-mono-display text-xs"
            style={{ background: 'var(--bg-deep)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
          >
            <option value="">Style</option>
            {STYLES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* Module chips */}
        <div className="flex flex-wrap gap-1.5 px-5 py-2">
          {MODULE_NAMES.map(mod => (
            <button
              key={mod}
              onClick={() => toggleModule(mod)}
              className="rounded-full px-2 py-0.5 font-mono-display text-xs transition-all"
              style={{
                background: activeModules.includes(mod) ? 'var(--accent-amber)' : 'transparent',
                color: activeModules.includes(mod) ? 'var(--bg-deep)' : 'var(--text-secondary)',
                border: `1px solid ${activeModules.includes(mod) ? 'var(--accent-amber)' : 'var(--border-subtle)'}`,
              }}
            >
              {mod}
            </button>
          ))}
        </div>

        {/* Preset list */}
        <div className="flex-1 overflow-y-auto px-5 py-2" style={{ minHeight: '200px' }}>
          {loading && presets.length === 0 && (
            <p className="py-8 text-center font-mono-display text-sm" style={{ color: 'var(--text-secondary)' }}>
              {t('galleryPickerLoading')}
            </p>
          )}

          {!loading && presets.length === 0 && (
            <p className="py-8 text-center font-mono-display text-sm" style={{ color: 'var(--text-secondary)' }}>
              {t('galleryPickerNone')}
            </p>
          )}

          <div className="flex flex-col gap-2">
            {presets.map(preset => {
              const isSelected = selected.has(preset.id);
              const atMax = selected.size >= MAX_SELECTION && !isSelected;
              return (
                <button
                  key={preset.id}
                  onClick={() => !atMax && toggleSelect(preset.id)}
                  disabled={atMax}
                  className="flex items-center gap-3 rounded-lg p-3 text-left transition-all"
                  style={{
                    background: isSelected ? 'var(--glow-amber, rgba(212,162,78,0.15))' : 'var(--bg-deep)',
                    border: isSelected ? '2px solid var(--accent-amber)' : '1px solid var(--border-subtle)',
                    opacity: atMax ? 0.5 : 1,
                    cursor: atMax ? 'not-allowed' : 'pointer',
                  }}
                >
                  {/* Checkbox indicator */}
                  <div
                    className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded"
                    style={{
                      background: isSelected ? 'var(--accent-amber)' : 'transparent',
                      border: isSelected ? 'none' : '2px solid var(--border-subtle)',
                      color: 'var(--bg-deep)',
                    }}
                  >
                    {isSelected && '✓'}
                  </div>

                  {/* Preset info */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono-display text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                      {preset.name}
                    </p>
                    <p className="font-mono-display text-xs" style={{ color: 'var(--text-secondary)' }}>
                      {preset.user.username}
                      {preset.style && (
                        <span className="ml-2 rounded-full px-1.5 py-0.5" style={{ background: 'var(--glow-amber, rgba(212,162,78,0.15))', color: 'var(--accent-amber)' }}>
                          {preset.style}
                        </span>
                      )}
                      <span className="ml-2">↓{preset.downloadCount}</span>
                    </p>
                  </div>

                  {/* Module badges */}
                  <div className="flex flex-wrap gap-1">
                    {preset.modules.slice(0, 3).map(mod => (
                      <span key={mod} className="rounded px-1 py-0.5 font-mono-display text-[10px]"
                            style={{ background: 'var(--bg-surface)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>
                        {mod}
                      </span>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Load more */}
          {presets.length < total && (
            <button
              onClick={loadMore}
              disabled={loading}
              className="mt-3 w-full rounded py-2 font-mono-display text-xs"
              style={{ color: 'var(--accent-amber)', border: '1px solid var(--accent-amber)' }}
            >
              {loading ? t('galleryPickerLoading') : tGallery('loadMore')}
            </button>
          )}
        </div>

        {/* Footer with selection count + Add button */}
        <div className="flex items-center justify-between border-t px-5 py-3" style={{ borderColor: 'var(--border-subtle)' }}>
          <span className="font-mono-display text-xs" style={{ color: 'var(--text-secondary)' }}>
            {selected.size > 0
              ? t('galleryPickerSelected', { count: selected.size })
              : t('galleryPickerHint')}
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded px-3 py-1.5 font-mono-display text-xs"
              style={{ color: 'var(--text-secondary)' }}
            >
              ✕
            </button>
            <button
              onClick={handleAdd}
              disabled={selected.size === 0 || adding}
              className="rounded px-4 py-1.5 font-mono-display text-xs font-bold disabled:opacity-50"
              style={{ background: 'var(--accent-amber)', color: 'var(--bg-deep)' }}
            >
              {adding ? '...' : `${t('galleryPickerAdd')} (${selected.size})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
