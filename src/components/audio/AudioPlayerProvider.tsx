'use client';
import { createContext, useCallback, useContext, useRef, type ReactNode } from 'react';

export interface AudioPlayerManager {
  notifyPlay: (el: HTMLAudioElement) => void;
  notifyEnded: (el: HTMLAudioElement) => void;
}

const AudioPlayerCtx = createContext<AudioPlayerManager | null>(null);

export function useAudioPlayerManager(): AudioPlayerManager {
  const v = useContext(AudioPlayerCtx);
  if (!v) return { notifyPlay: () => {}, notifyEnded: () => {} };
  return v;
}

export function AudioPlayerProvider({ children }: { children: ReactNode }) {
  const activeRef = useRef<HTMLAudioElement | null>(null);

  const notifyPlay = useCallback((el: HTMLAudioElement) => {
    if (activeRef.current && activeRef.current !== el) {
      activeRef.current.pause();
    }
    activeRef.current = el;
  }, []);

  const notifyEnded = useCallback((el: HTMLAudioElement) => {
    if (activeRef.current === el) activeRef.current = null;
  }, []);

  return (
    <AudioPlayerCtx.Provider value={{ notifyPlay, notifyEnded }}>
      {children}
    </AudioPlayerCtx.Provider>
  );
}
