'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { CuePoint } from '@/lib/playlistDb';
import { SysExCodec } from '@/core/SysExCodec';

const BLOCK_NAMES = ['PRE', 'WAH', 'DST', 'AMP', 'NR', 'CAB', 'EQ', 'MOD', 'DLY', 'RVB', 'VOL'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Formats seconds into "M:SS" (e.g. 90 → "1:30") */
export function formatTime(s: number): string {
  const mins = Math.floor(s / 60);
  const secs = Math.floor(s % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/** Parses a time string back to seconds. Handles "1:30", "90", "0:05". */
export function parseTime(str: string): number {
  const trimmed = str.trim();
  if (trimmed.includes(':')) {
    const [minPart, secPart] = trimmed.split(':');
    const mins = parseInt(minPart, 10) || 0;
    const secs = parseInt(secPart, 10) || 0;
    return mins * 60 + secs;
  }
  const val = parseInt(trimmed, 10);
  return Number.isNaN(val) ? 0 : val;
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface CuePointTableProps {
  cuePoints: CuePoint[];
  deviceSlots: number[];          // selected GP-200 device slots
  presetNames: (string | null)[]; // device preset names (256 slots)
  onAdd: () => void;
  onUpdate: (id: string, patch: Partial<CuePoint>) => void;
  onDelete: (id: string) => void;
  elapsedSeconds: number;
  firedIds: Set<string>;
  isPlaying: boolean;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function CuePointTable({
  cuePoints,
  deviceSlots,
  presetNames,
  onAdd,
  onUpdate,
  onDelete,
  elapsedSeconds: _elapsedSeconds,
  firedIds,
  isPlaying,
}: CuePointTableProps) {
  const t = useTranslations('playlists');

  // Sort by timeSeconds for display
  const sorted = useMemo(
    () => [...cuePoints].sort((a, b) => a.timeSeconds - b.timeSeconds),
    [cuePoints],
  );

  // Active = last fired cue point (the one currently in effect)
  const activeCpId = useMemo(() => {
    if (!isPlaying) return null;
    const fired = sorted.filter((cp) => firedIds.has(cp.id));
    return fired.length > 0 ? fired[fired.length - 1].id : null;
  }, [sorted, firedIds, isPlaying]);

  // Upcoming = next unfired cue point is <5s away
  const upcomingId = useMemo(() => {
    if (!isPlaying) return null;
    const next = sorted.find((cp) => !firedIds.has(cp.id));
    if (!next) return null;
    return (next.timeSeconds - _elapsedSeconds) <= 5 ? next.id : null;
  }, [sorted, firedIds, isPlaying, _elapsedSeconds]);

  return (
    <div className="font-mono-display">
      {/* Header */}
      <div className="mb-2 flex items-center gap-2">
        <h3
          className="text-sm font-semibold"
          style={{ color: 'var(--text-primary)' }}
        >
          {t('cuePoints')}
        </h3>
      </div>

      {/* Table */}
      {sorted.length > 0 && (
        <div
          className="overflow-hidden rounded-lg"
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          {/* Table header */}
          <div
            className="grid grid-cols-[80px_1fr_1fr_32px] gap-2 px-3 py-2"
            style={{ borderBottom: '1px solid var(--border-subtle)' }}
          >
            <span
              className="text-[11px] uppercase tracking-wider"
              style={{ color: 'var(--text-muted)' }}
            >
              {t('timeLabel')}
            </span>
            <span
              className="text-[11px] uppercase tracking-wider"
              style={{ color: 'var(--text-muted)' }}
            >
              {t('actionLabel')}
            </span>
            <span
              className="text-[11px] uppercase tracking-wider"
              style={{ color: 'var(--text-muted)' }}
            >
              {t('targetLabel')}
            </span>
            {/* Empty header for delete column */}
            <span />
          </div>

          {/* Rows */}
          {sorted.map((cp) => (
            <CuePointRow
              key={cp.id}
              cuePoint={cp}
              deviceSlots={deviceSlots}
              presetNames={presetNames}
              onUpdate={onUpdate}
              onDelete={onDelete}
              isActive={cp.id === activeCpId}
              isUpcoming={cp.id === upcomingId}
              isFired={firedIds.has(cp.id)}
              isPlaying={isPlaying}
            />
          ))}
        </div>
      )}

      {/* Add button */}
      <button
        onClick={onAdd}
        className="mt-2 rounded px-3 py-1.5 text-xs font-semibold transition-colors hover:opacity-80"
        style={{
          border: '1px solid var(--accent-amber)',
          color: 'var(--accent-amber)',
          background: 'transparent',
        }}
      >
        {t('addCuePoint')}
      </button>
    </div>
  );
}

// ─── Row Component ───────────────────────────────────────────────────────────

interface CuePointRowProps {
  cuePoint: CuePoint;
  deviceSlots: number[];
  presetNames: (string | null)[];
  onUpdate: (id: string, patch: Partial<CuePoint>) => void;
  onDelete: (id: string) => void;
  isActive: boolean;    // currently in effect (last fired)
  isUpcoming: boolean;  // next to fire AND <5s away
  isFired: boolean;
  isPlaying: boolean;
}

function CuePointRow({
  cuePoint,
  deviceSlots,
  presetNames,
  onUpdate,
  onDelete,
  isActive,
  isUpcoming,
  isFired: _isFired,
  isPlaying,
}: CuePointRowProps) {
  const t = useTranslations('playlists');
  const [timeInput, setTimeInput] = useState(formatTime(cuePoint.timeSeconds));

  const handleTimeBlur = () => {
    const seconds = parseTime(timeInput);
    setTimeInput(formatTime(seconds));
    if (seconds !== cuePoint.timeSeconds) {
      onUpdate(cuePoint.id, { timeSeconds: seconds });
    }
  };

  const handleActionChange = (action: CuePoint['action']) => {
    const patch: Partial<CuePoint> = { action };
    if (action === 'preset-switch') {
      // Clear effect-toggle fields, set default slot
      patch.slot = 0;
      patch.blockIndex = undefined;
      patch.enabled = undefined;
    } else {
      // Clear preset-switch fields, set default effect-toggle values
      patch.slot = undefined;
      patch.blockIndex = 0;
      patch.enabled = true;
    }
    onUpdate(cuePoint.id, patch);
  };

  return (
    <div
      className="grid grid-cols-[80px_1fr_1fr_32px] items-center gap-2 px-3 py-1.5 transition-all duration-300"
      style={{
        opacity: isPlaying && !isActive && !isUpcoming ? 0.3 : 1,
        borderLeft: isActive
          ? '3px solid var(--accent-amber)'
          : isUpcoming
            ? '3px solid rgba(212,162,78,0.4)'
            : '3px solid transparent',
        borderBottom: '1px solid var(--border-subtle)',
        background: isActive
          ? 'rgba(212,162,78,0.08)'
          : isUpcoming
            ? 'rgba(212,162,78,0.03)'
            : 'transparent',
      }}
    >
      {/* Zeit */}
      <input
        type="text"
        value={timeInput}
        onChange={(e) => setTimeInput(e.target.value)}
        onBlur={handleTimeBlur}
        className="w-full rounded px-1.5 py-0.5 text-xs font-mono-display"
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-active)',
          color: 'var(--text-primary)',
        }}
        aria-label={t('timeLabel')}
      />

      {/* Aktion */}
      <select
        value={cuePoint.action}
        onChange={(e) => handleActionChange(e.target.value as CuePoint['action'])}
        className="w-full rounded px-1.5 py-0.5 text-xs font-mono-display"
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-active)',
          color: 'var(--text-primary)',
        }}
        aria-label={t('actionLabel')}
      >
        <option value="preset-switch">{t('presetSwitch')}</option>
        <option value="effect-toggle">{t('effectToggle')}</option>
      </select>

      {/* Ziel */}
      {cuePoint.action === 'preset-switch' ? (
        <PresetSwitchTarget cuePoint={cuePoint} deviceSlots={deviceSlots} presetNames={presetNames} onUpdate={onUpdate} />
      ) : (
        <EffectToggleTarget cuePoint={cuePoint} onUpdate={onUpdate} />
      )}

      {/* Delete */}
      <button
        onClick={() => onDelete(cuePoint.id)}
        className="flex h-6 w-6 items-center justify-center rounded text-xs transition-colors hover:opacity-80"
        style={{ color: 'var(--text-muted)' }}
        aria-label="Delete"
      >
        &times;
      </button>
    </div>
  );
}

