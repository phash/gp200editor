'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { usePlaylist } from '@/hooks/usePlaylist';
import { usePlaylistPlayer } from '@/hooks/usePlaylistPlayer';
import { useTimelinePlayer } from '@/hooks/useTimelinePlayer';
import { useMidiDeviceContext } from '@/contexts/MidiDeviceContext';
import { YouTubeEmbed } from '@/components/YouTubeEmbed';
import { CuePointTable } from '@/components/CuePointTable';
import { DeviceSlotBrowser } from '@/components/DeviceSlotBrowser';
// Slot-based: presets live on device, no PRSTDecoder needed for playback
import { SysExCodec } from '@/core/SysExCodec';
import { FirmwareCompatDialog } from '@/components/FirmwareCompatDialog';
import { HelpButton } from '@/components/HelpButton';
// Firmware compat uses version check (sub=0x0A) result, not string matching
import { openPlaylistDb, updatePlaylist as dbUpdatePlaylist } from '@/lib/playlistDb';
import type { Playlist, CuePoint } from '@/lib/playlistDb';

type View = { type: 'overview' } | { type: 'edit'; id: string } | { type: 'play'; id: string };

interface PlaylistPlayerProps {
  playlistId: string;
  onNavigate: (view: View) => void;
}

// Push status removed — slot-based playback uses sendSlotChange only

