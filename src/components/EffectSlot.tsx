'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { EffectSlot as EffectSlotType } from '@/core/types';
import { getEffectName, getModuleName, getEffectsByModule, MODULE_COLORS } from '@/core/effectNames';
import { EffectParams } from '@/components/EffectParams';

interface EffectSlotProps {
  slot: EffectSlotType;
  index: number;
  onToggle: (index: number) => void;
  onChangeEffect: (slotIndex: number, effectId: number) => void;
  onParamChange: (slotIndex: number, paramIdx: number, value: number) => void;
  onDragStart: (index: number) => void;
  onDragOver: (e: React.DragEvent, index: number) => void;
  onDrop: (index: number) => void;
  isDragOver: boolean;
}

export function EffectSlot({ slot, index, onToggle, onChangeEffect, onParamChange, onDragStart, onDragOver, onDrop, isDragOver }: EffectSlotProps) {
  const t = useTranslations('editor');
  const [expanded, setExpanded] = useState(false);
  const effectName = getEffectName(slot.effectId);
  const moduleName = getModuleName(slot.effectId);
  const colors = MODULE_COLORS[moduleName] ?? MODULE_COLORS.VOL;
  const effects = getEffectsByModule(moduleName);

  return (
    <div
      draggable
      onDragStart={() => onDragStart(index)}
      onDragOver={(e) => onDragOver(e, index)}
      onDrop={() => onDrop(index)}
      className="slot-enter rounded-lg transition-all duration-200 active:cursor-grabbing"
      style={{
        animationDelay: `${index * 40}ms`,
        background: 'var(--bg-surface)',
        border: `1px solid ${isDragOver ? colors.accent : slot.enabled ? colors.accentDim : 'var(--border-subtle)'}`,
        boxShadow: slot.enabled
          ? `0 0 20px ${colors.glow}, inset 0 1px 0 rgba(255,255,255,0.03)`
          : 'inset 0 1px 0 rgba(255,255,255,0.02)',
        opacity: isDragOver ? 0.7 : 1,
      }}
      data-testid={`effect-slot-${slot.slotIndex}`}
    >
      {/* Header row */}
      <div
        className="flex items-center justify-between gap-3 px-4 py-3 cursor-pointer select-none"
        onClick={() => setExpanded(!expanded)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpanded(!expanded); } }}
        aria-expanded={expanded}
        aria-label={`${effectName} ${t('parameters')}`}
        data-testid={`effect-slot-header-${slot.slotIndex}`}
      >
        <div className="flex items-center gap-3 min-w-0">
          {/* Drag handle */}
          <span className="cursor-grab flex-shrink-0 text-sm leading-none"
            style={{ color: 'var(--text-muted)' }}
            aria-hidden="true"
            onMouseDown={(e) => e.stopPropagation()}>
            &#x2630;
          </span>

          {/* Module badge */}
          <span className="font-mono-display text-[10px] font-bold tracking-widest px-2 py-0.5 rounded flex-shrink-0 uppercase"
            style={{
              color: colors.accent,
              background: colors.glow,
              border: `1px solid ${colors.accentDim}`,
            }}>
            {moduleName}
          </span>

          {/* Effect selector */}
          <select
            value={slot.effectId}
            onChange={(e) => onChangeEffect(slot.slotIndex, Number(e.target.value))}
            onClick={(e) => e.stopPropagation()}
            data-testid={`effect-select-${slot.slotIndex}`}
            className="text-sm font-medium bg-transparent border-none cursor-pointer truncate min-w-0 focus:outline-none rounded"
            style={{ color: 'var(--text-primary)' }}
          >
            {effects.map((eff) => (
              <option key={eff.effectId} value={eff.effectId}>
                {eff.name}
              </option>
            ))}
            {!effects.some(e => e.effectId === slot.effectId) && (
              <option value={slot.effectId}>{effectName}</option>
            )}
          </select>

          {/* Expand arrow */}
          <span className="text-xs transition-transform duration-200"
            style={{
              color: 'var(--text-muted)',
              transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            }}
            aria-hidden="true">
            &#x25BE;
          </span>
        </div>

        {/* LED-style ON/OFF toggle */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggle(slot.slotIndex); }}
          aria-pressed={slot.enabled}
          aria-label={`${effectName} ${slot.enabled ? t('effectEnabled') : t('effectDisabled')}`}
          data-testid={`effect-slot-toggle-${slot.slotIndex}`}
          className="font-mono-display text-[10px] font-bold tracking-wider px-3 py-1.5 rounded transition-all duration-150 flex-shrink-0 uppercase"
          style={{
            background: slot.enabled ? colors.glow : 'var(--bg-primary)',
            border: `1px solid ${slot.enabled ? colors.accent : 'var(--border-subtle)'}`,
            color: slot.enabled ? colors.accent : 'var(--text-muted)',
            boxShadow: slot.enabled ? `0 0 10px ${colors.glow}` : 'none',
          }}
        >
          {slot.enabled ? t('effectOn') : t('effectOff')}
        </button>
      </div>

      {/* Expanded params */}
      {expanded && (
        <div className="px-4 pb-4">
          <EffectParams
            effectId={slot.effectId}
            params={slot.params}
            onParamChange={(paramIdx, value) => onParamChange(slot.slotIndex, paramIdx, value)}
          />
        </div>
      )}
    </div>
  );
}
