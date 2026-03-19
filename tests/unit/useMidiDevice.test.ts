// tests/unit/useMidiDevice.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useMidiDevice } from '@/hooks/useMidiDevice';

// Mock Web MIDI API
type MIDIMessageHandler = (event: { data: Uint8Array }) => void;

function makeMockMidi() {
  const inputHandlers: MIDIMessageHandler[] = [];
  const mockInput = {
    name: 'GP-200 MIDI 1',
    set onmidimessage(handler: MIDIMessageHandler | null) {
      if (handler) inputHandlers.push(handler);
    },
  };
  const sentMessages: Uint8Array[] = [];
  const mockOutput = {
    name: 'GP-200 MIDI 1',
    send: vi.fn((data: number[] | Uint8Array) => {
      sentMessages.push(new Uint8Array(data));
    }),
  };
  const access = {
    inputs: { values: () => [mockInput] },
    outputs: { values: () => [mockOutput] },
  };

  function emit(data: Uint8Array) {
    inputHandlers.forEach(h => h({ data }));
  }

  return { access, mockInput, mockOutput, sentMessages, emit };
}

describe('useMidiDevice', () => {
  let mockMidi: ReturnType<typeof makeMockMidi>;

  beforeEach(() => {
    mockMidi = makeMockMidi();
    vi.stubGlobal('navigator', {
      requestMIDIAccess: vi.fn().mockResolvedValue(mockMidi.access),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('initial status is disconnected', () => {
    const { result } = renderHook(() => useMidiDevice());
    expect(result.current.status).toBe('disconnected');
    expect(result.current.currentSlot).toBeNull();
    expect(result.current.deviceName).toBeNull();
  });

  it('connect() sets status to connecting then connected', async () => {
    const { result } = renderHook(() => useMidiDevice());
    await act(async () => {
      result.current.connect();
    });
    await waitFor(() => expect(result.current.status).toBe('connected'));
    expect(result.current.deviceName).toContain('GP-200');
  });

  it('connect() fails when no GP-200 found', async () => {
    vi.stubGlobal('navigator', {
      requestMIDIAccess: vi.fn().mockResolvedValue({
        inputs: { values: () => [] },
        outputs: { values: () => [] },
      }),
    });
    const { result } = renderHook(() => useMidiDevice());
    await act(async () => { result.current.connect(); });
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.errorMessage).toContain('GP-200');
  });

  it('connect() sets error when requestMIDIAccess is denied', async () => {
    vi.stubGlobal('navigator', {
      requestMIDIAccess: vi.fn().mockRejectedValue(new DOMException('Permission denied')),
    });
    const { result } = renderHook(() => useMidiDevice());
    await act(async () => { result.current.connect(); });
    await waitFor(() => expect(result.current.status).toBe('error'));
  });

  it('disconnect() resets to disconnected', async () => {
    const { result } = renderHook(() => useMidiDevice());
    await act(async () => { result.current.connect(); });
    await waitFor(() => expect(result.current.status).toBe('connected'));
    act(() => { result.current.disconnect(); });
    expect(result.current.status).toBe('disconnected');
  });

  it('parses currentSlot from sub=0x4E message', async () => {
    const { result } = renderHook(() => useMidiDevice());
    await act(async () => { result.current.connect(); });
    await waitFor(() => expect(result.current.status).toBe('connected'));

    // Emit a fake sub=0x4E with slot=9 at payload[1]
    const sysex4E = new Uint8Array([
      0xF0, 0x21, 0x25, 0x7E, 0x47, 0x50, 0x2D, 0x32,
      0x12, 0x4E,
      0x09, // slot = 9
      0x00, 0x00, // offset
      0xF7,
    ]);
    act(() => { mockMidi.emit(sysex4E); });
    expect(result.current.currentSlot).toBe(9);
  });

  it('connect() sends a read request (CMD=0x11) for the MIDI port', async () => {
    const { result } = renderHook(() => useMidiDevice());
    await act(async () => { result.current.connect(); });
    await waitFor(() => expect(result.current.status).toBe('connected'));
    // No request sent on connect — device auto-sends sub=0x4E
    // pullPreset sends the request:
    const SYSEX_HEADER = [0xF0, 0x21, 0x25, 0x7E, 0x47, 0x50, 0x2D, 0x32, 0x11, 0x10];
    let pullPromise: Promise<unknown>;
    act(() => {
      pullPromise = result.current.pullPreset(5);
    });
    await waitFor(() => {
      const sent = mockMidi.sentMessages;
      expect(sent.length).toBeGreaterThan(0);
      const req = sent[0];
      SYSEX_HEADER.forEach((b, i) => expect(req[i]).toBe(b));
      // Slot 5 nibble-encoded at [25-26]
      expect(req[25]).toBe(0x00);
      expect(req[26]).toBe(0x05);
    });
    // Clean up by aborting the pull (no chunks sent)
    pullPromise!.catch(() => {}); // ignore timeout error
  });
});
