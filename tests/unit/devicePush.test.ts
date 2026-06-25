import { describe, it, expect } from 'vitest';
import { pushPresetToDevice, type PresetPushSender } from '@/core/devicePush';
import type { GP200Preset } from '@/core/types';

// Minimal recorder: logs every send and every sleep into one ordered array
// so we can assert both the message sequence and the settle timing.
function makeRecorder() {
  const events: string[] = [];
  const sender: PresetPushSender = {
    sendEffectChange: (b, e) => events.push(`fx:${b}:${e}`),
    sendParamChange: (b, p, _e, v) => events.push(`param:${b}:${p}:${v}`),
    sendToggle: (b, on) => events.push(`toggle:${b}:${on}`),
    sendAuthor: (a) => events.push(`author:${a}`),
  };
  const sleep = async (ms: number) => {
    events.push(`sleep:${ms}`);
  };
  return { events, sender, sleep };
}

// Two-block preset is enough to prove ordering across blocks.
function twoBlockPreset(): GP200Preset {
  return {
    effects: [
      { slotIndex: 0, enabled: true, effectId: 0x11, params: [5, 6] },
      { slotIndex: 1, enabled: false, effectId: 0x22, params: [7] },
    ],
    author: 'Tester',
  } as unknown as GP200Preset;
}

describe('pushPresetToDevice', () => {
  it('waits 400ms after each effect change before writing its params', async () => {
    const { events, sender, sleep } = makeRecorder();
    await pushPresetToDevice(twoBlockPreset(), sender, { sleep });

    // Every effect-change is immediately followed by a 400ms settle so the
    // device can finish loading the algorithm before any param write (#80).
    events.forEach((e, i) => {
      if (e.startsWith('fx:')) {
        expect(events[i + 1]).toBe('sleep:400');
      }
    });
  });

  it('re-sends every param in a second pass after all blocks are configured', async () => {
    const { events, sender, sleep } = makeRecorder();
    await pushPresetToDevice(twoBlockPreset(), sender, { sleep });

    const nonSleep = events.filter((e) => !e.startsWith('sleep:'));

    // Pass 1 sends fx + params + toggle per block; pass 2 re-sends only params.
    // Each param must therefore appear exactly twice.
    const paramEvents = nonSleep.filter((e) => e.startsWith('param:'));
    expect(paramEvents).toEqual([
      'param:0:0:5', 'param:0:1:6', // block 0, pass 1
      'param:1:0:7',                // block 1, pass 1
      'param:0:0:5', 'param:0:1:6', // block 0, pass 2
      'param:1:0:7',                // block 1, pass 2
    ]);

    // The whole second pass must come AFTER every effect-change and toggle,
    // i.e. once all algorithms are loaded and settled.
    const lastToggleIdx = nonSleep.map((e) => e.startsWith('toggle:')).lastIndexOf(true);
    const afterToggles = nonSleep.slice(lastToggleIdx + 1);
    expect(afterToggles.filter((e) => e.startsWith('param:'))).toEqual([
      'param:0:0:5', 'param:0:1:6', 'param:1:0:7',
    ]);
    expect(afterToggles.some((e) => e.startsWith('fx:') || e.startsWith('toggle:'))).toBe(false);
  });

  it('sends the author last, after both param passes', async () => {
    const { events, sender, sleep } = makeRecorder();
    await pushPresetToDevice(twoBlockPreset(), sender, { sleep });
    const nonSleep = events.filter((e) => !e.startsWith('sleep:'));
    expect(nonSleep[nonSleep.length - 1]).toBe('author:Tester');
  });
});
