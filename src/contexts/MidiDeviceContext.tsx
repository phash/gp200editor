'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { useMidiDevice, type UseMidiDeviceReturn } from '@/hooks/useMidiDevice';

const MidiDeviceContext = createContext<UseMidiDeviceReturn | null>(null);

export function MidiDeviceProvider({ children }: { children: ReactNode }) {
  const midiDevice = useMidiDevice();
  return (
    <MidiDeviceContext.Provider value={midiDevice}>
      {children}
    </MidiDeviceContext.Provider>
  );
}

export function useMidiDeviceContext(): UseMidiDeviceReturn {
  const ctx = useContext(MidiDeviceContext);
  if (!ctx) throw new Error('useMidiDeviceContext must be used within MidiDeviceProvider');
  return ctx;
}
