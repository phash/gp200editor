'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { usePlaylist } from '@/hooks/usePlaylist';
import { PRSTDecoder } from '@/core/PRSTDecoder';
import type { Playlist, PlaylistEntry, PlaylistPreset } from '@/lib/playlistDb';

type View = { type: 'overview' } | { type: 'edit'; id: string } | { type: 'play'; id: string };

interface PlaylistEditorProps {
  playlistId: string;
  onNavigate: (view: View) => void;
}

export function PlaylistEditor({ playlistId, onNavigate }: PlaylistEditorProps) {
  const t = useTranslations('playlists');
  const { getPlaylist, updatePlaylist } = usePlaylist();
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [saving, setSaving] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  useEffect(() => {
    getPlaylist(playlistId).then(pl => pl && setPlaylist(pl));
  }, [playlistId, getPlaylist]);

  function addSong() {
    if (!playlist) return;
    setPlaylist({
      ...playlist,
      entries: [
        ...playlist.entries,
        {
          id: crypto.randomUUID(),
          songName: '',
          presets: [],
        },
      ],
    });
  }

  function updateEntry(index: number, patch: Partial<PlaylistEntry>) {
    if (!playlist) return;
    const entries = [...playlist.entries];
    entries[index] = { ...entries[index], ...patch };
    setPlaylist({ ...playlist, entries });
  }

  function removeEntry(index: number) {
    if (!playlist) return;
    setPlaylist({
      ...playlist,
      entries: playlist.entries.filter((_, i) => i !== index),
    });
  }

  // Drag & Drop
  function handleDragStart(index: number) {
    setDragIndex(index);
  }
  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    setDragOverIndex(index);
  }
  function handleDrop(index: number) {
    if (!playlist || dragIndex === null || dragIndex === index) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }
    const entries = [...playlist.entries];
    const [moved] = entries.splice(dragIndex, 1);
    entries.splice(index, 0, moved);
    setPlaylist({ ...playlist, entries });
    setDragIndex(null);
    setDragOverIndex(null);
  }

  async function handlePresetUpload(entryIndex: number, file: File) {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    if (bytes.length !== 1224) return;
    const decoder = new PRSTDecoder(bytes);
    if (!decoder.hasMagic()) return;
    const decoded = decoder.decode();
    const newPreset: PlaylistPreset = {
      id: crypto.randomUUID(),
      label: decoded.patchName,
      presetName: decoded.patchName,
      binary: buffer.slice(0, 1224),
    };
    const entries = [...playlist!.entries];
    entries[entryIndex] = {
      ...entries[entryIndex],
      presets: [...entries[entryIndex].presets, newPreset],
    };
    setPlaylist({ ...playlist!, entries });
  }

  function removePreset(entryIndex: number, presetIndex: number) {
    if (!playlist) return;
    const entries = [...playlist.entries];
    entries[entryIndex] = {
      ...entries[entryIndex],
      presets: entries[entryIndex].presets.filter((_, i) => i !== presetIndex),
    };
    setPlaylist({ ...playlist, entries });
  }

  async function handleSave() {
    if (!playlist) return;
    setSaving(true);
    await updatePlaylist(playlist);
    setSaving(false);
    onNavigate({ type: 'overview' });
  }

  if (!playlist) return null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 font-mono-display">
      {/* Back button */}
      <button
        onClick={() => onNavigate({ type: 'overview' })}
        className="mb-6 flex items-center gap-2 text-sm transition-opacity hover:opacity-70"
        style={{ color: 'var(--text-secondary)' }}
      >
        ← {t('back')}
      </button>

      {/* Playlist name input */}
      <input
        type="text"
        value={playlist.name}
        onChange={e => setPlaylist({ ...playlist, name: e.target.value })}
        placeholder={t('namePlaceholder')}
        className="mb-8 w-full rounded border px-3 py-2 text-lg font-semibold focus:outline-none"
        style={{
          background: 'var(--bg-surface)',
          borderColor: 'var(--border-subtle)',
          color: 'var(--text-primary)',
        }}
      />

      {/* Song entries list */}
      <div className="flex flex-col gap-4">
        {playlist.entries.map((entry, entryIndex) => (
          <div
            key={entry.id}
            draggable
            onDragStart={() => handleDragStart(entryIndex)}
            onDragOver={e => handleDragOver(e, entryIndex)}
            onDrop={() => handleDrop(entryIndex)}
            onDragEnd={() => { setDragIndex(null); setDragOverIndex(null); }}
            className="rounded border p-4 transition-shadow"
            style={{
              background: 'var(--bg-surface)',
              borderColor:
                dragOverIndex === entryIndex && dragIndex !== entryIndex
                  ? 'var(--accent-amber)'
                  : 'var(--border-subtle)',
              opacity: dragIndex === entryIndex ? 0.5 : 1,
            }}
          >
            {/* Song header row: drag handle, name input, remove button */}
            <div className="mb-3 flex items-center gap-2">
              <span
                className="cursor-grab select-none text-lg"
                style={{ color: 'var(--text-secondary)' }}
                title="Drag to reorder"
              >
                ☰
              </span>
              <input
                type="text"
                value={entry.songName}
                onChange={e => updateEntry(entryIndex, { songName: e.target.value })}
                placeholder={t('songNamePlaceholder')}
                className="min-w-0 flex-1 rounded border px-2 py-1 text-sm focus:outline-none"
                style={{
                  background: 'var(--bg-deep)',
                  borderColor: 'var(--border-subtle)',
                  color: 'var(--text-primary)',
                }}
              />
              <button
                onClick={() => removeEntry(entryIndex)}
                className="shrink-0 rounded px-2 py-1 text-xs transition-opacity hover:opacity-70"
                style={{
                  background: 'var(--bg-deep)',
                  color: 'var(--text-secondary)',
                  borderColor: 'var(--border-subtle)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                {t('removeSong')}
              </button>
            </div>

            {/* YouTube URL input */}
            <input
              type="url"
              value={entry.youtubeUrl ?? ''}
              onChange={e => updateEntry(entryIndex, { youtubeUrl: e.target.value || undefined })}
              placeholder={t('youtubeUrlPlaceholder')}
              className="mb-3 w-full rounded border px-2 py-1 text-sm focus:outline-none"
              style={{
                background: 'var(--bg-deep)',
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-primary)',
              }}
            />

            {/* Preset chips */}
            <div className="flex flex-wrap items-center gap-2">
              {entry.presets.map((preset, presetIndex) => (
                <span
                  key={preset.id}
                  className="flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold"
                  style={{
                    background: 'var(--accent-amber)',
                    color: 'var(--bg-deep)',
                  }}
                >
                  {preset.label}
                  <button
                    onClick={() => removePreset(entryIndex, presetIndex)}
                    className="ml-1 leading-none transition-opacity hover:opacity-70"
                    aria-label={t('removePreset')}
                  >
                    ×
                  </button>
                </span>
              ))}

              {/* Add Preset file input */}
              <label
                className="cursor-pointer rounded px-2 py-1 text-xs transition-opacity hover:opacity-70"
                style={{
                  border: '1px solid var(--accent-amber)',
                  color: 'var(--accent-amber)',
                }}
              >
                + {t('addPreset')}
                <input
                  type="file"
                  accept=".prst"
                  className="sr-only"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) {
                      handlePresetUpload(entryIndex, file);
                      e.target.value = '';
                    }
                  }}
                />
              </label>
            </div>
          </div>
        ))}
      </div>

      {/* Bottom action bar */}
      <div className="mt-6 flex items-center gap-3">
        <button
          onClick={addSong}
          className="rounded px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-80"
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-primary)',
          }}
        >
          + {t('addSong')}
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="ml-auto rounded px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-80 disabled:opacity-50"
          style={{
            background: 'var(--accent-amber)',
            color: 'var(--bg-deep)',
          }}
        >
          {saving ? '…' : t('save')}
        </button>
      </div>
    </div>
  );
}
