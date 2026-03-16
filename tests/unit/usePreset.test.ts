import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePreset } from '@/hooks/usePreset';

const samplePreset = {
  version: '1',
  patchName: 'Alt',
  effects: [],
  checksum: 0,
};

describe('usePreset', () => {
  it('initial state ist null', () => {
    const { result } = renderHook(() => usePreset());
    expect(result.current.preset).toBeNull();
  });

  it('setPatchName aktualisiert den Patch-Namen', () => {
    const { result } = renderHook(() => usePreset());
    act(() => { result.current.loadPreset(samplePreset); });
    act(() => { result.current.setPatchName('Neu'); });
    expect(result.current.preset?.patchName).toBe('Neu');
  });

  it('toggleEffect wechselt den enabled-Status eines Slots', () => {
    const presetWithSlot = {
      ...samplePreset,
      effects: [{ slotIndex: 0, effectId: 1, enabled: false, params: [] }],
    };
    const { result } = renderHook(() => usePreset());
    act(() => { result.current.loadPreset(presetWithSlot); });
    act(() => { result.current.toggleEffect(0); });
    expect(result.current.preset?.effects[0].enabled).toBe(true);
    act(() => { result.current.toggleEffect(0); });
    expect(result.current.preset?.effects[0].enabled).toBe(false);
  });

  it('reset setzt das Preset auf null', () => {
    const { result } = renderHook(() => usePreset());
    act(() => { result.current.loadPreset(samplePreset); });
    act(() => { result.current.reset(); });
    expect(result.current.preset).toBeNull();
  });
});
