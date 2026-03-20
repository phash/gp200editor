'use client';

import { type ReactNode, useEffect } from 'react';
import { MidiDeviceProvider } from '@/contexts/MidiDeviceContext';

export function ClientProviders({ children }: { children: ReactNode }) {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  return <MidiDeviceProvider>{children}</MidiDeviceProvider>;
}
