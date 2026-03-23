'use client';
import { useTranslations } from 'next-intl';
import { useState, useCallback } from 'react';
import type { GP200Preset } from '@/core/types';
import { getModuleName, getEffectName } from '@/core/effectNames';
import { getEffectParams } from '@/core/effectParams';

/** EXP page indices matching the SysEx protocol */
const EXP_PAGES = [
  { page: 0, labelKey: 'exp1ModeA' as const },
  { page: 1, labelKey: 'exp1ModeB' as const },
  { page: 2, labelKey: 'exp2' as const },
] as const;

/** Block index names matching the GP-200 signal chain order */
const BLOCK_NAMES = ['PRE', 'WAH', 'BOOST', 'AMP', 'NR', 'CAB', 'EQ', 'MOD', 'DLY', 'RVB', 'VOL'];

const ITEMS_PER_PAGE = 3; // Para 1, 2, 3

/** Assignable parameter option with block/param indices for SysEx. */
interface ParamOption {
  label: string;       // "WAH-V-Wah-Range"
  value: string;       // "1-0" (blockIndex-paramIndex)
  blockIndex: number;  // 0-10
  paramIdx: number;    // 0-14
}

/** Build a flat list of assignable parameters from the current preset's active effects. */
function buildParamOptions(preset: GP200Preset | null): ParamOption[] {
  if (!preset) return [];
  const options: ParamOption[] = [];
  for (let blockIndex = 0; blockIndex < preset.effects.length; blockIndex++) {
    const slot = preset.effects[blockIndex];
    const moduleName = getModuleName(slot.effectId);
    const effectName = getEffectName(slot.effectId);
    const params = getEffectParams(slot.effectId);
    for (let pi = 0; pi < params.length; pi++) {
      options.push({
        label: `${moduleName}-${effectName}-${params[pi].name}`,
        value: `${blockIndex}-${pi}`,
        blockIndex,
        paramIdx: pi,
      });
    }
  }
  return options;
}

interface ControllerPanelProps {
  preset: GP200Preset | null;
  connected: boolean;
  onParamSelect: (page: number, item: number, blockIndex: number, paramIdx: number) => void;
  onMinMax: (page: number, item: number, min: number, max: number) => void;
}

interface ExpSlotState {
  paramValue: string; // "blockIndex-paramIndex" or "" for unassigned
  min: number;
  max: number;
}

type ExpState = Record<string, ExpSlotState>; // key: "page-item"

function slotKey(page: number, item: number): string {
  return `${page}-${item}`;
}

export function ControllerPanel({ preset, connected, onParamSelect, onMinMax }: ControllerPanelProps) {
  const t = useTranslations('editor');
  const [collapsed, setCollapsed] = useState(true);
  const [expState, setExpState] = useState<ExpState>({});

  const paramOptions = buildParamOptions(preset);

  const getSlot = useCallback((page: number, item: number): ExpSlotState => {
    return expState[slotKey(page, item)] ?? { paramValue: '', min: 0, max: 100 };
  }, [expState]);

  const handleParamChange = useCallback((page: number, item: number, paramValue: string) => {
    setExpState(prev => {
      const key = slotKey(page, item);
      const current = prev[key] ?? { paramValue: '', min: 0, max: 100 };
      return { ...prev, [key]: { ...current, paramValue } };
    });
    if (paramValue) {
      const [bi, pi] = paramValue.split('-').map(Number);
      onParamSelect(page, item, bi, pi);
    }
  }, [onParamSelect]);

  const handleMinMaxChange = useCallback((page: number, item: number, updates: { min?: number; max?: number }) => {
    setExpState(prev => {
      const key = slotKey(page, item);
      const current = prev[key] ?? { paramValue: '', min: 0, max: 100 };
      const next = { ...current, ...updates };
      onMinMax(page, item, next.min, next.max);
      return { ...prev, [key]: next };
    });
  }, [onMinMax]);

  if (!connected) return null;

  return (
    <div className="rounded-lg mb-4"
      style={{ border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
      {/* Header / collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-left"
        aria-expanded={!collapsed}
        aria-label={t('controllersCollapse')}
      >
        <span className="font-mono-display text-xs font-bold tracking-wider uppercase"
          style={{ color: 'var(--text-muted)' }}>
          {t('controllers')}
        </span>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {collapsed ? '\u25B6' : '\u25BC'}
        </span>
      </button>

      {!collapsed && (
        <div className="px-4 pb-4 space-y-4">
          {EXP_PAGES.map(({ page, labelKey }) => (
            <div key={page}>
              <h3 className="font-mono-display text-[10px] font-bold tracking-wider uppercase mb-2"
                style={{ color: 'var(--accent-amber)' }}>
                {t(labelKey)}
              </h3>
              <div className="space-y-1">
                {Array.from({ length: ITEMS_PER_PAGE }, (_, item) => {
                  const slot = getSlot(page, item);
                  return (
                    <div key={item}
                      className="flex items-center gap-2 py-1 px-2 rounded"
                      style={{ background: 'rgba(255,255,255,0.02)' }}>
                      {/* Para label */}
                      <span className="font-mono-display text-[10px] font-medium w-12 flex-shrink-0"
                        style={{ color: 'var(--text-muted)' }}>
                        {t('para', { n: item + 1 })}
                      </span>

                      {/* Parameter dropdown — sends blockIndex<<4 + paramIdx<<4 via navigation */}
                      <select
                        value={slot.paramValue}
                        onChange={e => handleParamChange(page, item, e.target.value)}
                        className="flex-1 text-xs rounded px-1.5 py-1 min-w-0"
                        style={{
                          background: 'rgba(255,255,255,0.05)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          color: !slot.paramValue ? 'var(--text-muted)' : 'var(--text-primary)',
                        }}
                      >
                        <option value="">{t('unassigned')}</option>
                        {paramOptions.map(o => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>

                      {/* Min */}
                      <label className="flex items-center gap-1 flex-shrink-0">
                        <span className="font-mono-display text-[9px] uppercase"
                          style={{ color: 'var(--text-muted)' }}>{t('minLabel')}</span>
                        <input
                          type="number"
                          min={0}
                          max={slot.max}
                          value={slot.min}
                          onChange={e => handleMinMaxChange(page, item, { min: Number(e.target.value) })}
                          disabled={!slot.paramValue}
                          className="w-12 text-xs text-center rounded px-1 py-0.5"
                          style={{
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            color: !slot.paramValue ? 'var(--text-muted)' : 'var(--text-primary)',
                          }}
                        />
                      </label>

                      {/* Max */}
                      <label className="flex items-center gap-1 flex-shrink-0">
                        <span className="font-mono-display text-[9px] uppercase"
                          style={{ color: 'var(--text-muted)' }}>{t('maxLabel')}</span>
                        <input
                          type="number"
                          min={slot.min}
                          max={100}
                          value={slot.max}
                          onChange={e => handleMinMaxChange(page, item, { max: Number(e.target.value) })}
                          disabled={!slot.paramValue}
                          className="w-12 text-xs text-center rounded px-1 py-0.5"
                          style={{
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            color: !slot.paramValue ? 'var(--text-muted)' : 'var(--text-primary)',
                          }}
                        />
                      </label>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
