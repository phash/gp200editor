import { useState, useCallback } from 'react';
import type { GP200Preset } from '@/core/types';

interface PresetActions {
  preset: GP200Preset | null;
  loadPreset: (preset: GP200Preset) => void;
  setPatchName: (name: string) => void;
  setAuthor: (author: string) => void;
  toggleEffect: (slotIndex: number, forcedState?: boolean) => void;
  changeEffect: (slotIndex: number, effectId: number) => void;
  reorderEffects: (fromIndex: number, toIndex: number) => void;
  setParam: (slotIndex: number, paramIdx: number, value: number) => void;
  reset: () => void;
}

export function usePreset(): PresetActions {
  const [preset, setPreset] = useState<GP200Preset | null>(null);

  const loadPreset = useCallback((p: GP200Preset) => {
    setPreset(p);
  }, []);

  const setPatchName = useCallback((name: string) => {
    setPreset((prev) => prev ? { ...prev, patchName: name } : null);
  }, []);

  const setAuthor = useCallback((author: string) => {
    setPreset((prev) => prev ? { ...prev, author: author || undefined } : null);
  }, []);

  const toggleEffect = useCallback((slotIndex: number, forcedState?: boolean) => {
    setPreset((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        effects: prev.effects.map((slot) =>
          slot.slotIndex === slotIndex
            ? { ...slot, enabled: forcedState !== undefined ? forcedState : !slot.enabled }
            : slot
        ),
      };
    });
  }, []);

  const changeEffect = useCallback((slotIndex: number, effectId: number) => {
    setPreset((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        effects: prev.effects.map((slot) =>
          slot.slotIndex === slotIndex ? { ...slot, effectId } : slot
        ),
      };
    });
  }, []);

  const reorderEffects = useCallback((fromIndex: number, toIndex: number) => {
    setPreset((prev) => {
      if (!prev || fromIndex === toIndex) return prev;
      const effects = [...prev.effects];
      const [moved] = effects.splice(fromIndex, 1);
      effects.splice(toIndex, 0, moved);
      // Re-assign slotIndex to match new positions
      const updated = effects.map((slot, i) => ({ ...slot, slotIndex: i }));
      return { ...prev, effects: updated };
    });
  }, []);

  const setParam = useCallback((slotIndex: number, paramIdx: number, value: number) => {
    setPreset((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        effects: prev.effects.map((slot) => {
          if (slot.slotIndex !== slotIndex) return slot;
          const params = [...slot.params];
          // Ensure params array is big enough (15 float32 values)
          while (params.length <= paramIdx) params.push(0);
          params[paramIdx] = value;
          return { ...slot, params };
        }),
      };
    });
  }, []);

  const reset = useCallback(() => {
    setPreset(null);
  }, []);

  return { preset, loadPreset, setPatchName, setAuthor, toggleEffect, changeEffect, reorderEffects, setParam, reset };
}
