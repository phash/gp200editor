'use client';
import { useState, useRef, useCallback, useEffect } from 'react';
import { SysExCodec } from '@/core/SysExCodec';
import type { GP200Preset } from '@/core/types';

const READ_TIMEOUT_MS = 3000;

function isSysEx(data: Uint8Array, cmd: number, sub: number): boolean {
  return (
    data.length > 10 &&
    data[0] === 0xF0 &&
    data[1] === 0x21 && data[2] === 0x25 && data[3] === 0x7E &&
    data[4] === 0x47 && data[5] === 0x50 && data[6] === 0x2D && data[7] === 0x32 &&
    data[8] === cmd && data[9] === sub
  );
}

/** Safely extract a Uint8Array from a MIDI message event's data field.
 *  The real MIDIMessageEvent.data is Uint8Array; our mock also passes a Uint8Array. */
function getBytes(data: unknown): Uint8Array {
  if (data instanceof Uint8Array) return data;
  if (data instanceof DataView) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  return new Uint8Array(data as ArrayBuffer);
}

export interface UseMidiDeviceReturn {
  status: 'disconnected' | 'connecting' | 'handshaking' | 'connected' | 'error';
  handshakeStep: string | null;
  errorMessage: string | null;
  deviceName: string | null;
  currentSlot: number | null;
  presetNames: (string | null)[];
  namesLoadProgress: number;
  deviceInfo: { deviceType: number; firmwareValues: number[]; versionAccepted: boolean } | null;
  currentPreset: GP200Preset | null;
  assignments: { section: number; page: number; block: number; name: string; rawData: Uint8Array }[];

  connect: () => Promise<void>;
  disconnect: () => void;
  loadPresetNames: () => Promise<void>;
  pullPreset: (slot: number) => Promise<GP200Preset>;
  pushPreset: (preset: GP200Preset, slot: number) => Promise<void>;
  writePresetToSlot: (preset: GP200Preset, slot: number) => Promise<void>;
  saveToSlot: (presetName: string) => void;
  sendToggle: (blockIndex: number, enabled: boolean) => void;
  sendParamChange: (blockIndex: number, paramIndex: number, effectId: number, value: number) => void;
  sendReorder: (order: number[]) => void;
  sendSlotChange: (slot: number) => void;
  sendAuthor: (author: string) => void;
  sendStyleName: (styleName: string) => void;
  sendNote: (note: string) => void;
  setOnDeviceChange: (cb: (() => void) | null) => void;
}

// Minimal shape we actually use — avoids conflicts with DOM's MIDIInput / MIDIOutput
interface GP200Input {
  name: string | null;
  onmidimessage: ((event: { data: unknown }) => void) | null;
}
interface GP200Output {
  send: (data: Uint8Array | number[]) => void;
}
interface GP200Access {
  inputs: { values: () => Iterable<GP200Input> };
  outputs: { values: () => Iterable<GP200Output> };
}

function waitForResponse(
  input: GP200Input,
  match: (data: Uint8Array) => boolean,
  timeoutMs: number,
  baseHandler: (event: { data: unknown }) => void,
): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      input.onmidimessage = baseHandler;
      reject(new Error('Response timeout'));
    }, timeoutMs);
    input.onmidimessage = (event: { data: unknown }) => {
      const data = getBytes(event.data);
      baseHandler(event);
      if (match(data)) {
        clearTimeout(timer);
        input.onmidimessage = baseHandler;
        resolve(data);
      }
    };
  });
}

function collectChunks(
  input: GP200Input,
  cmd: number,
  sub: number,
  expectedCount: number,
  timeoutMs: number,
  baseHandler: (event: { data: unknown }) => void,
): Promise<Uint8Array[]> {
  return new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    const timer = setTimeout(() => {
      input.onmidimessage = baseHandler;
      reject(new Error('Chunk collection timeout'));
    }, timeoutMs);
    input.onmidimessage = (event: { data: unknown }) => {
      const data = getBytes(event.data);
      baseHandler(event);
      if (isSysEx(data, cmd, sub)) {
        chunks.push(new Uint8Array(data));
        if (chunks.length === expectedCount) {
          clearTimeout(timer);
          input.onmidimessage = baseHandler;
          resolve(chunks);
        }
      }
    };
  });
}

