'use client';
import { useTranslations } from 'next-intl';
import { useRef, useCallback } from 'react';

interface PatchSettingsCardProps {
  volume: number;
  pan: number;       // -50 to +50
  tempo: number;     // 40-250
  onVolumeChange: (value: number) => void;
  onPanChange: (value: number) => void;
  onTempoChange: (bpm: number) => void;
  connected: boolean;
}

function SliderRow({ label, value, displayValue, min, max, step, onChange }: {
  label: string; value: number; displayValue: string;
  min: number; max: number; step: number;
  onChange: (v: number) => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="flex items-center gap-2">
      <span className="font-mono-display text-[10px] font-medium tracking-wider uppercase w-20 flex-shrink-0"
        style={{ color: 'var(--text-muted)' }}>{label}</span>
      <div className="relative flex-1 h-3 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <div className="h-full rounded-full transition-all duration-75"
          style={{ width: `${pct}%`, background: 'linear-gradient(90deg, var(--accent-amber-dim), var(--accent-amber))' }} />
      </div>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="absolute inset-0 w-full opacity-0 cursor-pointer"
        style={{ position: 'absolute', left: 0, top: 0, height: '100%', margin: 0 }}
      />
      <span className="font-mono-display text-xs tabular-nums w-14 text-right flex-shrink-0"
        style={{ color: 'var(--text-secondary)' }}>{displayValue}</span>
    </div>
  );
}

export function PatchSettingsCard({
  volume, pan, tempo,
  onVolumeChange, onPanChange, onTempoChange,
  connected,
}: PatchSettingsCardProps) {
  const t = useTranslations('editor');
  const debounceRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const debounced = useCallback((key: string, fn: () => void) => {
    if (debounceRef.current[key]) clearTimeout(debounceRef.current[key]);
    debounceRef.current[key] = setTimeout(fn, 30);
  }, []);

  const panDisplay = pan === 0 ? 'C' : pan < 0 ? `L${Math.abs(pan)}` : `R${pan}`;

  return (
    <div className="rounded-lg px-4 py-3 flex flex-col gap-2"
      style={{ border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
      <div className="flex items-center gap-3">
        <div className="flex-1 flex flex-col gap-1.5">
          {/* Volume */}
          <div className="flex items-center gap-2">
            <span className="font-mono-display text-[10px] font-medium tracking-wider uppercase w-20 flex-shrink-0"
              style={{ color: 'var(--text-muted)' }}>{t('patchVol')}</span>
            <div className="relative flex-1 h-2.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <div className="h-full rounded-full transition-all duration-75"
                style={{ width: `${volume}%`, background: 'linear-gradient(90deg, var(--accent-amber-dim), var(--accent-amber))' }} />
              <input type="range" min={0} max={100} step={1} value={volume}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  onVolumeChange(v);
                  if (connected) debounced('vol', () => {});
                }}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" style={{ margin: 0 }} />
            </div>
            <span className="font-mono-display text-xs tabular-nums w-8 text-right flex-shrink-0"
              style={{ color: 'var(--text-secondary)' }}>{volume}</span>
          </div>
          {/* Pan */}
          <div className="flex items-center gap-2">
            <span className="font-mono-display text-[10px] font-medium tracking-wider uppercase w-20 flex-shrink-0"
              style={{ color: 'var(--text-muted)' }}>{t('patchPan')}</span>
            <div className="relative flex-1 h-2.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <div className="h-full rounded-full transition-all duration-75"
                style={{
                  width: `${Math.abs(pan)}%`,
                  marginLeft: pan < 0 ? `${50 + pan}%` : '50%',
                  background: 'linear-gradient(90deg, var(--accent-amber-dim), var(--accent-amber))',
                }} />
              <input type="range" min={-50} max={50} step={1} value={pan}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  onPanChange(v);
                  if (connected) debounced('pan', () => {});
                }}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" style={{ margin: 0 }} />
            </div>
            <span className="font-mono-display text-xs tabular-nums w-8 text-right flex-shrink-0"
              style={{ color: 'var(--text-secondary)' }}>{panDisplay}</span>
          </div>
          {/* Tempo */}
          <div className="flex items-center gap-2">
            <span className="font-mono-display text-[10px] font-medium tracking-wider uppercase w-20 flex-shrink-0"
              style={{ color: 'var(--text-muted)' }}>{t('tempo')}</span>
            <div className="relative flex-1 h-2.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <div className="h-full rounded-full transition-all duration-75"
                style={{ width: `${((tempo - 40) / 210) * 100}%`, background: 'linear-gradient(90deg, var(--accent-amber-dim), var(--accent-amber))' }} />
              <input type="range" min={40} max={250} step={1} value={tempo}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  onTempoChange(v);
                  if (connected) debounced('tempo', () => {});
                }}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" style={{ margin: 0 }} />
            </div>
            <span className="font-mono-display text-xs tabular-nums w-14 text-right flex-shrink-0"
              style={{ color: 'var(--text-secondary)' }}>{tempo} {t('bpm')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
