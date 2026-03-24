'use client';
import { getEffectParams } from '@/core/effectParams';
import { getEffectName } from '@/core/effectNames';
import type { GP200Preset } from '@/core/types';

interface AmpHeadPanelProps {
  preset: GP200Preset;
  onParamChange: (slotIndex: number, paramIndex: number, value: number) => void;
}

export function AmpHeadPanel({ preset, onParamChange }: AmpHeadPanelProps) {
  // Find the AMP effect (module high byte 0x07 or 0x08)
  const ampEffect = preset.effects.find(e => {
    const mod = (e.effectId >>> 24) & 0xFF;
    return mod === 0x07 || mod === 0x08;
  });
  if (!ampEffect) return null;

  const paramDefs = getEffectParams(ampEffect.effectId);
  const ampName = getEffectName(ampEffect.effectId) ?? 'AMP';

  // Build slider for a param by index
  function Slider({ paramIdx }: { paramIdx: number }) {
    const def = paramDefs[paramIdx];
    if (!def || def.type !== 'knob') return null;
    const value = ampEffect!.params[paramIdx] ?? 0;
    const pct = def.max > def.min
      ? ((value - def.min) / (def.max - def.min)) * 100
      : 0;

    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-medium uppercase tracking-wider"
            style={{ color: 'rgba(224,128,64,0.6)' }}>
            {def.name}
          </label>
          <span className="font-mono-display text-[11px] tabular-nums"
            style={{ color: '#e08040' }}>
            {Math.round(value)}
          </span>
        </div>
        <div className="relative">
          <div className="absolute top-[12px] left-0 right-0 h-[4px] rounded-full"
            style={{ background: 'rgba(224,128,64,0.1)' }}>
            <div className="h-full rounded-full transition-all duration-75"
              style={{ width: `${pct}%`, background: 'linear-gradient(90deg, rgba(224,128,64,0.4), #e08040)' }} />
          </div>
          <input
            type="range"
            min={def.min}
            max={def.max}
            step={def.step}
            value={value}
            onChange={(e) => onParamChange(ampEffect!.slotIndex, paramIdx, parseFloat(e.target.value))}
            className="relative w-full z-10"
          />
        </div>
      </div>
    );
  }

  // Drawing layout: Left = params 2(Vol), 0(Gain), 1(Pres) — Right = params 3(Bass), 4(Mid), 5(Treb)
  // But param order varies by AMP model, so use actual param defs (first 6 knobs)
  const knobParams = paramDefs
    .filter((p): p is Extract<typeof p, { type: 'knob' }> => p.type === 'knob')
    .slice(0, 6);
  const leftParams = knobParams.slice(0, 3);
  const rightParams = knobParams.slice(3, 6);

  return (
    <div className="mb-4 rounded-xl overflow-hidden"
      style={{ border: '1px solid rgba(224,128,64,0.15)', background: 'rgba(224,128,64,0.03)' }}>
      <div className="px-4 py-2 flex items-center gap-2"
        style={{ borderBottom: '1px solid rgba(224,128,64,0.1)' }}>
        <span className="font-mono-display text-[11px] font-bold uppercase tracking-wider"
          style={{ color: '#e08040' }}>
          {ampName}
        </span>
        {!ampEffect.enabled && (
          <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            (bypass)
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-4 p-4">
        <div className="flex flex-col gap-2">
          {leftParams.map(p => <Slider key={p.idx} paramIdx={p.idx} />)}
        </div>
        <div className="flex flex-col gap-2">
          {rightParams.map(p => <Slider key={p.idx} paramIdx={p.idx} />)}
        </div>
      </div>
    </div>
  );
}
