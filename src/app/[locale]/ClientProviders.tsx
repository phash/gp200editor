'use client';

import { type ReactNode, useEffect } from 'react';
import { MidiDeviceProvider } from '@/contexts/MidiDeviceContext';
import { AudioPlayerProvider } from '@/components/audio/AudioPlayerProvider';

export function ClientProviders({ children }: { children: ReactNode }) {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  return (
    <MidiDeviceProvider>
      <AudioPlayerProvider>{children}</AudioPlayerProvider>
    </MidiDeviceProvider>
  );
}
