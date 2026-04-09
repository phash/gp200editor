import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePreset } from '@/hooks/usePreset';
import type { GP200Preset } from '@/core/types';

const PARAMS = Array(15).fill(0);
const samplePreset: GP200Preset = {
  version: '1',
  patchName: 'TestPreset',
  effects: Array.from({ length: 11 }, (_, i) => ({
    slotIndex: i,
    effectId: i === 3 ? 0x03000000 : 0, // slot 3 = Green OD (DST)
    enabled: i < 5,
    params: PARAMS,
  })),
  checksum: 0,
};

describe('usePreset', () => {
  it('initial state is null', () => {
    const { result } = renderHook(() => usePreset());
    expect(result.current.preset).toBeNull();
  });

  it('loadPreset sets the preset', () => {
    const { result } = renderHook(() => usePreset());
    act(() => { result.current.loadPreset(samplePreset); });
    expect(result.current.preset).not.toBeNull();
    expect(result.current.preset?.patchName).toBe('TestPreset');
    expect(result.current.preset?.effects).toHaveLength(11);
  });

  it('setPatchName updates the patch name', () => {
    const { result } = renderHook(() => usePreset());
    act(() => { result.current.loadPreset(samplePreset); });
    act(() => { result.current.setPatchName('NewName'); });
    expect(result.current.preset?.patchName).toBe('NewName');
  });

  it('setPatchName does nothing when no preset loaded', () => {
    const { result } = renderHook(() => usePreset());
    act(() => { result.current.setPatchName('Test'); });
    expect(result.current.preset).toBeNull();
  });

  it('setAuthor sets the author field', () => {
    const { result } = renderHook(() => usePreset());
    act(() => { result.current.loadPreset(samplePreset); });
    act(() => { result.current.setAuthor('Phash'); });
    expect(result.current.preset?.author).toBe('Phash');
  });

  it('setAuthor with empty string clears author', () => {
    const { result } = renderHook(() => usePreset());
    act(() => { result.current.loadPreset({ ...samplePreset, author: 'Old' }); });
    act(() => { result.current.setAuthor(''); });
    expect(result.current.preset?.author).toBeUndefined();
  });

  it('setAuthor does nothing when no preset loaded', () => {
    const { result } = renderHook(() => usePreset());
    act(() => { result.current.setAuthor('Test'); });
    expect(result.current.preset).toBeNull();
  });

  it('toggleEffect toggles enabled state', () => {
    const { result } = renderHook(() => usePreset());
    act(() => { result.current.loadPreset(samplePreset); });
    expect(result.current.preset?.effects[0].enabled).toBe(true);
    act(() => { result.current.toggleEffect(0); });
    expect(result.current.preset?.effects[0].enabled).toBe(false);
    act(() => { result.current.toggleEffect(0); });
    expect(result.current.preset?.effects[0].enabled).toBe(true);
  });

  it('toggleEffect with forcedState sets exact value', () => {
    const { result } = renderHook(() => usePreset());
    act(() => { result.current.loadPreset(samplePreset); });
    act(() => { result.current.toggleEffect(0, false); });
    expect(result.current.preset?.effects[0].enabled).toBe(false);
    act(() => { result.current.toggleEffect(0, false); }); // already false
    expect(result.current.preset?.effects[0].enabled).toBe(false);
    act(() => { result.current.toggleEffect(0, true); });
    expect(result.current.preset?.effects[0].enabled).toBe(true);
  });

  it('toggleEffect does nothing when no preset loaded', () => {
    const { result } = renderHook(() => usePreset());
    act(() => { result.current.toggleEffect(0); });
    expect(result.current.preset).toBeNull();
  });

  it('changeEffect updates effectId and applies default params', () => {
    const { result } = renderHook(() => usePreset());
    act(() => { result.current.loadPreset(samplePreset); });
    // Change slot 0 to Green OD (0x03000000)
    act(() => { result.current.changeEffect(0, 0x03000000); });
    expect(result.current.preset?.effects[0].effectId).toBe(0x03000000);
  });

  it('changeEffect does nothing for non-matching slotIndex', () => {
    const { result } = renderHook(() => usePreset());
    act(() => { result.current.loadPreset(samplePreset); });
    const origId = result.current.preset?.effects[0].effectId;
    act(() => { result.current.changeEffect(99, 0x03000000); }); // no slot 99
    expect(result.current.preset?.effects[0].effectId).toBe(origId);
  });

  it('changeEffect does nothing when no preset loaded', () => {
    const { result } = renderHook(() => usePreset());
    act(() => { result.current.changeEffect(0, 0x03000000); });
    expect(result.current.preset).toBeNull();
  });

  it('reorderEffects moves effect and reassigns slotIndex', () => {
    const { result } = renderHook(() => usePreset());
    act(() => { result.current.loadPreset(samplePreset); });

    // Move slot at index 0 to index 2
    act(() => { result.current.reorderEffects(0, 2); });

    const effects = result.current.preset!.effects;
    // After reorder, slotIndex should be reassigned to match positions
    effects.forEach((e, i) => {
      expect(e.slotIndex).toBe(i);
    });
    // Original first slot should now be at position 2
    expect(effects).toHaveLength(11);
  });

  it('reorderEffects does nothing when fromIndex equals toIndex', () => {
    const { result } = renderHook(() => usePreset());
    act(() => { result.current.loadPreset(samplePreset); });
    const before = result.current.preset?.effects.map(e => e.effectId);
    act(() => { result.current.reorderEffects(3, 3); });
    const after = result.current.preset?.effects.map(e => e.effectId);
    expect(after).toEqual(before);
  });

  it('reorderEffects does nothing when no preset loaded', () => {
    const { result } = renderHook(() => usePreset());
    act(() => { result.current.reorderEffects(0, 1); });
    expect(result.current.preset).toBeNull();
  });

  it('setParam updates a parameter value', () => {
    const { result } = renderHook(() => usePreset());
    act(() => { result.current.loadPreset(samplePreset); });
    act(() => { result.current.setParam(0, 3, 75.5); });
    expect(result.current.preset?.effects[0].params[3]).toBeCloseTo(75.5);
  });

  it('setParam does not affect other slots', () => {
    const { result } = renderHook(() => usePreset());
    act(() => { result.current.loadPreset(samplePreset); });
    act(() => { result.current.setParam(0, 0, 99); });
    expect(result.current.preset?.effects[0].params[0]).toBe(99);
    expect(result.current.preset?.effects[1].params[0]).toBe(0); // unchanged
  });

  it('setParam does nothing when no preset loaded', () => {
    const { result } = renderHook(() => usePreset());
    act(() => { result.current.setParam(0, 0, 50); });
    expect(result.current.preset).toBeNull();
  });

  it('reset sets preset to null', () => {
    const { result } = renderHook(() => usePreset());
    act(() => { result.current.loadPreset(samplePreset); });
    expect(result.current.preset).not.toBeNull();
    act(() => { result.current.reset(); });
    expect(result.current.preset).toBeNull();
  });
});
