'use client';
import { useTranslations } from 'next-intl';
import type { EffectSlot as EffectSlotType } from '@/core/types';
import { getEffectName, getModuleName, getEffectsByModule, MODULE_COLORS } from '@/core/effectNames';
import { EFFECT_DESCRIPTIONS } from '@/core/effectDescriptions';
import { EffectParams } from '@/components/EffectParams';

interface EffectSlotCardProps {
  slot: EffectSlotType;
  index: number;
  onToggle: (index: number) => void;
  onChangeEffect: (blockIndex: number, effectId: number) => void;
  onParamChange: (blockIndex: number, paramIdx: number, value: number) => void;
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
  const isEQ = moduleName === 'EQ';

  return (
    <div
      draggable
      onDragStart={() => onDragStart(index)}
      onDragOver={(e) => onDragOver(e, index)}
      onDrop={() => onDrop(index)}
      className={`slot-enter relative flex flex-col h-full transition-all duration-200 active:cursor-grabbing ${isEQ ? 'sm:col-span-2' : ''}`}
      style={{
        animationDelay: `${index * 40}ms`,
        opacity: isDragOver ? 0.7 : 1,
        zIndex: 1,
      }}
      data-testid={`effect-slot-${index}`}
    >
      {/* Jack indicators — IN (left) / OUT (right) */}
      <div
        className="absolute left-0 top-[45%] -translate-x-1/2 w-3 h-3 rounded-full border"
        style={{ background: 'rgba(30,30,30,1)', borderColor: 'rgba(80,80,80,0.6)', zIndex: 2 }}
      />
      <div
        className="absolute right-0 top-[45%] translate-x-1/2 w-3 h-3 rounded-full border"
        style={{ background: 'rgba(30,30,30,1)', borderColor: 'rgba(80,80,80,0.6)', zIndex: 2 }}
      />

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
          className="h-1.5"
          style={{
            background: slot.enabled
              ? `linear-gradient(90deg, transparent 5%, ${colors.accent} 50%, transparent 95%)`
              : `linear-gradient(90deg, transparent 5%, ${colors.accentDim} 50%, transparent 95%)`,
            opacity: slot.enabled ? 1 : 0.3,
          }}
        />

        {/* Drag handle bar */}
        <div className="flex items-center justify-between px-3 pt-2 pb-0">
          <span
            className="cursor-grab text-[8px] tracking-[0.3em] uppercase select-none"
            style={{ color: 'rgba(100,100,100,0.5)' }}
            aria-hidden="true"
            onMouseDown={(e) => e.stopPropagation()}
          >
            ● ● ●
          </span>
          <span
            className="text-[9px] tracking-[0.15em] uppercase font-mono-display select-none"
            style={{ color: 'rgba(100,100,100,0.4)' }}
          >
            {index + 1}
          </span>
        </div>

        {/* Module badge — prominent, centered */}
        <div className="px-4 pt-2 pb-1 text-center">
          <span
            className="inline-block font-mono-display text-[11px] font-black tracking-[0.3em] uppercase px-4 py-1.5 rounded"
            style={{
              color: colors.accent,
              background: `linear-gradient(180deg, ${colors.glow}, rgba(0,0,0,0))`,
              border: `1.5px solid ${colors.accentDim}`,
              boxShadow: slot.enabled ? `0 0 12px ${colors.glow}` : 'none',
            }}
          >
            {moduleName}
          </span>
        </div>

        {/* Effect name selector — larger */}
        <div className="px-4 pt-1 pb-2 text-center">
          <select
            value={slot.effectId}
            onChange={(e) => onChangeEffect(index, Number(e.target.value))}
            data-testid={`effect-select-${index}`}
            className="w-full text-center text-base font-bold bg-transparent border-none cursor-pointer truncate focus:outline-none font-mono-display"
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
          {EFFECT_DESCRIPTIONS[effectName] && (
            <p className="text-[9px] text-center truncate px-2"
              style={{ color: colors.accentDim }}
              title={EFFECT_DESCRIPTIONS[effectName]}>
              {EFFECT_DESCRIPTIONS[effectName]}
            </p>
          )}
        </div>

        {/* Parameters — flex-1 pushes stomp button to bottom */}
        <div className="px-3 pb-2 flex-1" draggable onDragStart={(e) => { e.preventDefault(); e.stopPropagation(); }}>
          <EffectParams
            effectId={slot.effectId}
            params={slot.params}
            onParamChange={(paramIdx, value) => onParamChange(index, paramIdx, value)}
            maxColumns={isEQ ? undefined : 2}
            layout={isEQ ? 'eq' : 'default'}
            slotIndex={index}
          />
        </div>

        {/* Footswitch — stomp button at bottom, below all sliders */}
        <div className="px-4 pb-4 pt-2 mt-auto">
          <button
            onClick={(e) => { e.stopPropagation(); onToggle(index); }}
            aria-pressed={slot.enabled}
            aria-label={`${effectName} ${slot.enabled ? t('effectEnabled') : t('effectDisabled')}`}
            data-testid={`effect-slot-toggle-${index}`}
            className="relative w-full py-3.5 rounded-lg font-mono-display text-sm font-bold tracking-[0.15em] uppercase transition-all duration-150 cursor-pointer select-none"
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
              className="absolute top-2 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full transition-all duration-200"
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
