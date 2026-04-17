import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePreset } from '@/hooks/usePreset';
import type { GP200Preset } from '@/core/types';

const EMPTY_PARAMS = Array(15).fill(0);

function makePreset(): GP200Preset {
  return {
    version: '1',
    patchName: 'Test',
    effects: Array.from({ length: 11 }, (_, i) => ({
      slotIndex: i,
      effectId: 0,
      enabled: false,
      params: [...EMPTY_PARAMS],
    })),
    checksum: 0,
  };
}

describe('usePreset', () => {
  it('loadPreset sets the preset', () => {
    const { result } = renderHook(() => usePreset());
    act(() => result.current.loadPreset(makePreset()));
    expect(result.current.preset?.patchName).toBe('Test');
  });

  describe('reorderEffects', () => {
    it('preserves slotIndex on each slot (slotIndex = block type, immutable)', () => {
      const { result } = renderHook(() => usePreset());
      act(() => result.current.loadPreset(makePreset()));
      act(() => result.current.reorderEffects(0, 3));
      const slots = result.current.preset!.effects;
      const slotIndices = slots.map((s) => s.slotIndex).sort((a, b) => a - b);
      expect(slotIndices).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      // The slot that was at position 0 (slotIndex=0) is now at array position 3
      expect(slots[3].slotIndex).toBe(0);
    });

    it('noops on same from/to', () => {
      const { result } = renderHook(() => usePreset());
      act(() => result.current.loadPreset(makePreset()));
      const before = result.current.preset;
      act(() => result.current.reorderEffects(2, 2));
      expect(result.current.preset).toBe(before);
    });
  });

  describe('changeEffect', () => {
    it('clears old param values in unused slots when switching effect', () => {
      const { result } = renderHook(() => usePreset());
      const preset = makePreset();
      // Slot 0 carries stale values in slots 2..14 from a previous effect
      preset.effects[0].params = Array.from({ length: 15 }, (_, i) => i * 7);
      act(() => result.current.loadPreset(preset));
      // effectId 0 defines params 0 and 1; slots 2..14 must be zeroed (not leak)
      act(() => result.current.changeEffect(0, 0));
      const params = result.current.preset!.effects[0].params;
      expect(params).toHaveLength(15);
      for (let i = 2; i < 15; i++) {
        expect(params[i]).toBe(0);
      }
    });

    it('keeps params length at exactly 15', () => {
      const { result } = renderHook(() => usePreset());
      act(() => result.current.loadPreset(makePreset()));
      act(() => result.current.changeEffect(0, 0x02000001));
      expect(result.current.preset!.effects[0].params).toHaveLength(15);
    });
  });

  describe('setParam', () => {
    it('ignores paramIdx out of 0..14', () => {
      const { result } = renderHook(() => usePreset());
      act(() => result.current.loadPreset(makePreset()));
      act(() => result.current.setParam(0, 99, 42));
      expect(result.current.preset!.effects[0].params).toHaveLength(15);
      act(() => result.current.setParam(0, -1, 42));
      expect(result.current.preset!.effects[0].params).toHaveLength(15);
    });

    it('writes value at valid index', () => {
      const { result } = renderHook(() => usePreset());
      act(() => result.current.loadPreset(makePreset()));
      act(() => result.current.setParam(0, 5, 42.5));
      expect(result.current.preset!.effects[0].params[5]).toBe(42.5);
    });
  });
});
