'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { usePlaylist } from '@/hooks/usePlaylist';
import { usePlaylistPlayer } from '@/hooks/usePlaylistPlayer';
import { useTimelinePlayer } from '@/hooks/useTimelinePlayer';
import { useMidiDeviceContext } from '@/contexts/MidiDeviceContext';
import { YouTubeEmbed } from '@/components/YouTubeEmbed';
import { CuePointTable } from '@/components/CuePointTable';
import { PRSTDecoder } from '@/core/PRSTDecoder';
import { FirmwareCompatDialog } from '@/components/FirmwareCompatDialog';
// Firmware compat uses version check (sub=0x0A) result, not string matching
import { openPlaylistDb, updatePlaylist as dbUpdatePlaylist } from '@/lib/playlistDb';
import type { Playlist, CuePoint } from '@/lib/playlistDb';

type View = { type: 'overview' } | { type: 'edit'; id: string } | { type: 'play'; id: string };

interface PlaylistPlayerProps {
  playlistId: string;
  onNavigate: (view: View) => void;
}

type PushStatus = 'idle' | 'pushing' | 'success' | 'error';

export function PlaylistPlayer({ playlistId, onNavigate }: PlaylistPlayerProps) {
  const t = useTranslations('playlists');
  const tDevice = useTranslations('device');
  const { getPlaylist } = usePlaylist();
  const midiDevice = useMidiDeviceContext();

  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [pushStatus, setPushStatus] = useState<PushStatus>('idle');
  const [firmwareDismissed, setFirmwareDismissed] = useState(false);

  const firmwareOk = midiDevice.deviceInfo?.versionAccepted ?? false;
  const firmwareVersionStr = midiDevice.deviceInfo
    ? (midiDevice.deviceInfo.firmwareValues.length > 0
        ? midiDevice.deviceInfo.firmwareValues.join('.')
        : '')
    : '';
  const showFirmwareDialog = midiDevice.status === 'connected' && midiDevice.deviceInfo !== null && !firmwareOk && !firmwareDismissed;

  // Load playlist from IndexedDB on mount
  useEffect(() => {
    getPlaylist(playlistId).then((p) => setPlaylist(p ?? null));
  }, [playlistId, getPlaylist]);

  const player = usePlaylistPlayer(playlist);

  const pushCurrentPreset = useCallback(async () => {
    const preset = player.currentPreset;
    if (!preset || midiDevice.status !== 'connected' || midiDevice.currentSlot === null) return;
    setPushStatus('pushing');
    try {
      const bytes = new Uint8Array(preset.binary);
      const decoder = new PRSTDecoder(bytes);
      const decoded = decoder.decode();
      await midiDevice.pushPreset(decoded, midiDevice.currentSlot);
      setPushStatus('success');
      setTimeout(() => setPushStatus('idle'), 2000);
    } catch {
      setPushStatus('error');
      setTimeout(() => setPushStatus('idle'), 3000);
    }
  }, [player.currentPreset, midiDevice]);

  // Auto-push on song/preset change
  useEffect(() => {
    if (player.currentPreset && midiDevice.status === 'connected') {
      pushCurrentPreset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player.currentSongIndex, player.currentPresetIndex]);

  // ─── Cue Points ──────────────────────────────────────────────────────────────

  const cuePoints = player.currentEntry?.cuePoints ?? [];

  const persistPlaylist = useCallback(async (updated: Playlist) => {
    setPlaylist(updated);
    const db = await openPlaylistDb();
    await dbUpdatePlaylist(db, updated);
  }, []);

  const handleAddCuePoint = useCallback(async () => {
    if (!playlist || !player.currentEntry) return;
    const newCp: CuePoint = {
      id: crypto.randomUUID(),
      timeSeconds: 0,
      action: 'preset-switch',
      slot: 0,
    };
    const updated: Playlist = {
      ...playlist,
      entries: playlist.entries.map(e =>
        e.id === player.currentEntry!.id
          ? { ...e, cuePoints: [...(e.cuePoints ?? []), newCp] }
          : e
      ),
      updatedAt: Date.now(),
    };
    await persistPlaylist(updated);
  }, [playlist, player.currentEntry, persistPlaylist]);

  const handleUpdateCuePoint = useCallback(async (id: string, patch: Partial<CuePoint>) => {
    if (!playlist || !player.currentEntry) return;
    const updated: Playlist = {
      ...playlist,
      entries: playlist.entries.map(e =>
        e.id === player.currentEntry!.id
          ? {
              ...e,
              cuePoints: (e.cuePoints ?? []).map(cp =>
                cp.id === id ? { ...cp, ...patch } : cp
              ),
            }
          : e
      ),
      updatedAt: Date.now(),
    };
    await persistPlaylist(updated);
  }, [playlist, player.currentEntry, persistPlaylist]);

  const handleDeleteCuePoint = useCallback(async (id: string) => {
    if (!playlist || !player.currentEntry) return;
    const updated: Playlist = {
      ...playlist,
      entries: playlist.entries.map(e =>
        e.id === player.currentEntry!.id
          ? { ...e, cuePoints: (e.cuePoints ?? []).filter(cp => cp.id !== id) }
          : e
      ),
      updatedAt: Date.now(),
    };
    await persistPlaylist(updated);
  }, [playlist, player.currentEntry, persistPlaylist]);

  const onCueFire = useCallback(async (cp: CuePoint) => {
    if (midiDevice.status !== 'connected') return;
    if (cp.action === 'preset-switch') {
      // Prefer presetId (from playlist), fallback to raw slot number
      const entry = player.currentEntry;
      if (cp.presetId && entry) {
        const preset = entry.presets.find(p => p.id === cp.presetId);
        if (preset && midiDevice.currentSlot !== null) {
          try {
            const bytes = new Uint8Array(preset.binary);
            const decoded = new PRSTDecoder(bytes).decode();
            await midiDevice.pushPreset(decoded, midiDevice.currentSlot);
          } catch { /* push failed, skip */ }
        }
      } else if (cp.slot !== undefined) {
        midiDevice.sendSlotChange(cp.slot);
      }
    } else if (cp.action === 'effect-toggle' && cp.blockIndex !== undefined) {
      midiDevice.sendToggle(cp.blockIndex, cp.enabled ?? false);
    }
  }, [midiDevice, player]);

  const timeline = useTimelinePlayer(cuePoints, onCueFire);

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      ) {
        return;
      }
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          player.prevSong();
          break;
        case 'ArrowDown':
          e.preventDefault();
          player.nextSong();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          player.prevPreset();
          break;
        case 'ArrowRight':
          e.preventDefault();
          player.nextPreset();
          break;
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [player]);

  // Loading state
  if (!playlist) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="flex items-center gap-3 py-8" style={{ color: 'var(--text-secondary)' }}>
          <span
            className="inline-block w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin"
            aria-hidden="true"
          />
          <span className="font-mono-display text-sm">…</span>
        </div>
      </main>
    );
  }

  const entries = playlist.entries;
  const currentEntry = player.currentEntry;
  const currentPresets = currentEntry?.presets ?? [];

  const pushStatusText =
    pushStatus === 'pushing'
      ? t('pushing')
      : pushStatus === 'success'
        ? t('pushSuccess')
        : pushStatus === 'error'
          ? t('pushError')
          : '';

  const ledColor =
    midiDevice.status === 'connected' ? 'var(--accent-green)' : '#555';

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 font-mono-display">
      {/* Accessibility: live region for push status */}
      <div aria-live="polite" className="sr-only">
        {pushStatusText}
      </div>

      {/* Back button */}
      <div className="mb-4">
        <button
          onClick={() => onNavigate({ type: 'overview' })}
          className="font-mono-display text-xs font-medium uppercase tracking-wider px-3 py-1.5 rounded transition-all duration-150"
          style={{
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-secondary)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--accent-amber)';
            e.currentTarget.style.color = 'var(--accent-amber)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-subtle)';
            e.currentTarget.style.color = 'var(--text-secondary)';
          }}
        >
          ← {t('back')}
        </button>
      </div>

      {/* Playlist title */}
      <h1
        className="font-mono-display text-xl font-bold tracking-tight mb-4"
        style={{ color: 'var(--accent-amber)' }}
      >
        {playlist.name}
      </h1>

      {/* YouTube player */}
      {currentEntry && (
        <div className="mb-4">
          <YouTubeEmbed
            url={currentEntry.youtubeUrl}
            songName={currentEntry.songName}
          />
        </div>
      )}

      {/* Preset chips */}
      {currentEntry && currentPresets.length > 0 && (
        <div
          role="tablist"
          aria-label={currentEntry.songName}
          className="flex flex-wrap gap-2 mb-6"
        >
          {currentPresets.map((preset, idx) => {
            const isActive = idx === player.currentPresetIndex;
            return (
              <button
                key={preset.id}
                role="tab"
                aria-selected={isActive}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/preset-id', preset.id);
                  e.dataTransfer.effectAllowed = 'copy';
                }}
                onClick={() => {
                  player.goToPreset(idx);
                  pushCurrentPreset();
                }}
                className="font-mono-display text-xs font-bold uppercase tracking-wider px-4 py-2 rounded transition-all duration-150 cursor-grab active:cursor-grabbing"
                style={{
                  background: isActive ? 'var(--accent-amber)' : 'transparent',
                  color: isActive ? 'var(--bg-deep)' : 'var(--text-secondary)',
                  border: isActive ? 'none' : '1px solid var(--border-subtle)',
                  animation: isActive && pushStatus === 'pushing' ? 'pulse 1s infinite' : 'none',
                }}
              >
                {preset.label || preset.presetName}
              </button>
            );
          })}
        </div>
      )}

      {/* Timeline controls + Cue Point Table */}
      {currentEntry && (
        <div className="mb-6">
          {/* Play/Pause/Stop + timer */}
          <div className="flex items-center gap-3 mb-3">
            <h3 className="font-mono-display text-sm font-bold" style={{ color: 'var(--text-secondary)' }}>
              {t('cuePoints')}
            </h3>
            <div className="flex gap-1 ml-auto">
              {timeline.state !== 'playing' ? (
                <button
                  onClick={timeline.play}
                  className="font-mono-display text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded"
                  style={{ border: '1px solid var(--accent-green)', color: 'var(--accent-green)' }}
                >
                  {t('timelinePlay')}
                </button>
              ) : (
                <button
                  onClick={timeline.pause}
                  className="font-mono-display text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded"
                  style={{ border: '1px solid var(--accent-amber)', color: 'var(--accent-amber)' }}
                >
                  {t('timelinePause')}
                </button>
              )}
              <button
                onClick={timeline.stop}
                disabled={timeline.state === 'stopped'}
                className="font-mono-display text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded disabled:opacity-30"
                style={{ border: '1px solid var(--border-active)', color: 'var(--text-muted)' }}
              >
                {t('timelineStop')}
              </button>
              {timeline.state !== 'stopped' && (
                <span className="font-mono-display text-xs ml-2" style={{ color: 'var(--text-muted)' }}>
                  {Math.floor(timeline.elapsedSeconds / 60)}:{String(Math.floor(timeline.elapsedSeconds % 60)).padStart(2, '0')}
                </span>
              )}
            </div>
          </div>
          <CuePointTable
            cuePoints={cuePoints}
            presets={currentPresets}
            onAdd={handleAddCuePoint}
            onUpdate={handleUpdateCuePoint}
            onDelete={handleDeleteCuePoint}
            elapsedSeconds={timeline.elapsedSeconds}
            firedIds={timeline.firedIds}
            isPlaying={timeline.state === 'playing'}
          />
        </div>
      )}

      {/* Two-column layout: song list + push status */}
      <div className="flex gap-6">
        {/* Song list */}
        <div className="flex-1 min-w-0">
          <ul
            role="listbox"
            aria-label={playlist.name}
            className="space-y-1"
          >
            {entries.map((entry, idx) => {
              const isActive = idx === player.currentSongIndex;
              return (
                <li
                  key={entry.id}
                  role="option"
                  aria-selected={isActive}
                  onClick={() => player.goToSong(idx)}
                  className="px-3 py-2 rounded cursor-pointer transition-all duration-150"
                  style={{
                    background: isActive ? 'var(--bg-surface)' : 'transparent',
                    borderLeft: isActive
                      ? '3px solid var(--accent-amber)'
                      : '3px solid transparent',
                    color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      (e.currentTarget as HTMLElement).style.background = 'var(--bg-surface)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      (e.currentTarget as HTMLElement).style.background = 'transparent';
                    }
                  }}
                >
                  <span className="font-mono-display text-sm font-medium">
                    {idx + 1}. {entry.songName}
                  </span>
                  {entry.presets.length > 0 && (
                    <span
                      className="ml-2 text-xs"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      ({entry.presets.length})
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        {/* Push status indicator */}
        {pushStatus !== 'idle' && (
          <div
            className="shrink-0 flex items-start pt-1"
            style={{ color: pushStatus === 'success' ? 'var(--accent-green)' : pushStatus === 'error' ? 'var(--accent-red)' : 'var(--accent-amber)' }}
          >
            <span className="font-mono-display text-sm font-bold">
              {pushStatus === 'success' && '✓'}
              {pushStatus === 'error' && '✗'}
              {pushStatus === 'pushing' && '…'}
            </span>
          </div>
        )}
      </div>

      {/* Mini device status bar */}
      <div
        className="mt-8 flex items-center gap-3 px-3 py-2 rounded-lg text-sm"
        style={{
          border: `1px solid ${midiDevice.status === 'connected' ? 'rgba(74,222,128,0.25)' : 'rgba(255,255,255,0.08)'}`,
          background: midiDevice.status === 'connected' ? 'rgba(74,222,128,0.04)' : 'rgba(255,255,255,0.02)',
        }}
      >
        {/* LED */}
        <span
          aria-hidden="true"
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            flexShrink: 0,
            background: ledColor,
            boxShadow: midiDevice.status === 'connected' ? `0 0 6px ${ledColor}` : 'none',
          }}
        />

        {midiDevice.status === 'connected' ? (
          <span className="font-mono-display text-xs" style={{ color: 'var(--accent-green)' }}>
            {midiDevice.deviceName ?? 'GP-200'}
          </span>
        ) : (
          <>
            <span className="font-mono-display text-xs" style={{ color: 'var(--text-muted)' }}>
              {t('noDevice')}
            </span>
            <button
              onClick={midiDevice.connect}
              className="ml-auto font-mono-display text-xs font-bold uppercase px-3 py-1 rounded"
              style={{
                border: '1px solid rgba(212,162,78,0.4)',
                color: 'var(--accent-amber)',
                background: 'transparent',
              }}
            >
              {tDevice('connect')}
            </button>
          </>
        )}
      </div>

      {showFirmwareDialog && (
        <FirmwareCompatDialog
          detectedVersion={firmwareVersionStr}
          onContinue={() => setFirmwareDismissed(true)}
          onDisconnect={() => { midiDevice.disconnect(); setFirmwareDismissed(false); }}
        />
      )}
    </main>
  );
}
