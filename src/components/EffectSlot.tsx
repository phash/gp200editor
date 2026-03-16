'use client';
import { useTranslations } from 'next-intl';
import type { EffectSlot as EffectSlotType } from '@/core/types';
import { getEffectName, getModuleName, getEffectsByModule, MODULE_COLORS } from '@/core/effectNames';

interface EffectSlotProps {
  slot: EffectSlotType;
  index: number;
  onToggle: (index: number) => void;
  onChangeEffect: (slotIndex: number, effectId: number) => void;
  onDragStart: (index: number) => void;
  onDragOver: (e: React.DragEvent, index: number) => void;
  onDrop: (index: number) => void;
  isDragOver: boolean;
}

export function EffectSlot({ slot, index, onToggle, onChangeEffect, onDragStart, onDragOver, onDrop, isDragOver }: EffectSlotProps) {
  const t = useTranslations('editor');
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
      className={`rounded-lg border p-4 cursor-grab active:cursor-grabbing transition-all ${
        isDragOver ? 'border-dashed border-blue-400 bg-blue-50/50'
        : slot.enabled ? `${colors.borderActive} ${colors.bgActive}`
        : `${colors.border} ${colors.bg}`
      }`}
      data-testid={`effect-slot-${slot.slotIndex}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-gray-400 cursor-grab flex-shrink-0" aria-hidden="true">&#x2630;</span>
          <span className={`text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${colors.badge}`}>{moduleName}</span>
          <select
            value={slot.effectId}
            onChange={(e) => onChangeEffect(slot.slotIndex, Number(e.target.value))}
            data-testid={`effect-select-${slot.slotIndex}`}
            className="font-medium text-black bg-transparent border-none cursor-pointer truncate min-w-0 focus:outline-none focus:ring-2 focus:ring-blue-300 rounded"
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
        </div>
        <button
          onClick={() => onToggle(slot.slotIndex)}
          aria-pressed={slot.enabled}
          aria-label={`${effectName} ${slot.enabled ? t('effectEnabled') : t('effectDisabled')}`}
          data-testid={`effect-slot-toggle-${slot.slotIndex}`}
          className={`px-3 py-1 rounded text-sm transition flex-shrink-0 ${
            slot.enabled
              ? `${colors.btn} text-white hover:opacity-80`
              : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
          }`}
        >
          {slot.enabled ? t('effectOn') : t('effectOff')}
        </button>
      </div>
    </div>
  );
}