export function PlaylistPlayer({ playlistId, onNavigate }: PlaylistPlayerProps) {
  const t = useTranslations('playlists');
  const { getPlaylist } = usePlaylist();
  const midiDevice = useMidiDeviceContext();

  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [firmwareDismissed, setFirmwareDismissed] = useState(false);
  const [showSlotBrowser, setShowSlotBrowser] = useState(false);
  const [countIn, setCountIn] = useState<number | null>(null); // 3, 2, 1, null

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

  // Slot-based: no preset pushing needed, cue points use sendSlotChange

  // ─── Cue Points ──────────────────────────────────────────────────────────────

  const cuePoints = player.currentEntry?.cuePoints ?? [];

  const persistPlaylist = useCallback(async (updated: Playlist) => {
    setPlaylist(updated);
    const db = await openPlaylistDb();
    await dbUpdatePlaylist(db, updated);
  }, []);

  const handleAddCuePoint = useCallback(async () => {
    if (!playlist || !player.currentEntry) return;
    const slots = player.currentEntry.deviceSlots ?? [];
    const existingCues = player.currentEntry.cuePoints ?? [];
    const lastTime = existingCues.length > 0
      ? Math.max(...existingCues.map(c => c.timeSeconds)) + 10
      : 0;
    const newCp: CuePoint = {
      id: crypto.randomUUID(),
      timeSeconds: lastTime,
      action: 'preset-switch',
      slot: slots[0] ?? 0,
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

  // Slot browser: save selected device slots to current entry
  const handleSlotsConfirm = useCallback(async (slots: number[]) => {
    setShowSlotBrowser(false);
    if (!playlist || !player.currentEntry) return;
    const updated: Playlist = {
      ...playlist,
      entries: playlist.entries.map(e =>
        e.id === player.currentEntry!.id ? { ...e, deviceSlots: slots } : e
      ),
      updatedAt: Date.now(),
    };
    await persistPlaylist(updated);
  }, [playlist, player.currentEntry, persistPlaylist]);

  // Device slots for current entry
  const deviceSlots = player.currentEntry?.deviceSlots ?? [];

  const onCueFire = useCallback((cp: CuePoint) => {
    if (midiDevice.status !== 'connected') return;
    if (cp.action === 'preset-switch' && cp.slot !== undefined) {
      // Instant slot switch — preset is already on the device
      console.log(`[CUE] slot change → ${SysExCodec.slotToLabel(cp.slot)}`);
      midiDevice.sendSlotChange(cp.slot);
    } else if (cp.action === 'effect-toggle' && cp.blockIndex !== undefined) {
      midiDevice.sendToggle(cp.blockIndex, cp.enabled ?? false);
    }
  }, [midiDevice]);

  const timeline = useTimelinePlayer(cuePoints, onCueFire);

  // Count-in: 3, 2, 1, go!
  useEffect(() => {
    if (countIn === null) return;
    if (countIn <= 0) {
      setCountIn(null);
      timeline.play();
      return;
    }
    const timer = setTimeout(() => setCountIn(countIn - 1), 1000);
    return () => clearTimeout(timer);
  }, [countIn, timeline]);

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


  return (
    <main className="mx-auto max-w-3xl px-4 py-8 font-mono-display">

      {/* Navigation buttons */}
      <div className="mb-4 flex gap-2">
        <button
          onClick={() => onNavigate({ type: 'overview' })}
          className="font-mono-display text-xs font-medium uppercase tracking-wider px-3 py-1.5 rounded transition-all duration-150 border border-border-subtle text-text-secondary hover:border-accent-amber hover:text-accent-amber"
        >
          ← {t('back')}
        </button>
        <button
          onClick={() => onNavigate({ type: 'edit', id: playlistId })}
          className="font-mono-display text-xs font-medium uppercase tracking-wider px-3 py-1.5 rounded transition-all duration-150 border border-border-subtle text-text-secondary hover:border-accent-amber hover:text-accent-amber"
        >
          {t('edit')}
        </button>
      </div>

      {/* Playlist title */}
      <div className="flex items-center gap-3 mb-4">
        <h1
          className="font-mono-display text-xl font-bold tracking-tight"
          style={{ color: 'var(--accent-amber)' }}
        >
          {playlist.name}
        </h1>
        <HelpButton section="playlists" />
      </div>

      {/* MIDI Connection Banner */}
      {midiDevice.status !== 'connected' ? (
        <div
          className="mb-4 rounded-lg p-4 flex items-center gap-4"
          style={{ border: '1px solid rgba(212,162,78,0.3)', background: 'rgba(212,162,78,0.05)' }}
        >
          <div className="flex-1">
            <p className="font-mono-display text-sm font-bold" style={{ color: 'var(--accent-amber)' }}>
              GP-200 verbinden
            </p>
            <p className="font-mono-display text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              Verbinde dein Valeton GP-200 per USB um Presets live zu wechseln
            </p>
            {midiDevice.status === 'connecting' && (
              <div className="mt-2 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
                <div className="h-full rounded-full animate-pulse" style={{ width: '60%', background: 'var(--accent-amber)' }} />
              </div>
            )}
            {midiDevice.status === 'handshaking' && (
              <div className="mt-2 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
                <div className="h-full rounded-full animate-pulse" style={{ width: '85%', background: 'var(--accent-green)' }} />
              </div>
            )}
            {midiDevice.status === 'error' && midiDevice.errorMessage && (
              <p className="font-mono-display text-xs mt-1" style={{ color: 'var(--accent-red)' }}>
                {midiDevice.errorMessage}
              </p>
            )}
          </div>
          <button
            onClick={midiDevice.connect}
            disabled={midiDevice.status === 'connecting' || midiDevice.status === 'handshaking'}
            className="font-mono-display text-sm font-bold uppercase tracking-wider px-5 py-2.5 rounded transition-all disabled:opacity-50"
            style={{ border: '1px solid var(--accent-amber)', color: 'var(--accent-amber)', background: 'var(--glow-amber)' }}
          >
            {midiDevice.status === 'connecting' ? 'Verbinde...' :
             midiDevice.status === 'handshaking' ? 'Handshake...' :
             'Verbinden'}
          </button>
        </div>
      ) : (
        <div
          className="mb-4 rounded-lg px-4 py-2 flex items-center gap-3"
          style={{ border: '1px solid rgba(74,222,128,0.25)', background: 'rgba(74,222,128,0.04)' }}
        >
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-green)', boxShadow: '0 0 6px var(--accent-green)' }} />
          <span className="font-mono-display text-xs" style={{ color: 'var(--accent-green)' }}>
            {midiDevice.deviceName ?? 'GP-200'}
          </span>
        </div>
      )}

      {/* Device Slot Chips — selected slots from device */}
      {currentEntry && deviceSlots.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {deviceSlots.map((slot) => (
            <span
              key={slot}
              className="font-mono-display text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded"
              style={{ border: '1px solid var(--accent-amber)', color: 'var(--accent-amber)', background: 'var(--glow-amber)' }}
            >
              {SysExCodec.slotToLabel(slot)}
              {midiDevice.presetNames[slot] ? ` — ${midiDevice.presetNames[slot]}` : ''}
            </span>
          ))}
          <button
            onClick={() => setShowSlotBrowser(true)}
            disabled={midiDevice.status !== 'connected'}
            className="font-mono-display text-xs font-bold px-3 py-1.5 rounded disabled:opacity-30"
            style={{ border: '1px solid var(--border-active)', color: 'var(--text-muted)' }}
          >
            + Slots
          </button>
        </div>
      )}

      {/* Initial slot selection prompt */}
      {currentEntry && deviceSlots.length === 0 && midiDevice.status === 'connected' && (
        <button
          onClick={() => {
            setShowSlotBrowser(true);
            if (midiDevice.namesLoadProgress < 256) {
              midiDevice.loadPresetNames();
            }
          }}
          className="mb-4 w-full rounded-lg p-4 font-mono-display text-sm font-bold transition-all"
          style={{ border: '2px dashed var(--accent-amber)', color: 'var(--accent-amber)', background: 'rgba(212,162,78,0.05)' }}
        >
          Slots vom GP-200 auswählen
        </button>
      )}

      {/* YouTube player */}
      {currentEntry && (
        <div className="mb-4">
          <YouTubeEmbed
            url={currentEntry.youtubeUrl}
            songName={currentEntry.songName}
          />
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
              {countIn !== null && (
                <span className="font-mono-display text-2xl font-bold tabular-nums animate-pulse mr-2" style={{ color: 'var(--accent-amber)' }}>
                  {countIn}
                </span>
              )}
              {timeline.state !== 'playing' && countIn === null ? (
                <>
                  <button
                    onClick={() => setCountIn(3)}
                    className="font-mono-display text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded"
                    style={{ border: '1px solid var(--accent-amber)', color: 'var(--accent-amber)' }}
                  >
                    3…2…1
                  </button>
                  <button
                    onClick={timeline.play}
                    className="font-mono-display text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded"
                    style={{ border: '1px solid var(--accent-green)', color: 'var(--accent-green)' }}
                  >
                    {t('timelinePlay')}
                  </button>
                </>
              ) : timeline.state === 'playing' ? (
                <button
                  onClick={timeline.pause}
                  className="font-mono-display text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded"
                  style={{ border: '1px solid var(--accent-amber)', color: 'var(--accent-amber)' }}
                >
                  {t('timelinePause')}
                </button>
              ) : null}
              <button
                onClick={timeline.stop}
                disabled={timeline.state === 'stopped'}
                className="font-mono-display text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded disabled:opacity-30"
                style={{ border: '1px solid var(--border-active)', color: 'var(--text-muted)' }}
              >
                {t('timelineStop')}
              </button>
              {timeline.state !== 'stopped' && (() => {
                const elapsed = timeline.elapsedSeconds;
                const sorted = [...cuePoints].sort((a, b) => a.timeSeconds - b.timeSeconds);
                const nextCp = sorted.find(cp => !timeline.firedIds.has(cp.id));
                const nextIn = nextCp ? Math.max(0, nextCp.timeSeconds - elapsed) : null;
                const nextLabel = nextCp?.action === 'preset-switch' && nextCp.slot !== undefined
                  ? `${SysExCodec.slotToLabel(nextCp.slot)}${midiDevice.presetNames[nextCp.slot] ? ` ${midiDevice.presetNames[nextCp.slot]}` : ''}`
                  : nextCp?.action === 'effect-toggle'
                    ? `${['PRE','WAH','DST','AMP','NR','CAB','EQ','MOD','DLY','RVB','VOL'][nextCp.blockIndex ?? 0]} ${nextCp.enabled ? 'AN' : 'AUS'}`
                    : '?';
                return (
                  <div className="flex items-center gap-3 ml-2">
                    <span className="font-mono-display text-sm font-bold tabular-nums" style={{ color: 'var(--accent-amber)' }}>
                      {Math.floor(elapsed / 60)}:{String(Math.floor(elapsed % 60)).padStart(2, '0')}
                    </span>
                    {nextCp && nextIn !== null && (
                      <span className="font-mono-display text-xs" style={{ color: 'var(--text-muted)' }}>
                        → {nextLabel} in {Math.ceil(nextIn)}s
                      </span>
                    )}
                    {!nextCp && (
                      <span className="font-mono-display text-xs" style={{ color: 'var(--accent-green)' }}>✓</span>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
          <CuePointTable
            cuePoints={cuePoints}
            deviceSlots={deviceSlots}
            presetNames={midiDevice.presetNames}
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
                  className="px-3 py-2 rounded cursor-pointer transition-all duration-150 hover:bg-bg-surface"
                  style={{
                    background: isActive ? 'var(--bg-surface)' : 'transparent',
                    borderLeft: isActive
                      ? '3px solid var(--accent-amber)'
                      : '3px solid transparent',
                    color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
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

      </div>

      {/* Device status is shown in the top banner — no duplicate here */}

      {showSlotBrowser && (
        <DeviceSlotBrowser
          mode="multiselect"
          presetNames={midiDevice.presetNames}
          namesLoadProgress={midiDevice.namesLoadProgress}
          currentSlot={midiDevice.currentSlot}
          initialSelected={deviceSlots}
          onConfirm={() => {}} // unused in multiselect
          onConfirmMulti={handleSlotsConfirm}
          onCancel={() => setShowSlotBrowser(false)}
        />
      )}

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
