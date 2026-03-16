'use client';
import { useTranslations } from 'next-intl';
import { getEffectParams, type EffectParam } from '@/core/effectParams';

interface EffectParamsProps {
  effectId: number;
  params: number[];
  onParamChange: (idx: number, value: number) => void;
}

function KnobControl({ param, value, onChange }: {
  param: Extract<EffectParam, { type: 'knob' }>;
  value: number;
  onChange: (value: number) => void;
}) {
  const pct = param.max > param.min
    ? ((value - param.min) / (param.max - param.min)) * 100
    : 0;

  return (
    <div className="flex flex-col gap-1.5 px-1">
      <div className="flex items-center justify-between">
        <label className="text-[11px] font-medium uppercase tracking-wider"
          style={{ color: 'var(--text-muted)' }}
          htmlFor={`param-${param.idx}`}>
          {param.name}
        </label>
        <span className="font-mono-display text-xs tabular-nums"
          style={{ color: 'var(--accent-amber)' }}>
          {Math.round(value)}
        </span>
      </div>
      <div className="relative">
        <div className="absolute top-[12px] left-0 right-0 h-[4px] rounded-full"
          style={{ background: 'var(--knob-track)' }}>
          <div className="h-full rounded-full transition-all duration-75"
            style={{ width: `${pct}%`, background: `linear-gradient(90deg, var(--accent-amber-dim), var(--accent-amber))` }} />
        </div>
        <input
          id={`param-${param.idx}`}
          type="range"
          min={param.min}
          max={param.max}
          step={param.step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="relative w-full z-10"
          data-testid={`param-knob-${param.idx}`}
        />
      </div>
    </div>
  );
}

function SwitchControl({ param, value, onChange }: {
  param: Extract<EffectParam, { type: 'switch' }>;
  value: number;
  onChange: (value: number) => void;
}) {
  const isOn = value !== 0;
  return (
    <div className="flex flex-col gap-1.5 px-1">
      <span className="text-[11px] font-medium uppercase tracking-wider"
        style={{ color: 'var(--text-muted)' }}>
        {param.name}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={isOn}
        onClick={() => onChange(isOn ? 0 : 1)}
        className="h-8 rounded text-xs font-medium transition-all duration-150 border"
        style={{
          background: isOn ? 'var(--glow-green)' : 'var(--bg-primary)',
          borderColor: isOn ? 'var(--accent-green)' : 'var(--border-subtle)',
          color: isOn ? 'var(--accent-green)' : 'var(--text-muted)',
          boxShadow: isOn ? '0 0 12px var(--glow-green)' : 'none',
        }}
        data-testid={`param-switch-${param.idx}`}
      >
        {isOn ? param.options.find(o => o.id !== 0)?.name ?? 'ON' : param.options.find(o => o.id === 0)?.name ?? 'OFF'}
      </button>
    </div>
  );
}

function ComboxControl({ param, value, onChange }: {
  param: Extract<EffectParam, { type: 'combox' }>;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5 px-1">
      <label className="text-[11px] font-medium uppercase tracking-wider"
        style={{ color: 'var(--text-muted)' }}
        htmlFor={`param-${param.idx}`}>
        {param.name}
      </label>
      <select
        id={`param-${param.idx}`}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        className="h-8 text-sm rounded px-2 border cursor-pointer transition-colors focus:outline-none"
        style={{
          background: 'var(--bg-primary)',
          borderColor: 'var(--border-subtle)',
          color: 'var(--text-primary)',
        }}
        data-testid={`param-combox-${param.idx}`}
      >
        {param.options.map((opt) => (
          <option key={opt.id} value={opt.id}>
            {opt.name}
          </option>
        ))}
      </select>
    </div>
  );
}

export function EffectParams({ effectId, params, onParamChange }: EffectParamsProps) {
  const t = useTranslations('editor');
  const paramDefs = getEffectParams(effectId);

  if (paramDefs.length === 0) {
    return (
      <p className="text-xs italic py-3" style={{ color: 'var(--text-muted)' }}>{t('noParams')}</p>
    );
  }

  return (
    <div
      className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3 pt-4 mt-3"
      style={{ borderTop: '1px solid var(--border-subtle)' }}
      data-testid="effect-params"
    >
      {paramDefs.map((param) => {
        const value = params[param.idx] ?? param.default;
        const handleChange = (v: number) => onParamChange(param.idx, v);

        switch (param.type) {
          case 'knob':
            return <KnobControl key={param.idx} param={param} value={value} onChange={handleChange} />;
          case 'switch':
            return <SwitchControl key={param.idx} param={param} value={value} onChange={handleChange} />;
          case 'combox':
            return <ComboxControl key={param.idx} param={param} value={value} onChange={handleChange} />;
        }
      })}
    </div>
  );
}
