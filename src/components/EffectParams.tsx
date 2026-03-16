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
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-600" htmlFor={`param-${param.idx}`}>
        {param.name}
      </label>
      <input
        id={`param-${param.idx}`}
        type="range"
        min={param.min}
        max={param.max}
        step={param.step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
        data-testid={`param-knob-${param.idx}`}
      />
      <span className="text-xs text-gray-500 text-center tabular-nums">{value}</span>
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
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-gray-600">{param.name}</span>
      <button
        type="button"
        role="switch"
        aria-checked={isOn}
        onClick={() => onChange(isOn ? 0 : 1)}
        className={`px-3 py-1 rounded text-xs font-medium transition ${
          isOn
            ? 'bg-blue-600 text-white hover:bg-blue-700'
            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
        }`}
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
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-600" htmlFor={`param-${param.idx}`}>
        {param.name}
      </label>
      <select
        id={`param-${param.idx}`}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        className="text-sm border rounded px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
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
      <p className="text-sm text-gray-400 italic py-2">{t('noParams')}</p>
    );
  }

  return (
    <div
      className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-3"
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
