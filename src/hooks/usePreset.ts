import { useState, useCallback } from 'react';
import type { GP200Preset } from '@/core/types';

interface PresetActions {
  preset: GP200Preset | null;
  loadPreset: (preset: GP200Preset) => void;
  setPatchName: (name: string) => void;
  toggleEffect: (slotIndex: number) => void;
  changeEffect: (slotIndex: number, effectId: number) => void;
  reorderEffects: (fromIndex: number, toIndex: number) => void;
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

  const toggleEffect = useCallback((slotIndex: number) => {
    setPreset((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        effects: prev.effects.map((slot) =>
          slot.slotIndex === slotIndex ? { ...slot, enabled: !slot.enabled } : slot
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

  const reset = useCallback(() => {
    setPreset(null);
  }, []);

  return { preset, loadPreset, setPatchName, toggleEffect, changeEffect, reorderEffects, reset };
}
