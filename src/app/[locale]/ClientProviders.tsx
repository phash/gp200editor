'use client';

import { type ReactNode } from 'react';
import { MidiDeviceProvider } from '@/contexts/MidiDeviceContext';

export function ClientProviders({ children }: { children: ReactNode }) {
  return <MidiDeviceProvider>{children}</MidiDeviceProvider>;
}
