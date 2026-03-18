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
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  errorMessage: string | null;
  deviceName: string | null;
  currentSlot: number | null;
  presetNames: (string | null)[];
  namesLoadProgress: number;

  connect: () => Promise<void>;
  disconnect: () => void;
  loadPresetNames: () => Promise<void>;
  pullPreset: (slot: number) => Promise<GP200Preset>;
  pushPreset: (preset: GP200Preset, slot: number) => Promise<void>;
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

export function useMidiDevice(): UseMidiDeviceReturn {
  const [status, setStatus] = useState<UseMidiDeviceReturn['status']>('disconnected');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [currentSlot, setCurrentSlot] = useState<number | null>(null);
  const [presetNames, setPresetNames] = useState<(string | null)[]>(new Array(256).fill(null));
  const [namesLoadProgress, setNamesLoadProgress] = useState(0);

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
      setStatus('connected');
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
            if (isSysEx(data, 0x12, 0x18) && data[10] === slot) {
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
    const chunks = SysExCodec.buildWriteChunks(preset, slot);
    for (const chunk of chunks) {
      outputRef.current.send(chunk);
      // Small delay between chunks to avoid MIDI buffer overflow
      await new Promise(r => setTimeout(r, 20));
    }
  }, []);

  const loadPresetNames = useCallback(async (): Promise<void> => {
    if (!outputRef.current || !inputRef.current) return;
    namesLoadAbortRef.current = false;
    for (let s = 0; s < 256; s++) {
      if (namesLoadAbortRef.current) break;
      // Skip already-loaded names (supports resuming interrupted loads)
      if (presetNamesRef.current[s] !== null) {
        setNamesLoadProgress(s + 1);
        continue;
      }
      const name = await new Promise<string | null>((resolve) => {
        const slotNum = s;
        const timer = setTimeout(() => resolve(null), READ_TIMEOUT_MS);
        if (inputRef.current) {
          inputRef.current.onmidimessage = (event: { data: unknown }) => {
            const data = getBytes(event.data);
            onMidiMessage(event);
            if (isSysEx(data, 0x12, 0x18) && data[10] === slotNum) {
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
      setPresetNames([...presetNamesRef.current]);
      setNamesLoadProgress(s + 1);
    }
    if (inputRef.current) inputRef.current.onmidimessage = onMidiMessage;
  }, [onMidiMessage]);

  return {
    status, errorMessage, deviceName, currentSlot, presetNames, namesLoadProgress,
    connect, disconnect, loadPresetNames, pullPreset, pushPreset,
  };
}
