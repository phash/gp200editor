'use client';
import { useTranslations } from 'next-intl';
import type { EffectSlot as EffectSlotType } from '@/core/types';
import { getEffectName, getModuleName } from '@/core/effectNames';

interface EffectSlotProps {
  slot: EffectSlotType;
  index: number;
  onToggle: (index: number) => void;
  onDragStart: (index: number) => void;
  onDragOver: (e: React.DragEvent, index: number) => void;
  onDrop: (index: number) => void;
  isDragOver: boolean;
}

export function EffectSlot({ slot, index, onToggle, onDragStart, onDragOver, onDrop, isDragOver }: EffectSlotProps) {
  const t = useTranslations('editor');
  const effectName = getEffectName(slot.effectId);
  const moduleName = getModuleName(slot.effectId);

  return (
    <div
      draggable
      onDragStart={() => onDragStart(index)}
      onDragOver={(e) => onDragOver(e, index)}
      onDrop={() => onDrop(index)}
      className={`rounded-lg border p-4 cursor-grab active:cursor-grabbing transition-all ${
        isDragOver ? 'border-dashed border-blue-400 bg-blue-50/50' : ''
      } ${slot.enabled ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50'}`}
      data-testid={`effect-slot-${slot.slotIndex}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-gray-400 cursor-grab" aria-hidden="true">&#x2630;</span>
          <span className="font-medium">{effectName}</span>
          <span className="text-xs px-1.5 py-0.5 rounded bg-gray-200 text-gray-600">{moduleName}</span>
        </div>
        <button
          onClick={() => onToggle(slot.slotIndex)}
          aria-pressed={slot.enabled}
          aria-label={`${effectName} ${slot.enabled ? t('effectEnabled') : t('effectDisabled')}`}
          data-testid={`effect-slot-toggle-${slot.slotIndex}`}
          className={`px-3 py-1 rounded text-sm transition ${
            slot.enabled
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
          }`}
        >
          {slot.enabled ? t('effectOn') : t('effectOff')}
        </button>
      </div>
    </div>
  );
}
