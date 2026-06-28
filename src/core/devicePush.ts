import type { GP200Preset } from './types';

/**
 * The subset of useMidiSend the live-push sequence needs. Kept as a narrow
 * interface so the sequence is unit-testable with a recording fake.
 */
export interface PresetPushSender {
  sendEffectChange: (blockIndex: number, effectId: number) => void;
  sendParamChange: (blockIndex: number, paramIndex: number, effectId: number, value: number) => void;
  sendToggle: (blockIndex: number, enabled: boolean) => void;
  sendAuthor: (author: string) => void;
}

export interface PresetPushOptions {
  /** ms to wait after an effect change before writing that block's params */
  effectChangeSettleMs?: number;
  /** ms between consecutive param writes */
  interParamDelayMs?: number;
  /** ms after a block's toggle before moving on to the next block */
  interBlockDelayMs?: number;
  /** Injectable sleep — overridden in tests to record timing without waiting. */
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Live-preview push: send a freshly-loaded preset to the connected GP-200
 * without saving it to a slot.
 *
 * Order per block matters: effect TYPE first (sub=0x14), then params (sub=0x18),
 * then the on/off state (sub=0x10). Without the effect change the device keeps
 * whatever algorithm it had and every param/toggle lands on the wrong effect (#80).
 *
 * #80 follow-up: a fixed settle alone cannot win the race. A param write targets
 * a parameter *inside* the algorithm the effect-change just selected; if it
 * arrives before the device finished loading that algorithm it is dropped and
 * the default value remains. Load time is variable — the simplest effect (EQ)
 * was ready right at 250ms (lost only its first param), complex algorithms
 * (amp/chorus/reverb) need longer (lost most params). Two defences:
 *   1. settle 400ms after each effect change (was 250).
 *   2. a SECOND param pass after every block is configured — by then all 11
 *      algorithms are loaded and settled, so any write that raced a still-
 *      loading block in pass 1 lands for sure on the re-send.
 */
export async function pushPresetToDevice(
  decoded: GP200Preset,
  sender: PresetPushSender,
  options: PresetPushOptions = {},
): Promise<void> {
  const settle = options.effectChangeSettleMs ?? 400;
  // 40ms between param writes. USB captures of real device/editor traffic show
  // the GP-200 never receives two *different* params closer than ~124ms apart,
  // and even same-target knob sweeps never drop below ~19ms. Our former 8ms
  // burst is a cadence the device never sees in the wild and it swallows it
  // (the dropped first-param-of-block was the #80 symptom). 40ms sits clear of
  // the device's processing window while keeping a full load reasonably fast.
  const paramGap = options.interParamDelayMs ?? 40;
  const blockGap = options.interBlockDelayMs ?? 10;
  const sleep = options.sleep ?? defaultSleep;

  const sendBlockParams = async (i: number, eff: GP200Preset['effects'][number]) => {
    for (let p = 0; p < eff.params.length; p++) {
      if (eff.params[p] !== undefined) {
        sender.sendParamChange(i, p, eff.effectId, eff.params[p]);
        await sleep(paramGap);
      }
    }
    // Re-send param 0 at the end of the block's burst. The device swallows the
    // FIRST param-change of a block (it opens the block's edit context), so
    // param 0 — always sent first — never lands during a load, even though the
    // identical message works when sent alone (manual knob edit). Re-sending it
    // after the others, when the context is already open, makes it stick (#80).
    if (eff.params.length > 0 && eff.params[0] !== undefined) {
      sender.sendParamChange(i, 0, eff.effectId, eff.params[0]);
      await sleep(paramGap);
    }
  };

  // Pass 1: per block — effect type, settle, params, toggle.
  for (let i = 0; i < decoded.effects.length; i++) {
    const eff = decoded.effects[i];
    sender.sendEffectChange(i, eff.effectId);
    await sleep(settle);
    await sendBlockParams(i, eff);
    sender.sendToggle(i, eff.enabled);
    await sleep(blockGap);
  }

  // Pass 2: every algorithm is loaded now — re-send all params so writes that
  // raced a still-loading block in pass 1 are applied (#80).
  for (let i = 0; i < decoded.effects.length; i++) {
    await sendBlockParams(i, decoded.effects[i]);
  }

  if (decoded.author) sender.sendAuthor(decoded.author);
}
