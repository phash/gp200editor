'use client';
import { useTranslations } from 'next-intl';
import type { EffectSlot as EffectSlotType } from '@/core/types';
import { getEffectName, getModuleName, getEffectsByModule, MODULE_COLORS } from '@/core/effectNames';
import { EffectParams } from '@/components/EffectParams';

interface EffectSlotCardProps {
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

export function EffectSlotCard({ slot, index, onToggle, onChangeEffect, onParamChange, onDragStart, onDragOver, onDrop, isDragOver }: EffectSlotCardProps) {
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
      className="slot-enter relative flex flex-col h-full transition-all duration-200 active:cursor-grabbing"
      style={{
        animationDelay: `${index * 40}ms`,
        opacity: isDragOver ? 0.7 : 1,
        zIndex: 1,
      }}
      data-testid={`effect-slot-${slot.slotIndex}`}
    >
      {/* Pedal enclosure */}
      <div
        className="relative rounded-xl overflow-hidden flex flex-col h-full"
        style={{
          background: `linear-gradient(165deg, ${slot.enabled ? 'rgba(30,30,30,1)' : 'rgba(22,22,22,1)'} 0%, ${slot.enabled ? 'rgba(20,20,20,1)' : 'rgba(16,16,16,1)'} 100%)`,
          border: `2px solid ${isDragOver ? colors.accent : slot.enabled ? colors.accentDim : 'rgba(60,60,60,0.5)'}`,
          boxShadow: slot.enabled
            ? `0 0 30px ${colors.glow}, 0 8px 32px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)`
            : '0 4px 16px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.03)',
        }}
      >
        {/* Top strip — module color accent */}
        <div
          className="h-1"
          style={{
            background: slot.enabled
              ? `linear-gradient(90deg, transparent, ${colors.accent}, transparent)`
              : `linear-gradient(90deg, transparent, ${colors.accentDim}, transparent)`,
            opacity: slot.enabled ? 1 : 0.3,
          }}
        />

        {/* Drag handle bar — subtle screws */}
        <div className="flex items-center justify-between px-3 pt-2 pb-1">
          <span
            className="cursor-grab text-[8px] tracking-[0.3em] uppercase select-none"
            style={{ color: 'rgba(100,100,100,0.5)' }}
            aria-hidden="true"
            onMouseDown={(e) => e.stopPropagation()}
          >
            ● ● ●
          </span>
          <span
            className="text-[8px] tracking-[0.2em] uppercase font-mono-display select-none"
            style={{ color: 'rgba(100,100,100,0.4)' }}
          >
            {index + 1}
          </span>
        </div>

        {/* Module badge + effect name */}
        <div className="px-4 pt-1 pb-3 text-center">
          <span
            className="inline-block font-mono-display text-[9px] font-bold tracking-[0.25em] uppercase px-3 py-1 rounded-sm mb-2"
            style={{
              color: colors.accent,
              background: colors.glow,
              border: `1px solid ${colors.accentDim}`,
              letterSpacing: '0.2em',
            }}
          >
            {moduleName}
          </span>

          {/* Effect selector */}
          <div className="mt-1">
            <select
              value={slot.effectId}
              onChange={(e) => onChangeEffect(slot.slotIndex, Number(e.target.value))}
              data-testid={`effect-select-${slot.slotIndex}`}
              className="w-full text-center text-sm font-bold bg-transparent border-none cursor-pointer truncate focus:outline-none font-mono-display"
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
          </div>
        </div>

        {/* Parameters — flex-1 pushes stomp button to bottom */}
        <div className="px-3 pb-3 flex-1" draggable onDragStart={(e) => { e.preventDefault(); e.stopPropagation(); }}>
          <EffectParams
            effectId={slot.effectId}
            params={slot.params}
            onParamChange={(paramIdx, value) => onParamChange(slot.slotIndex, paramIdx, value)}
            maxColumns={2}
          />
        </div>

        {/* Footswitch — big stomp button */}
        <div className="px-4 pb-4 pt-1">
          <button
            onClick={(e) => { e.stopPropagation(); onToggle(slot.slotIndex); }}
            aria-pressed={slot.enabled}
            aria-label={`${effectName} ${slot.enabled ? t('effectEnabled') : t('effectDisabled')}`}
            data-testid={`effect-slot-toggle-${slot.slotIndex}`}
            className="relative w-full py-3 rounded-lg font-mono-display text-xs font-bold tracking-[0.15em] uppercase transition-all duration-150 cursor-pointer select-none"
            style={{
              background: slot.enabled
                ? `radial-gradient(ellipse at center, ${colors.glow} 0%, rgba(0,0,0,0) 70%), linear-gradient(180deg, rgba(50,50,50,1), rgba(35,35,35,1))`
                : 'linear-gradient(180deg, rgba(40,40,40,1), rgba(28,28,28,1))',
              border: `2px solid ${slot.enabled ? colors.accentDim : 'rgba(60,60,60,0.6)'}`,
              color: slot.enabled ? colors.accent : 'rgba(100,100,100,0.6)',
              boxShadow: slot.enabled
                ? `0 0 20px ${colors.glow}, inset 0 1px 0 rgba(255,255,255,0.08), 0 2px 4px rgba(0,0,0,0.5)`
                : 'inset 0 1px 0 rgba(255,255,255,0.04), 0 2px 4px rgba(0,0,0,0.3)',
            }}
          >
            {/* LED indicator */}
            <span
              className="absolute top-2 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full transition-all duration-200"
              style={{
                background: slot.enabled ? colors.accent : 'rgba(60,60,60,0.8)',
                boxShadow: slot.enabled ? `0 0 8px ${colors.accent}, 0 0 20px ${colors.glow}` : 'none',
              }}
            />
            <span className="mt-1 block">
              {slot.enabled ? t('effectOn') : t('effectOff')}
            </span>
          </button>
        </div>

        {/* Bottom accent line */}
        <div
          className="h-0.5"
          style={{
            background: slot.enabled
              ? `linear-gradient(90deg, transparent, ${colors.accentDim}, transparent)`
              : 'transparent',
            opacity: 0.5,
          }}
        />
      </div>
    </div>
  );
}
