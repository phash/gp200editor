'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { MODULE_COLORS } from '@/core/effectNames';

type GalleryPreset = {
  id: string;
  name: string;
  description: string | null;
  tags: string[];
  modules: string[];
  shareToken: string;
  downloadCount: number;
  createdAt: string;
  user: { username: string };
};

const ALL_MODULES = Object.keys(MODULE_COLORS);

export function GalleryClient() {
  const t = useTranslations('gallery');
  const [presets, setPresets] = useState<GalleryPreset[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [activeModules, setActiveModules] = useState<string[]>([]);
  const [sort, setSort] = useState<'newest' | 'popular'>('newest');
  const [loading, setLoading] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchPresets = useCallback(async (p: number, append: boolean) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (activeModules.length > 0) params.set('modules', activeModules.join(','));
    params.set('sort', sort);
    params.set('page', String(p));
    params.set('limit', '20');

    const res = await fetch(`/api/gallery?${params}`);
    if (res.ok) {
      const data = await res.json();
      setPresets((prev) => append ? [...prev, ...data.presets] : data.presets);
      setTotal(data.total);
    }
    setLoading(false);
  }, [query, activeModules, sort]);

  // Fetch on filter/sort change (reset to page 1)
  useEffect(() => {
    setPage(1);
    fetchPresets(1, false);
  }, [fetchPresets]);

  function handleSearchChange(value: string) {
    setQuery(value);
  }

  function handleSearchInput(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => handleSearchChange(value), 300);
  }

  function toggleModule(mod: string) {
    setActiveModules((prev) =>
      prev.includes(mod) ? prev.filter((m) => m !== mod) : [...prev, mod],
    );
  }

  function handleLoadMore() {
    const next = page + 1;
    setPage(next);
    fetchPresets(next, true);
  }

  return (
    <div>
      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder={t('search')}
          defaultValue={query}
          onChange={handleSearchInput}
          className="w-full max-w-md rounded px-3 py-2 text-sm focus:outline-none transition-shadow font-mono-display"
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-active)',
            color: 'var(--text-primary)',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = 'var(--accent-amber)';
            e.currentTarget.style.boxShadow = '0 0 0 2px var(--glow-amber)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-active)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        />
      </div>

      {/* Module filter chips */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {ALL_MODULES.map((mod) => {
          const colors = MODULE_COLORS[mod];
          const active = activeModules.includes(mod);
          return (
            <button
              key={mod}
              onClick={() => toggleModule(mod)}
              className="font-mono-display text-[10px] font-bold tracking-widest px-2.5 py-1 rounded uppercase transition-all duration-150"
              style={{
                background: active ? colors.glow : 'transparent',
                border: `1px solid ${active ? colors.accent : 'var(--border-active)'}`,
                color: active ? colors.accent : 'var(--text-muted)',
              }}
            >
              {mod}
            </button>
          );
        })}
      </div>

      {/* Sort toggle */}
      <div className="flex gap-2 mb-6">
        {(['newest', 'popular'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSort(s)}
            className="font-mono-display text-[11px] font-medium tracking-wider uppercase px-3 py-1.5 rounded transition-all duration-150"
            style={{
              background: sort === s ? 'var(--glow-amber)' : 'transparent',
              border: `1px solid ${sort === s ? 'var(--accent-amber)' : 'var(--border-active)'}`,
              color: sort === s ? 'var(--accent-amber)' : 'var(--text-muted)',
            }}
          >
            {s === 'newest' ? t('sortNewest') : t('sortPopular')}
          </button>
        ))}
      </div>

      {/* Results */}
      {presets.length === 0 && !loading ? (
        <p style={{ color: 'var(--text-muted)' }}>{t('noResults')}</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {presets.map((preset) => (
            <div
              key={preset.id}
              className="rounded-lg p-4"
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <h2
                  className="font-mono-display font-bold text-base truncate"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {preset.name}
                </h2>
                <span
                  className="font-mono-display text-[11px] flex-shrink-0"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {t('by')} @{preset.user.username}
                </span>
              </div>

              {/* Module badges */}
              {preset.modules.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {preset.modules.map((mod) => {
                    const colors = MODULE_COLORS[mod] ?? MODULE_COLORS.VOL;
                    return (
                      <span
                        key={mod}
                        className="font-mono-display text-[9px] font-bold tracking-widest px-1.5 py-0.5 rounded uppercase"
                        style={{
                          color: colors.accent,
                          background: colors.glow,
                          border: `1px solid ${colors.accentDim}`,
                        }}
                      >
                        {mod}
                      </span>
                    );
                  })}
                </div>
              )}

              {/* Tags */}
              {preset.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
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

              {/* Footer: downloads + download button */}
              <div className="flex items-center justify-between mt-3 pt-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {preset.downloadCount} {t('downloads')}
                </span>
                <a
                  href={`/api/share/${preset.shareToken}/download`}
                  className="font-mono-display text-[10px] font-bold tracking-wider uppercase px-3 py-1 rounded transition-all duration-150"
                  style={{
                    border: '1px solid var(--accent-amber)',
                    color: 'var(--accent-amber)',
                    background: 'var(--glow-amber)',
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
                  {t('download')}
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Load more */}
      {presets.length < total && (
        <div className="mt-6 text-center">
          <button
            onClick={handleLoadMore}
            disabled={loading}
            className="font-mono-display text-sm font-medium tracking-wider uppercase px-6 py-2 rounded transition-all duration-150 disabled:opacity-50"
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
            {t('loadMore')}
          </button>
        </div>
      )}
    </div>
  );
}