export function useMidiDevice(): UseMidiDeviceReturn {
  const [status, setStatus] = useState<UseMidiDeviceReturn['status']>('disconnected');
  const [handshakeStep, setHandshakeStep] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [currentSlot, setCurrentSlot] = useState<number | null>(null);
  const [presetNames, setPresetNames] = useState<(string | null)[]>(new Array(256).fill(null));
  const [namesLoadProgress, setNamesLoadProgress] = useState(0);
  const [deviceInfo, setDeviceInfo] = useState<UseMidiDeviceReturn['deviceInfo']>(null);
  const [currentPreset, setCurrentPreset] = useState<GP200Preset | null>(null);
  const wasConnectedRef = useRef(false);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const [assignments, setAssignments] = useState<UseMidiDeviceReturn['assignments']>([]);

  const outputRef          = useRef<GP200Output | null>(null);
  const inputRef           = useRef<GP200Input | null>(null);
  const presetNamesRef     = useRef<(string | null)[]>(new Array(256).fill(null));
  const namesLoadAbortRef  = useRef<boolean>(false);

  // Callback for device-initiated changes (slot switch, effect toggle, param change)
  // Set by the editor to trigger a re-pull when the device state changes
  const onDeviceChangeRef = useRef<(() => void) | null>(null);

  const onMidiMessage = useCallback((event: { data: unknown }) => {
    const data = getBytes(event.data);
    // sub=0x08 D→H: device changed slot or ACK
    if (isSysEx(data, 0x12, 0x08) && data.length >= 28) {
      const slot = data[26];
      if (slot >= 0 && slot < 256) {
        console.log(`[GP-200] device slot change: ${slot} (${SysExCodec.slotToLabel(slot)})`);
        setCurrentSlot(slot);
        onDeviceChangeRef.current?.();
      }
    }
    // sub=0x0C D→H: effect change response
    if (isSysEx(data, 0x12, 0x0C)) {
      console.log('[GP-200] device effect change');
      onDeviceChangeRef.current?.();
    }
    // sub=0x10 D→H: toggle response (device-initiated)
    if (isSysEx(data, 0x12, 0x10) && data.length >= 42) {
      console.log('[GP-200] device toggle change');
      onDeviceChangeRef.current?.();
    }
  }, []);

  const connect = useCallback(async () => {
    setStatus('connecting');
    setErrorMessage(null);
    try {
      if (!('requestMIDIAccess' in navigator)) {
        throw new Error('Web MIDI API not supported in this browser');
      }
      const access = await (
        navigator as unknown as {
          requestMIDIAccess: (opts: { sysex: boolean }) => Promise<GP200Access>;
        }
      ).requestMIDIAccess({ sysex: true });

      const output = Array.from(access.outputs.values()).find(p => {
        // name can be string | null on real MIDIPort
        const n = p as unknown as { name: string | null };
        return typeof n.name === 'string' && n.name.includes('GP-200');
      }) ?? null;
      const input = Array.from(access.inputs.values()).find(p => {
        const n = p as unknown as { name: string | null };
        return typeof n.name === 'string' && n.name.includes('GP-200');
      }) ?? null;

      if (!output || !input) {
        throw new Error('GP-200 not found in MIDI ports');
      }

      outputRef.current = output;
      inputRef.current  = input;
      input.onmidimessage = onMidiMessage;
      setDeviceName(input.name);
      setStatus('handshaking');
      setHandshakeStep(null);

      // --- Handshake sequence ---
      try {
        // Step 1-2: Identity
        setHandshakeStep('Identity…');
        output.send(SysExCodec.buildIdentityQuery());
        const identityMsg = await waitForResponse(
          input, (d) => isSysEx(d, 0x12, 0x08), READ_TIMEOUT_MS, onMidiMessage
        );
        const identity = SysExCodec.parseIdentityResponse(identityMsg);

        // Step 3-4: Enter editor mode
        setHandshakeStep('Editor Mode…');
        output.send(SysExCodec.buildEnterEditorMode());
        await new Promise(r => setTimeout(r, 100));

        // Step 5-6: State dump (0x4E has different format — only extract slot number)
        setHandshakeStep('State Dump…');
        output.send(SysExCodec.buildStateDumpRequest());
        const dumpChunks = await collectChunks(input, 0x12, 0x4E, 5, READ_TIMEOUT_MS, onMidiMessage);
        const { slot } = SysExCodec.parseStateDump(dumpChunks);
        setCurrentSlot(slot);

        // Step 7-8: Version check
        setHandshakeStep('Firmware Check…');
        output.send(SysExCodec.buildVersionCheck());
        const versionMsg = await waitForResponse(
          input, (d) => isSysEx(d, 0x12, 0x0A), READ_TIMEOUT_MS, onMidiMessage
        );
        const { accepted } = SysExCodec.parseVersionResponse(versionMsg);
        setDeviceInfo({ ...identity, versionAccepted: accepted });

        // Step 9: Assignment polling (non-critical, short timeout, bail on first failure)
        setHandshakeStep('Controller…');
        const ASSIGN_TIMEOUT = 300;
        const assignmentEntries: UseMidiDeviceReturn['assignments'] = [];
        const assignmentPlan = [
          { section: 0, pages: [[0, 16], [1, 4]] },
          { section: 1, pages: [[0, 10]] },
        ];
        let assignFailed = false;
        for (const { section, pages } of assignmentPlan) {
          if (assignFailed) break;
          for (const [page, blockCount] of pages) {
            if (assignFailed) break;
            for (let block = 0; block < blockCount; block++) {
              try {
                output.send(SysExCodec.buildAssignmentQuery(section, page, block));
                const resp = await waitForResponse(
                  input, (d) => isSysEx(d, 0x12, 0x1C), ASSIGN_TIMEOUT, onMidiMessage
                );
                assignmentEntries.push(SysExCodec.parseAssignmentResponse(resp, section, page));
              } catch {
                assignFailed = true; break; // bail on first failure — device unresponsive
              }
            }
          }
        }
        setAssignments(assignmentEntries);

        // Step 10: Pull current preset + bank (4 slots) via normal read
        const bankBase = Math.floor(slot / 4) * 4;
        const bankPresets: (GP200Preset | null)[] = [null, null, null, null];
        for (let i = 0; i < 4; i++) {
          const s = bankBase + i;
          const label = SysExCodec.slotToLabel(s);
          setHandshakeStep(`Slot ${label}…`);
          try {
            output.send(SysExCodec.buildReadRequest(s));
            const chunks = await collectChunks(input, 0x12, 0x18, 7, READ_TIMEOUT_MS, onMidiMessage);
            const p = SysExCodec.parseReadChunks(chunks);
            bankPresets[i] = p;
            setHandshakeStep(`Slot ${label} · ${p.patchName}`);
            if (s === slot) setCurrentPreset(p);
            // Cache the name
            presetNamesRef.current[s] = p.patchName;
          } catch {
            setHandshakeStep(`Slot ${label} · –`);
          }
          await new Promise(r => setTimeout(r, 20));
        }
        setPresetNames([...presetNamesRef.current]);

        // Step 11: Done
        setHandshakeStep(null);
        setStatus('connected');
      } catch (err) {
        setStatus('error');
        setErrorMessage(err instanceof Error ? err.message : 'Handshake failed');
      }
    } catch (err) {
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'Connection failed');
    }
  }, [onMidiMessage]);

  const disconnect = useCallback(() => {
    namesLoadAbortRef.current = true;
    if (inputRef.current) inputRef.current.onmidimessage = null;
    outputRef.current = null;
    inputRef.current  = null;
    setStatus('disconnected');
    setDeviceName(null);
    setCurrentSlot(null);
    setErrorMessage(null);
    setDeviceInfo(null);
    setCurrentPreset(null);
    setAssignments([]);
  }, []);

  const pullPreset = useCallback((slot: number): Promise<GP200Preset> => {
    return new Promise((resolve, reject) => {
      if (!outputRef.current || !inputRef.current) {
        reject(new Error('Not connected'));
        return;
      }
      const chunks: Uint8Array[] = [];
      let attempts = 0;
      let timer: ReturnType<typeof setTimeout>;

      function tryRequest() {
        chunks.length = 0;
        timer = setTimeout(() => {
          if (attempts < 1) {
            attempts++;
            tryRequest();
          } else {
            if (inputRef.current) inputRef.current.onmidimessage = onMidiMessage;
            setStatus('error');
            setErrorMessage('Read timeout');
            reject(new Error('Read timeout'));
          }
        }, READ_TIMEOUT_MS);

        if (inputRef.current) {
          inputRef.current.onmidimessage = (event: { data: unknown }) => {
            const data = getBytes(event.data);
            console.log('[GP-200] pull rx:', Array.from(data).map(b => b.toString(16).padStart(2,'0')).join(' '));
            onMidiMessage(event);
            // data[10] is the device's current slot, NOT the requested slot
            if (isSysEx(data, 0x12, 0x18)) {
              chunks.push(data);
              if (chunks.length === 7) {
                clearTimeout(timer);
                if (inputRef.current) inputRef.current.onmidimessage = onMidiMessage;
                try { resolve(SysExCodec.parseReadChunks(chunks)); }
                catch (e) { reject(e); }
              }
            }
          };
        }

        const req = SysExCodec.buildReadRequest(slot);
        console.log('[GP-200] pull tx:', Array.from(req).map(b => b.toString(16).padStart(2,'0')).join(' '));
        outputRef.current!.send(req);
      }

      tryRequest();
    });
  }, [onMidiMessage]);

  const pushPreset = useCallback(async (preset: GP200Preset, slot: number): Promise<void> => {
    if (!outputRef.current) throw new Error('Not connected');
    console.log(`[GP-200] push: slot=${slot} (${SysExCodec.slotToLabel(slot)}) name="${preset.patchName}"`);

    // Step 1: Send 4 write chunks (blocks 0-8 partial, 732 bytes decoded)
    // Write chunks go directly to flash storage for the target slot.
    // Captured Valeton flow: write chunks only, NO save-commit after (save-commit
    // overwrites flash with the editing buffer, discarding write chunk data).
    const chunks = SysExCodec.buildWriteChunks(preset, slot);
    for (let i = 0; i < chunks.length; i++) {
      console.log(`[GP-200] push chunk ${i+1}/${chunks.length}: ${chunks[i].length}B`);
      outputRef.current.send(chunks[i]);
      await new Promise(r => setTimeout(r, 20));
    }

    // Step 2: Wait for device to process write chunks, then switch to the slot
    await new Promise(r => setTimeout(r, 150));
    const commitMsg = SysExCodec.buildPresetChange(slot);
    console.log(`[GP-200] push preset-change: slot=${slot}`);
    outputRef.current.send(commitMsg);

    // Update local state
    presetNamesRef.current[slot] = preset.patchName;
    setPresetNames([...presetNamesRef.current]);
    setCurrentSlot(slot);

    console.log('[GP-200] push complete');
  }, []);

  const saveToSlot = useCallback((presetName: string) => {
    if (!outputRef.current) return;
    // Save-commit persists the device's current editing buffer to flash.
    // Live edits (toggle, param, reorder) already updated the editing buffer.
    // This is the same flow as the Valeton software: edit → save-commit.
    const msg = SysExCodec.buildSaveCommit(presetName);
    console.log(`[GP-200] save-commit: name="${presetName}"`);
    outputRef.current.send(msg);
  }, []);

  const writePresetToSlot = useCallback(async (preset: GP200Preset, slot: number): Promise<void> => {
    if (!outputRef.current) throw new Error('Not connected');
    const output = outputRef.current;
    const label = SysExCodec.slotToLabel(slot);
    console.log(`[GP-200] writeToSlot: slot=${slot} (${label}) name="${preset.patchName}"`);

    // Step 1: Switch device to the target slot (loads current data into editing buffer)
    output.send(SysExCodec.buildPresetChange(slot));
    await new Promise(r => setTimeout(r, 200));

    // Step 2: Send all effects via live editing (toggle + params for each slot)
    // Note: this can modify params and toggle state but NOT change effect IDs.
    // Effect IDs require buildEffectChange (sub=0x14) which is not yet implemented.
    for (const eff of preset.effects) {
      output.send(SysExCodec.buildToggleEffect(eff.slotIndex, eff.enabled));
      await new Promise(r => setTimeout(r, 15));
      for (let p = 0; p < eff.params.length; p++) {
        if (eff.params[p] !== undefined) {
          output.send(SysExCodec.buildParamChange(eff.slotIndex, p, eff.effectId, eff.params[p]));
          await new Promise(r => setTimeout(r, 8));
        }
      }
    }

    // Step 3: Send author + save-commit to persist
    await new Promise(r => setTimeout(r, 50));
    if (preset.author) {
      output.send(SysExCodec.buildAuthorName(preset.author));
      await new Promise(r => setTimeout(r, 30));
    }
    output.send(SysExCodec.buildSaveCommit(preset.patchName));
    // Wait for device to finish writing to flash before returning
    await new Promise(r => setTimeout(r, 300));
    console.log(`[GP-200] writeToSlot complete: ${label} → "${preset.patchName}"`);

    // Update local state
    presetNamesRef.current[slot] = preset.patchName;
    setPresetNames([...presetNamesRef.current]);
    setCurrentSlot(slot);
  }, []);

  const loadPresetNames = useCallback(async (): Promise<void> => {
    if (!outputRef.current || !inputRef.current) return;
    namesLoadAbortRef.current = false;
    const NAME_TIMEOUT = 500; // 500ms per slot (device responds in ~20ms normally)
    const BATCH_SIZE = 8;     // Update UI every 8 slots instead of every slot

    for (let s = 0; s < 256; s++) {
      if (namesLoadAbortRef.current) break;
      if (presetNamesRef.current[s] !== null) {
        setNamesLoadProgress(s + 1);
        continue;
      }
      const name = await new Promise<string | null>((resolve) => {
        const slotNum = s;
        const timer = setTimeout(() => {
          if (inputRef.current) inputRef.current.onmidimessage = onMidiMessage;
          resolve(null);
        }, NAME_TIMEOUT);
        if (inputRef.current) {
          inputRef.current.onmidimessage = (event: { data: unknown }) => {
            const data = getBytes(event.data);
            onMidiMessage(event);
            if (isSysEx(data, 0x12, 0x18)) {
              const off = data[11] | (data[12] << 8);
              if (off === 0) {
                clearTimeout(timer);
                if (inputRef.current) inputRef.current.onmidimessage = onMidiMessage;
                resolve(SysExCodec.parsePresetName(data));
              }
            }
          };
        }
        outputRef.current!.send(SysExCodec.buildReadRequest(slotNum));
      });
      if (namesLoadAbortRef.current) break;
      presetNamesRef.current[s] = name;
      // Batch UI updates: only re-render every BATCH_SIZE slots or on the last slot
      if ((s + 1) % BATCH_SIZE === 0 || s === 255) {
        setPresetNames([...presetNamesRef.current]);
      }
      setNamesLoadProgress(s + 1);
    }
    // Final flush in case we stopped mid-batch
    setPresetNames([...presetNamesRef.current]);
    if (inputRef.current) inputRef.current.onmidimessage = onMidiMessage;
  }, [onMidiMessage]);

  const sendToggle = useCallback((blockIndex: number, enabled: boolean) => {
    if (!outputRef.current) return;
    const msg = SysExCodec.buildToggleEffect(blockIndex, enabled);
    console.log(`[GP-200] toggle: block=${blockIndex} enabled=${enabled}`);
    outputRef.current.send(msg);
  }, []);

  const sendParamChange = useCallback((blockIndex: number, paramIndex: number, effectId: number, value: number) => {
    if (!outputRef.current) return;
    const msg = SysExCodec.buildParamChange(blockIndex, paramIndex, effectId, value);
    outputRef.current.send(msg);
  }, []);

  const sendReorder = useCallback((order: number[]) => {
    if (!outputRef.current) return;
    const msg = SysExCodec.buildReorderEffects(order);
    console.log('[GP-200] reorder:', order);
    outputRef.current.send(msg);
  }, []);

  const sendSlotChange = useCallback((slot: number) => {
    if (!outputRef.current) return;
    // sub=0x08 with slot at byte[26] — confirmed via capture 222343
    const msg = SysExCodec.buildPresetChange(slot);
    console.log(`[GP-200] slot change: ${slot} (${SysExCodec.slotToLabel(slot)})`);
    outputRef.current.send(msg);
    setCurrentSlot(slot);
  }, []);

  const sendAuthor = useCallback((author: string) => {
    if (!outputRef.current) return;
    const msg = SysExCodec.buildAuthorName(author);
    console.log(`[GP-200] author: "${author}"`);
    outputRef.current.send(msg);
  }, []);

  const sendStyleName = useCallback((styleName: string) => {
    if (!outputRef.current) return;
    const msg = SysExCodec.buildStyleName(styleName);
    console.log(`[GP-200] style: "${styleName}"`);
    outputRef.current.send(msg);
  }, []);

  const sendNote = useCallback((note: string) => {
    if (!outputRef.current) return;
    const msg = SysExCodec.buildNote(note);
    console.log(`[GP-200] note: "${note}"`);
    outputRef.current.send(msg);
  }, []);

  // Track connection state for auto-reconnect
  useEffect(() => {
    if (status === 'connected') {
      wasConnectedRef.current = true;
      reconnectAttemptsRef.current = 0;
    }
  }, [status]);

  // Auto-reconnect when connection drops (USB replug, page navigation)
  useEffect(() => {
    if (status === 'disconnected' && wasConnectedRef.current && reconnectAttemptsRef.current < 3) {
      reconnectTimerRef.current = setTimeout(() => {
        reconnectAttemptsRef.current++;
        console.log(`[GP-200] auto-reconnect attempt ${reconnectAttemptsRef.current}/3`);
        connect();
      }, 2000);
    }
    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    };
  }, [status, connect]);

  return {
    status, handshakeStep, errorMessage, deviceName, currentSlot, presetNames, namesLoadProgress,
    deviceInfo, currentPreset, assignments,
    connect, disconnect, loadPresetNames, pullPreset, pushPreset, writePresetToSlot, saveToSlot,
    sendToggle, sendParamChange, sendReorder, sendSlotChange,
    sendAuthor, sendStyleName, sendNote,
    setOnDeviceChange: (cb: (() => void) | null) => { onDeviceChangeRef.current = cb; },
  };
}
