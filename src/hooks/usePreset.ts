import { useState, useCallback } from 'react';
import type { GP200Preset } from '@/core/types';

interface PresetActions {
  preset: GP200Preset | null;
  loadPreset: (preset: GP200Preset) => void;
  setPatchName: (name: string) => void;
  toggleEffect: (slotIndex: number) => void;
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

  const reset = useCallback(() => {
    setPreset(null);
  }, []);

  return { preset, loadPreset, setPatchName, toggleEffect, reset };
}
