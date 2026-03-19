'use client';
import { useState, useRef, useCallback } from 'react';
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
  sendToggle: (blockIndex: number, enabled: boolean) => void;
  sendParamChange: (blockIndex: number, paramIndex: number, effectId: number, value: number) => void;
  sendReorder: (order: number[]) => void;
  sendSlotChange: (slot: number) => void;
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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [currentSlot, setCurrentSlot] = useState<number | null>(null);
  const [presetNames, setPresetNames] = useState<(string | null)[]>(new Array(256).fill(null));
  const [namesLoadProgress, setNamesLoadProgress] = useState(0);
  const [deviceInfo, setDeviceInfo] = useState<UseMidiDeviceReturn['deviceInfo']>(null);
  const [currentPreset, setCurrentPreset] = useState<GP200Preset | null>(null);
  const [assignments, setAssignments] = useState<UseMidiDeviceReturn['assignments']>([]);

  const outputRef          = useRef<GP200Output | null>(null);
  const inputRef           = useRef<GP200Input | null>(null);
  const presetNamesRef     = useRef<(string | null)[]>(new Array(256).fill(null));
  const namesLoadAbortRef  = useRef<boolean>(false);

  const onMidiMessage = useCallback((event: { data: unknown }) => {
    const data = getBytes(event.data);
    // sub=0x4E: current slot notification
    if (isSysEx(data, 0x12, 0x4E)) {
      console.log('[GP-200] sub=0x4E raw:', Array.from(data).map(b => b.toString(16).padStart(2,'0')).join(' '));
      const slot = data[10];
      console.log('[GP-200] currentSlot candidate:', slot, '(byte 10)');
      if (slot >= 0 && slot < 256) setCurrentSlot(slot);
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

      // --- Handshake sequence ---
      try {
        // Step 1-2: Identity
        output.send(SysExCodec.buildIdentityQuery());
        const identityMsg = await waitForResponse(
          input, (d) => isSysEx(d, 0x12, 0x08), READ_TIMEOUT_MS, onMidiMessage
        );
        const identity = SysExCodec.parseIdentityResponse(identityMsg);

        // Step 3-4: Enter editor mode
        output.send(SysExCodec.buildEnterEditorMode());
        await new Promise(r => setTimeout(r, 100));

        // Step 5-6: State dump (0x4E has different format — only extract slot number)
        output.send(SysExCodec.buildStateDumpRequest());
        const dumpChunks = await collectChunks(input, 0x12, 0x4E, 5, READ_TIMEOUT_MS, onMidiMessage);
        const { slot } = SysExCodec.parseStateDump(dumpChunks);
        setCurrentSlot(slot);

        // Step 7-8: Version check
        output.send(SysExCodec.buildVersionCheck());
        const versionMsg = await waitForResponse(
          input, (d) => isSysEx(d, 0x12, 0x0A), READ_TIMEOUT_MS, onMidiMessage
        );
        const { accepted } = SysExCodec.parseVersionResponse(versionMsg);
        setDeviceInfo({ ...identity, versionAccepted: accepted });

        // Step 9: Assignment polling (non-critical, short timeout, skip on failure)
        const ASSIGN_TIMEOUT = 1000;
        const assignmentEntries: UseMidiDeviceReturn['assignments'] = [];
        const assignmentPlan = [
          { section: 0, pages: [[0, 16], [1, 4]] },
          { section: 1, pages: [[0, 10]] },
        ];
        for (const { section, pages } of assignmentPlan) {
          for (const [page, blockCount] of pages) {
            for (let block = 0; block < blockCount; block++) {
              try {
                output.send(SysExCodec.buildAssignmentQuery(section, page, block));
                const resp = await waitForResponse(
                  input, (d) => isSysEx(d, 0x12, 0x1C), ASSIGN_TIMEOUT, onMidiMessage
                );
                assignmentEntries.push(SysExCodec.parseAssignmentResponse(resp, section, page));
              } catch {
                // Skip failed assignment queries
              }
            }
          }
        }
        setAssignments(assignmentEntries);

        // Step 10: Pull current preset via normal read (0x4E format differs from stored preset)
        try {
          const readReq = SysExCodec.buildReadRequest(slot);
          output.send(readReq);
          const presetChunks = await collectChunks(input, 0x12, 0x18, 7, READ_TIMEOUT_MS, onMidiMessage);
          setCurrentPreset(SysExCodec.parseReadChunks(presetChunks));
        } catch {
          // Non-critical — user can still pull manually
        }

        // Step 11: Done
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
    const chunks = SysExCodec.buildWriteChunks(preset, slot);
    for (let i = 0; i < chunks.length; i++) {
      console.log(`[GP-200] push chunk ${i+1}/${chunks.length}: ${chunks[i].length}B, first 20: ${Array.from(chunks[i].slice(0, 20)).map(b => b.toString(16).padStart(2,'0')).join(' ')}`);
      outputRef.current.send(chunks[i]);
      await new Promise(r => setTimeout(r, 20));
    }
    // Send save-commit after write chunks (required to persist to flash)
    // From captures 100548/101538: sub=0x18 (name) + sub=0x08 (commit)
    await new Promise(r => setTimeout(r, 100)); // wait for device to process writes
    const saveMsg = SysExCodec.buildSaveCommit(preset.patchName);
    console.log(`[GP-200] push save-commit: ${saveMsg.length}B`);
    outputRef.current.send(saveMsg);
    await new Promise(r => setTimeout(r, 50));
    const commitMsg = SysExCodec.buildPresetChange(slot);
    console.log(`[GP-200] push preset-change: ${commitMsg.length}B`);
    outputRef.current.send(commitMsg);
    console.log('[GP-200] push complete');
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
    const msg = SysExCodec.buildPresetChange(slot);
    console.log(`[GP-200] slot change: ${slot} (${SysExCodec.slotToLabel(slot)})`);
    outputRef.current.send(msg);
    setCurrentSlot(slot);
  }, []);

  return {
    status, errorMessage, deviceName, currentSlot, presetNames, namesLoadProgress,
    deviceInfo, currentPreset, assignments,
    connect, disconnect, loadPresetNames, pullPreset, pushPreset,
    sendToggle, sendParamChange, sendReorder, sendSlotChange,
  };
}