// ─── Target sub-components ───────────────────────────────────────────────────

function PresetSwitchTarget({
  cuePoint,
  deviceSlots,
  presetNames,
  onUpdate,
}: {
  cuePoint: CuePoint;
  deviceSlots: number[];
  presetNames: (string | null)[];
  onUpdate: (id: string, patch: Partial<CuePoint>) => void;
}) {
  const t = useTranslations('playlists');

  return (
    <select
      value={cuePoint.slot ?? ''}
      onChange={(e) => {
        const slot = parseInt(e.target.value, 10);
        if (!isNaN(slot)) onUpdate(cuePoint.id, { slot });
      }}
      className="w-full rounded px-1.5 py-0.5 text-xs font-mono-display"
      style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-active)',
        color: 'var(--text-primary)',
      }}
      aria-label={t('targetLabel')}
    >
      <option value="">— {t('presetSwitch')} —</option>
      {deviceSlots.map((slot) => (
        <option key={slot} value={slot}>
          {SysExCodec.slotToLabel(slot)} — {presetNames[slot] ?? '…'}
        </option>
      ))}
    </select>
  );
}

function EffectToggleTarget({
  cuePoint,
  onUpdate,
}: {
  cuePoint: CuePoint;
  onUpdate: (id: string, patch: Partial<CuePoint>) => void;
}) {
  const t = useTranslations('playlists');
  const blockIndex = cuePoint.blockIndex ?? 0;
  const enabled = cuePoint.enabled ?? true;

  return (
    <div className="flex items-center gap-1.5">
      <select
        value={blockIndex}
        onChange={(e) =>
          onUpdate(cuePoint.id, { blockIndex: parseInt(e.target.value, 10) })
        }
        className="flex-1 rounded px-1.5 py-0.5 text-xs font-mono-display"
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-active)',
          color: 'var(--text-primary)',
        }}
        aria-label={t('targetLabel')}
      >
        {BLOCK_NAMES.map((name, i) => (
          <option key={name} value={i}>
            {name}
          </option>
        ))}
      </select>

      <button
        onClick={() => onUpdate(cuePoint.id, { enabled: !enabled })}
        className="shrink-0 rounded px-2 py-0.5 text-[10px] font-bold transition-colors"
        style={{
          background: enabled ? 'var(--accent-green)' : 'var(--accent-red)',
          color: '#0f0f0f',
        }}
      >
        {enabled ? t('on') : t('off')}
      </button>
    </div>
  );
}
