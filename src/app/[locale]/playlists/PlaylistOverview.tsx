'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { usePlaylist } from '@/hooks/usePlaylist';

type View = { type: 'overview' } | { type: 'edit'; id: string } | { type: 'play'; id: string };

interface PlaylistOverviewProps {
  onNavigate: (view: View) => void;
}

export function PlaylistOverview({ onNavigate }: PlaylistOverviewProps) {
  const t = useTranslations('playlists');
  const { playlists, loading, createPlaylist, deletePlaylist } = usePlaylist();
  const [showCreateInput, setShowCreateInput] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  async function handleCreate() {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const id = await createPlaylist(name);
      setNewName('');
      setShowCreateInput(false);
      onNavigate({ type: 'edit', id });
    } finally {
      setCreating(false);
    }
  }

  async function handleDeleteClick(id: string) {
    if (confirmDeleteId === id) {
      await deletePlaylist(id);
      setConfirmDeleteId(null);
    } else {
      setConfirmDeleteId(id);
    }
  }

  const btnClass =
    'font-mono-display text-[11px] font-medium tracking-wider uppercase px-3 py-1.5 rounded transition-all duration-150';

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6 gap-4">
        <h1
          className="font-mono-display text-xl font-bold tracking-tight"
          style={{ color: 'var(--accent-amber)' }}
        >
          {t('title')}
        </h1>

        {!showCreateInput && (
          <button
            onClick={() => setShowCreateInput(true)}
            className="font-mono-display text-sm font-bold tracking-wider uppercase px-5 py-2 rounded transition-all duration-150"
            style={{
              background: 'var(--glow-amber)',
              border: '1px solid var(--accent-amber)',
              color: 'var(--accent-amber)',
              boxShadow: '0 0 12px var(--glow-amber)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--accent-amber)';
              e.currentTarget.style.color = 'var(--bg-deep, #0a0a0a)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--glow-amber)';
              e.currentTarget.style.color = 'var(--accent-amber)';
            }}
          >
            {t('create')}
          </button>
        )}
      </div>

      {/* Inline create form */}
      {showCreateInput && (
        <div
          className="mb-6 flex items-center gap-3 p-4 rounded-lg"
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <input
            autoFocus
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate();
              if (e.key === 'Escape') {
                setShowCreateInput(false);
                setNewName('');
              }
            }}
            placeholder={t('namePlaceholder')}
            className="flex-1 bg-transparent outline-none font-mono-display text-sm px-2 py-1 rounded"
            style={{
              color: 'var(--text-primary)',
              border: '1px solid var(--border-active)',
            }}
            disabled={creating}
          />
          <button
            onClick={handleCreate}
            disabled={creating || !newName.trim()}
            className={btnClass}
            style={{
              background: 'var(--glow-amber)',
              border: '1px solid var(--accent-amber)',
              color: 'var(--accent-amber)',
              opacity: creating || !newName.trim() ? 0.5 : 1,
            }}
          >
            {t('save')}
          </button>
          <button
            onClick={() => {
              setShowCreateInput(false);
              setNewName('');
            }}
            className={btnClass}
            style={{
              border: '1px solid var(--border-active)',
              color: 'var(--text-secondary)',
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex items-center gap-3 py-8" style={{ color: 'var(--text-secondary)' }}>
          <span
            className="inline-block w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin"
            aria-hidden="true"
          />
          <span className="font-mono-display text-sm">…</span>
        </div>
      )}

      {/* Empty state */}
      {!loading && playlists.length === 0 && (
        <p
          className="font-mono-display text-sm py-8 text-center"
          style={{ color: 'var(--text-secondary)' }}
        >
          {t('empty')}
        </p>
      )}

      {/* Playlist list */}
      {!loading && playlists.length > 0 && (
        <ul className="space-y-3">
          {playlists.map((playlist) => (
            <li
              key={playlist.id}
              className="rounded-lg p-4 flex items-center gap-4"
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              {/* Main clickable area → play mode */}
              <button
                className="flex-1 text-left min-w-0"
                onClick={() => onNavigate({ type: 'play', id: playlist.id })}
              >
                <p
                  className="font-mono-display font-bold text-base truncate"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {playlist.name}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                  {t('songs', { count: playlist.entries.length })}
                  <span
                    className="mx-2"
                    style={{ color: 'var(--border-active)' }}
                    aria-hidden="true"
                  >
                    &middot;
                  </span>
                  {new Date(playlist.updatedAt).toLocaleDateString()}
                </p>
              </button>

              {/* Action buttons */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => onNavigate({ type: 'play', id: playlist.id })}
                  className={btnClass}
                  style={{
                    background: 'var(--glow-amber)',
                    border: '1px solid var(--accent-amber)',
                    color: 'var(--accent-amber)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(212,162,78,0.25)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'var(--glow-amber)';
                  }}
                >
                  ▶ {t('player')}
                </button>
                <button
                  onClick={() => onNavigate({ type: 'edit', id: playlist.id })}
                  className={btnClass}
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
                  {t('edit')}
                </button>

                <button
                  onClick={() => handleDeleteClick(playlist.id)}
                  className={btnClass}
                  title={confirmDeleteId === playlist.id ? t('deleteConfirm', { name: playlist.name }) : undefined}
                  style={{
                    border:
                      confirmDeleteId === playlist.id
                        ? '1px solid var(--accent-red)'
                        : '1px solid rgba(196, 78, 78, 0.3)',
                    color: 'var(--accent-red)',
                    background:
                      confirmDeleteId === playlist.id ? 'var(--glow-red)' : 'transparent',
                  }}
                  onMouseEnter={(e) => {
                    if (confirmDeleteId !== playlist.id) {
                      e.currentTarget.style.background = 'var(--glow-red)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (confirmDeleteId !== playlist.id) {
                      e.currentTarget.style.background = 'transparent';
                    }
                  }}
                >
                  {confirmDeleteId === playlist.id ? '✓ ?' : t('delete')}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
