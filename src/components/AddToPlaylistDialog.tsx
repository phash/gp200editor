'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { usePlaylist } from '@/hooks/usePlaylist';
import type { Playlist, PlaylistPreset } from '@/lib/playlistDb';

interface AddToPlaylistDialogProps {
  presetName: string;
  presetBinary: ArrayBuffer;
  onClose: () => void;
}

export function AddToPlaylistDialog({ presetName, presetBinary, onClose }: AddToPlaylistDialogProps) {
  const t = useTranslations('playlists');
  const { playlists, loading, createPlaylist, updatePlaylist, getPlaylist } = usePlaylist();

  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string>('');
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [songName, setSongName] = useState('');
  const [label, setLabel] = useState(presetName);
  const [selectedSongId, setSelectedSongId] = useState<string>('new');
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [saving, setSaving] = useState(false);

  // ESC to close
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  // Load playlist details when selection changes
  useEffect(() => {
    if (!selectedPlaylistId) {
      setSelectedPlaylist(null);
      setSelectedSongId('new');
      return;
    }
    getPlaylist(selectedPlaylistId).then((pl) => {
      setSelectedPlaylist(pl ?? null);
      setSelectedSongId('new');
    });
  }, [selectedPlaylistId, getPlaylist]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      let playlistId = selectedPlaylistId;
      if (!playlistId && newPlaylistName.trim()) {
        playlistId = await createPlaylist(newPlaylistName.trim());
      }
      if (!playlistId) return;

      const playlist = await getPlaylist(playlistId);
      if (!playlist) return;

      const newPreset: PlaylistPreset = {
        id: crypto.randomUUID(),
        label: label.trim() || presetName,
        presetName,
        binary: presetBinary.slice(0, 1224),
      };

      if (selectedSongId === 'new' && songName.trim()) {
        playlist.entries.push({
          id: crypto.randomUUID(),
          songName: songName.trim(),
          presets: [newPreset],
        });
      } else if (selectedSongId !== 'new') {
        const entry = playlist.entries.find((e) => e.id === selectedSongId);
        if (entry) entry.presets.push(newPreset);
      }

      await updatePlaylist(playlist);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const isCreatingNewPlaylist = !selectedPlaylistId;
  const hasSongs = selectedPlaylist && selectedPlaylist.entries.length > 0;

  const inputStyle = {
    background: 'var(--bg-deep)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-subtle)',
  } as React.CSSProperties;

  const labelStyle = { color: 'var(--text-secondary)' } as React.CSSProperties;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-md rounded-lg p-6"
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.6)',
        }}
      >
        {/* Header */}
        <h2
          className="font-mono-display text-lg font-bold tracking-tight mb-1"
          style={{ color: 'var(--text-primary)' }}
        >
          {t('addPreset')}
        </h2>
        <p className="mb-4 font-mono-display text-sm" style={{ color: 'var(--accent-amber)' }}>
          {presetName}
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Playlist selector */}
          <div>
            <label
              className="mb-1 block font-mono-display text-sm"
              htmlFor="add-playlist-select"
              style={labelStyle}
            >
              {t('title')}
            </label>
            {loading ? (
              <div className="font-mono-display text-sm" style={{ color: 'var(--text-secondary)' }}>
                …
              </div>
            ) : (
              <select
                id="add-playlist-select"
                value={selectedPlaylistId}
                onChange={(e) => setSelectedPlaylistId(e.target.value)}
                className="w-full rounded-lg px-3 py-2 font-mono-display text-sm focus:outline-none"
                style={inputStyle}
              >
                <option value="">{t('create')}…</option>
                {playlists.map((pl) => (
                  <option key={pl.id} value={pl.id}>
                    {pl.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* New playlist name input */}
          {isCreatingNewPlaylist && (
            <div>
              <label
                className="mb-1 block font-mono-display text-sm"
                htmlFor="add-playlist-name"
                style={labelStyle}
              >
                {t('name')}
              </label>
              <input
                id="add-playlist-name"
                type="text"
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                placeholder={t('namePlaceholder')}
                maxLength={100}
                autoFocus
                className="w-full rounded-lg px-3 py-2 font-mono-display text-sm focus:outline-none"
                style={inputStyle}
              />
            </div>
          )}

          {/* Song selector (only when an existing playlist is selected) */}
          {!isCreatingNewPlaylist && (
            <div>
              <label
                className="mb-1 block font-mono-display text-sm"
                htmlFor="add-song-select"
                style={labelStyle}
              >
                {t('songName')}
              </label>
              <select
                id="add-song-select"
                value={selectedSongId}
                onChange={(e) => setSelectedSongId(e.target.value)}
                className="w-full rounded-lg px-3 py-2 font-mono-display text-sm focus:outline-none"
                style={inputStyle}
              >
                <option value="new">{t('addSong')}…</option>
                {hasSongs &&
                  selectedPlaylist.entries.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.songName}
                    </option>
                  ))}
              </select>
            </div>
          )}

          {/* New song name input */}
          {(isCreatingNewPlaylist || selectedSongId === 'new') && (
            <div>
              <label
                className="mb-1 block font-mono-display text-sm"
                htmlFor="add-song-name"
                style={labelStyle}
              >
                {t('songName')}
              </label>
              <input
                id="add-song-name"
                type="text"
                value={songName}
                onChange={(e) => setSongName(e.target.value)}
                placeholder={t('songNamePlaceholder')}
                maxLength={200}
                className="w-full rounded-lg px-3 py-2 font-mono-display text-sm focus:outline-none"
                style={inputStyle}
              />
            </div>
          )}

          {/* Preset label */}
          <div>
            <label
              className="mb-1 block font-mono-display text-sm"
              htmlFor="add-preset-label"
              style={labelStyle}
            >
              {t('presetLabel')}
            </label>
            <input
              id="add-preset-label"
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={t('presetLabelPlaceholder')}
              maxLength={100}
              className="w-full rounded-lg px-3 py-2 font-mono-display text-sm focus:outline-none"
              style={inputStyle}
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-3 mt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 font-mono-display text-sm font-bold tracking-wider uppercase rounded py-2.5 transition-all duration-150 disabled:opacity-50"
              style={{
                background: 'var(--accent-amber)',
                color: 'var(--bg-deep)',
              }}
            >
              {saving ? '…' : t('save')}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="font-mono-display text-sm tracking-wider uppercase rounded py-2.5 px-4"
              style={{
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)',
                background: 'transparent',
              }}
            >
              ✕
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
