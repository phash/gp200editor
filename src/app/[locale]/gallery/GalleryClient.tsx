'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { MODULE_COLORS, getEffectsByModule } from '@/core/effectNames';
import { GuitarRating } from '@/components/GuitarRating';

type GalleryPreset = {
  id: string;
  name: string;
  description: string | null;
  tags: string[];
  modules: string[];
  effects: string[];
  author: string | null;
  style: string | null;
  shareToken: string;
  downloadCount: number;
  ratingAverage: number;
  ratingCount: number;
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
  const [activeEffects, setActiveEffects] = useState<string[]>([]);
  const [expandedModule, setExpandedModule] = useState<string | null>(null);
  const [sort, setSort] = useState<'newest' | 'popular' | 'top-rated'>('newest');
  const [styleFilter, setStyleFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchPresets = useCallback(async (p: number, append: boolean) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (activeEffects.length > 0) params.set('effects', activeEffects.join(','));
    else if (activeModules.length > 0) params.set('modules', activeModules.join(','));
    if (styleFilter) params.set('style', styleFilter);
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
  }, [query, activeModules, activeEffects, styleFilter, sort]);

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

      {/* Module filter chips — click to toggle, click again to expand effect picker */}
      <div className="mb-4">
        <div className="flex flex-wrap gap-1.5">
          {ALL_MODULES.map((mod) => {
            const colors = MODULE_COLORS[mod];
            const active = activeModules.includes(mod);
            const hasEffectFilter = activeEffects.some(e => {
              const modEffects = getEffectsByModule(mod);
              return modEffects.some(me => me.name === e);
            });
            return (
              <button
                key={mod}
                onClick={() => {
                  if (expandedModule === mod) {
                    setExpandedModule(null);
                  } else if (active) {
                    setExpandedModule(mod);
                  } else {
                    toggleModule(mod);
                    setExpandedModule(mod);
                  }
                }}
                className="font-mono-display text-[10px] font-bold tracking-widest px-2.5 py-1 rounded uppercase transition-all duration-150"
                style={{
                  background: active || hasEffectFilter ? colors.glow : 'transparent',
                  border: `1px solid ${active || hasEffectFilter ? colors.accent : 'var(--border-active)'}`,
                  color: active || hasEffectFilter ? colors.accent : 'var(--text-muted)',
                }}
              >
                {mod} {(active || hasEffectFilter) && expandedModule !== mod ? '▸' : expandedModule === mod ? '▾' : ''}
              </button>
            );
          })}
          {(activeModules.length > 0 || activeEffects.length > 0) && (
            <button
              onClick={() => { setActiveModules([]); setActiveEffects([]); setExpandedModule(null); }}
              className="font-mono-display text-[10px] tracking-wider px-2 py-1 rounded"
              style={{ color: 'var(--text-muted)', border: '1px solid var(--border-active)' }}
            >
              ✕
            </button>
          )}
        </div>

        {/* Expanded effect picker for selected module */}
        {expandedModule && (() => {
          const colors = MODULE_COLORS[expandedModule];
          const modEffects = getEffectsByModule(expandedModule);
          return (
            <div
              className="mt-2 p-3 rounded-lg flex flex-wrap gap-1.5"
              style={{ background: 'var(--bg-surface)', border: `1px solid ${colors.accentDim}` }}
            >
              {modEffects.map(({ name }) => {
                const isActive = activeEffects.includes(name);
                return (
                  <button
                    key={name}
                    onClick={() => {
                      setActiveEffects(prev =>
                        isActive ? prev.filter(e => e !== name) : [...prev, name]
                      );
                      // Remove module-level filter when picking specific effects
                      setActiveModules(prev => prev.filter(m => m !== expandedModule));
                    }}
                    className="font-mono-display text-[10px] font-medium px-2 py-0.5 rounded transition-all duration-100"
                    style={{
                      background: isActive ? colors.glow : 'transparent',
                      border: `1px solid ${isActive ? colors.accent : 'var(--border-subtle)'}`,
                      color: isActive ? colors.accent : 'var(--text-secondary)',
                    }}
                  >
                    {name}
                  </button>
                );
              })}
            </div>
          );
        })()}
      </div>

      {/* Style filter + Sort toggle */}
      <div className="flex gap-2 mb-6 flex-wrap items-center">
        <select
          value={styleFilter}
          onChange={(e) => setStyleFilter(e.target.value)}
          className="font-mono-display text-[11px] font-medium tracking-wider uppercase px-3 py-1.5 rounded"
          style={{
            background: styleFilter ? 'var(--glow-amber)' : 'transparent',
            border: `1px solid ${styleFilter ? 'var(--accent-amber)' : 'var(--border-active)'}`,
            color: styleFilter ? 'var(--accent-amber)' : 'var(--text-muted)',
          }}
        >
          <option value="">Style</option>
          {['Rock', 'Metal', 'Blues', 'Jazz', 'Country', 'Funk', 'Pop', 'Punk', 'Ambient', 'Clean', 'Acoustic', 'Experimental'].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <span style={{ width: 1, height: 20, background: 'var(--border-active)' }} />
      </div>
      <div className="flex gap-2 mb-6">
        {(['newest', 'popular', 'top-rated'] as const).map((s) => (
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
            {s === 'newest' ? t('sortNewest') : s === 'popular' ? t('sortPopular') : t('sortTopRated')}
          </button>
        ))}
      </div>

      {/* Results */}
      {loading && presets.length === 0 ? (
        <div className="flex items-center gap-2 py-8">
          <span
            className="inline-block w-2 h-2 rounded-full animate-pulse"
            style={{ background: 'var(--accent-amber)' }}
          />
          <span className="font-mono-display text-sm" style={{ color: 'var(--text-muted)' }}>
            {t('loading')}
          </span>
        </div>
      ) : presets.length === 0 && !loading ? (
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
                  {t('by')} {preset.author || `@${preset.user.username}`}
                  {preset.style && (
                    <span style={{ color: 'var(--accent-amber)', marginLeft: 6 }}>{preset.style}</span>
                  )}
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

              {/* Footer: downloads + buttons */}
              <div className="flex items-center justify-between gap-2 mt-3 pt-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
                    {preset.downloadCount} ↓
                  </span>
                  {preset.ratingCount > 0 && (
                    <GuitarRating value={preset.ratingAverage} count={preset.ratingCount} size="sm" />
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <Link
                    href={`/editor?share=${preset.shareToken}`}
                    className="font-mono-display text-[10px] font-bold tracking-wider uppercase px-3 py-1 rounded transition-all duration-150 hover:!bg-[var(--accent-amber)] hover:!text-[var(--bg-primary)]"
                    style={{
                      border: '1px solid var(--border-active)',
                      color: 'var(--text-secondary)',
                      background: 'transparent',
                    }}
                  >
                    {t('openInEditor')}
                  </Link>
                  <a
                    href={`/api/share/${preset.shareToken}/download`}
                    className="font-mono-display text-[10px] font-bold tracking-wider uppercase px-3 py-1 rounded transition-all duration-150 hover:!bg-[var(--accent-amber)] hover:!text-[var(--bg-primary)]"
                    style={{
                      border: '1px solid var(--accent-amber)',
                      color: 'var(--accent-amber)',
                      background: 'var(--glow-amber)',
                    }}
                  >
                    {t('download')}
                  </a>
                </div>
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
