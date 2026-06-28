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

    // Per block, params go 0..N then param 0 is re-sent at the end (see the
    // param-0 test below). Both passes do this. So for block 0 ([5,6]) each pass
    // emits 0,1,0 and for block 1 ([7]) each pass emits 0,0.
    const paramEvents = nonSleep.filter((e) => e.startsWith('param:'));
    expect(paramEvents).toEqual([
      'param:0:0:5', 'param:0:1:6', 'param:0:0:5', // block 0, pass 1 (+ re-send p0)
      'param:1:0:7', 'param:1:0:7',                // block 1, pass 1 (+ re-send p0)
      'param:0:0:5', 'param:0:1:6', 'param:0:0:5', // block 0, pass 2
      'param:1:0:7', 'param:1:0:7',                // block 1, pass 2
    ]);

    // The whole second pass must come AFTER every effect-change and toggle,
    // i.e. once all algorithms are loaded and settled.
    const lastToggleIdx = nonSleep.map((e) => e.startsWith('toggle:')).lastIndexOf(true);
    const afterToggles = nonSleep.slice(lastToggleIdx + 1);
    expect(afterToggles.filter((e) => e.startsWith('param:'))).toEqual([
      'param:0:0:5', 'param:0:1:6', 'param:0:0:5', 'param:1:0:7', 'param:1:0:7',
    ]);
    expect(afterToggles.some((e) => e.startsWith('fx:') || e.startsWith('toggle:'))).toBe(false);
  });

  it('re-sends param 0 at the end of each block so it is never the swallowed first message', async () => {
    const { events, sender, sleep } = makeRecorder();
    await pushPresetToDevice(twoBlockPreset(), sender, { sleep });
    const nonSleep = events.filter((e) => !e.startsWith('sleep:'));

    // The device swallows the FIRST param-change of a block's burst (it opens the
    // block's edit context), so param 0 — always sent first — never lands unless
    // re-sent. Within block 0's pass-1 params, the sequence must be 0,1,0.
    const fx0 = nonSleep.indexOf('fx:0:17');
    const toggle0 = nonSleep.indexOf('toggle:0:true');
    const block0Params = nonSleep.slice(fx0 + 1, toggle0);
    expect(block0Params).toEqual(['param:0:0:5', 'param:0:1:6', 'param:0:0:5']);
    // ...and the last param of that block's burst is param 0 (not param 1).
    expect(block0Params[block0Params.length - 1]).toBe('param:0:0:5');
  });

  it('spaces consecutive param writes by 40ms so the device does not drop the burst (#80)', async () => {
    const { events, sender, sleep } = makeRecorder();
    await pushPresetToDevice(twoBlockPreset(), sender, { sleep });

    // Real USB captures show the GP-200 never receives two *different* params
    // closer than ~124ms, and even same-target knob sweeps never go below ~19ms.
    // Our former 8ms burst is a pattern the device never sees in the wild — it
    // swallows it. Each param write is now followed by a 40ms gap by default,
    // comfortably above the device's processing window (#80).
    events.forEach((e, i) => {
      if (e.startsWith('param:')) {
        expect(events[i + 1]).toBe('sleep:40');
      }
    });
  });

  it('sends the author last, after both param passes', async () => {
    const { events, sender, sleep } = makeRecorder();
    await pushPresetToDevice(twoBlockPreset(), sender, { sleep });
    const nonSleep = events.filter((e) => !e.startsWith('sleep:'));
    expect(nonSleep[nonSleep.length - 1]).toBe('author:Tester');
  });
});
