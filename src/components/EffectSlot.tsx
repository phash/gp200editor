'use client';
import { useTranslations } from 'next-intl';
import type { EffectSlot as EffectSlotType } from '@/core/types';

interface EffectSlotProps {
  slot: EffectSlotType;
  onToggle: (index: number) => void;
}

export function EffectSlot({ slot, onToggle }: EffectSlotProps) {
  const t = useTranslations('editor');
  return (
    <div
      className={`rounded-lg border p-4 ${slot.enabled ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50'}`}
      data-testid={`effect-slot-${slot.slotIndex}`}
    >
      <div className="flex items-center justify-between">
        <span className="font-medium">{t('effectSlotLabel')} {slot.slotIndex + 1}</span>
        <button
          onClick={() => onToggle(slot.slotIndex)}
          aria-pressed={slot.enabled}
          aria-label={`${t('effectSlotLabel')} ${slot.slotIndex + 1} ${slot.enabled ? t('effectEnabled') : t('effectDisabled')}`}
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
      <div className="mt-2 text-sm text-gray-500">
        {t('effectId')}: {slot.effectId} · {t('parameterCount')}: {slot.params.length}
      </div>
    </div>
  );
}
