// tests/unit/useMidiDevice.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useMidiDevice } from '@/hooks/useMidiDevice';

// Mock Web MIDI API
type MIDIMessageHandler = (event: { data: Uint8Array }) => void;

function makeMockMidi() {
  let currentHandler: MIDIMessageHandler | null = null;
  const mockInput = {
    name: 'GP-200 MIDI 1',
    get onmidimessage() { return currentHandler; },
    set onmidimessage(handler: MIDIMessageHandler | null) {
      currentHandler = handler;
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
    if (currentHandler) currentHandler({ data });
  }
  return { access, mockInput, mockOutput, sentMessages, emit };
}

function enableAutoHandshake(mock: ReturnType<typeof makeMockMidi>) {
  const origSend = mock.mockOutput.send.getMockImplementation()!;
  mock.mockOutput.send = vi.fn((data: number[] | Uint8Array) => {
    origSend(data);
    const d = new Uint8Array(data);
    // Identity query → identity response
    if (d[8] === 0x11 && d[9] === 0x04 && d[14] === 0x01) {
      setTimeout(() => mock.emit(new Uint8Array([
        0xF0,0x21,0x25,0x7E,0x47,0x50,0x2D,0x32,0x12,0x08,
        0x00,0x00,0x00,0x00,0x01,0x02,0x00,0x00,0x04,0x00,
        0x00,0x00,0x01,0x00,0x00,0x00,0x02,0x00,0x00,0xF7,
      ])), 1);
    }
    // State dump request → 5 minimal 0x4E chunks
    if (d[8] === 0x11 && d[9] === 0x04 && d[14] === 0x06) {
      setTimeout(() => {
        for (const off of [0, 313, 626, 1067]) {
          mock.emit(new Uint8Array([
            0xF0,0x21,0x25,0x7E,0x47,0x50,0x2D,0x32,0x12,0x4E,
            0x09, off & 0xFF, (off >> 8) & 0xFF,
            ...new Array(370).fill(0), 0xF7,
          ]));
        }
        mock.emit(new Uint8Array([
          0xF0,0x21,0x25,0x7E,0x47,0x50,0x2D,0x32,0x12,0x4E,
          0x09, 0x64, 0x05,
          ...new Array(212).fill(0), 0xF7,
        ]));
      }, 1);
    }
    // Version check → accepted
    if (d[8] === 0x11 && d[9] === 0x0A) {
      setTimeout(() => mock.emit(new Uint8Array([
        0xF0,0x21,0x25,0x7E,0x47,0x50,0x2D,0x32,0x12,0x0A,
        0x00,0x00,0x00,0x00,0x00,0x01,0x00,0x00,0x06,0x00,0x00,
        0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
        0xF7,
      ])), 1);
    }
    // Assignment query → empty response
    if (d[8] === 0x11 && d[9] === 0x1C) {
      setTimeout(() => mock.emit(new Uint8Array([
        0xF0,0x21,0x25,0x7E,0x47,0x50,0x2D,0x32,0x12,0x1C,
        ...new Array(59).fill(0), 0xF7,
      ])), 1);
    }
  });
}

describe('useMidiDevice', () => {
  let mockMidi: ReturnType<typeof makeMockMidi>;

  beforeEach(() => {
    mockMidi = makeMockMidi();
    enableAutoHandshake(mockMidi);
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
    expect(result.current.deviceInfo).toBeNull();
    expect(result.current.currentPreset).toBeNull();
    expect(result.current.assignments).toEqual([]);
  });

  it('connect() sets status to connecting then handshaking then connected', async () => {
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
    expect(result.current.deviceInfo).toBeNull();
    expect(result.current.currentPreset).toBeNull();
    expect(result.current.assignments).toEqual([]);
  });

  it('handshake sets currentSlot from state dump', async () => {
    const { result } = renderHook(() => useMidiDevice());
    await act(async () => { result.current.connect(); });
    await waitFor(() => expect(result.current.status).toBe('connected'));
    expect(result.current.currentSlot).toBe(9); // from auto-handshake slot=0x09
  });

  it('connect sends identity query as first handshake message', async () => {
    const { result } = renderHook(() => useMidiDevice());
    await act(async () => { result.current.connect(); });
    await waitFor(() => expect(result.current.status).toBe('connected'));
    const first = mockMidi.sentMessages[0];
    expect(first[8]).toBe(0x11);
    expect(first[9]).toBe(0x04); // identity query
  });

  it('handshake sets deviceInfo after connect', async () => {
    const { result } = renderHook(() => useMidiDevice());
    await act(async () => { result.current.connect(); });
    await waitFor(() => expect(result.current.status).toBe('connected'));
    expect(result.current.deviceInfo).not.toBeNull();
    expect(result.current.deviceInfo!.deviceType).toBe(0x04);
    expect(result.current.deviceInfo!.versionAccepted).toBe(true);
  });

  it('pullPreset sends a read request after handshake', async () => {
    const { result } = renderHook(() => useMidiDevice());
    await act(async () => { result.current.connect(); });
    await waitFor(() => expect(result.current.status).toBe('connected'));

    const SYSEX_HEADER = [0xF0, 0x21, 0x25, 0x7E, 0x47, 0x50, 0x2D, 0x32, 0x11, 0x10];
    let pullPromise: Promise<unknown>;
    act(() => {
      pullPromise = result.current.pullPreset(5);
    });
    await waitFor(() => {
      const sent = mockMidi.sentMessages;
      // Find the read request (sub=0x10) after the handshake messages
      const readReq = sent.find(m => m[8] === 0x11 && m[9] === 0x10);
      expect(readReq).toBeDefined();
      SYSEX_HEADER.forEach((b, i) => expect(readReq![i]).toBe(b));
      // Slot 5 nibble-encoded at [25-26]
      expect(readReq![25]).toBe(0x00);
      expect(readReq![26]).toBe(0x05);
    });
    // Clean up by aborting the pull (no chunks sent)
    pullPromise!.catch(() => {}); // ignore timeout error
  });
});
