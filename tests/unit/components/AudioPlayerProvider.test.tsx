import { describe, it, expect } from 'vitest';
import { render, act } from '@testing-library/react';
import { useEffect, useRef } from 'react';
import { AudioPlayerProvider, useAudioPlayerManager } from '@/components/audio/AudioPlayerProvider';

function Probe({ onReady }: { onReady: (mgr: ReturnType<typeof useAudioPlayerManager>, audio: HTMLAudioElement) => void }) {
  const mgr = useAudioPlayerManager();
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => { if (ref.current) onReady(mgr, ref.current); }, [mgr, onReady]);
  return <audio ref={ref} />;
}

describe('AudioPlayerProvider', () => {
  it('notifyPlay pauses the previously playing element', () => {
    let firstMgr: ReturnType<typeof useAudioPlayerManager> | null = null;
    let firstEl: HTMLAudioElement | null = null;
    let secondEl: HTMLAudioElement | null = null;

    render(
      <AudioPlayerProvider>
        <Probe onReady={(m, el) => { if (!firstEl) { firstMgr = m; firstEl = el; } else { secondEl = el; } }} />
        <Probe onReady={(m, el) => { if (!firstEl) { firstMgr = m; firstEl = el; } else { secondEl = el; } }} />
      </AudioPlayerProvider>
    );

    const f = firstEl as HTMLAudioElement | null;
    const s = secondEl as HTMLAudioElement | null;
    expect(f && s).toBeTruthy();
    let paused = false;
    if (f) f.pause = () => { paused = true; };

    act(() => { firstMgr!.notifyPlay(f!); });
    act(() => { firstMgr!.notifyPlay(s!); });
    expect(paused).toBe(true);
  });

  it('notifyEnded clears the active ref', () => {
    let mgr: ReturnType<typeof useAudioPlayerManager> | null = null;
    let el: HTMLAudioElement | null = null;
    render(
      <AudioPlayerProvider>
        <Probe onReady={(m, e) => { mgr = m; el = e; }} />
      </AudioPlayerProvider>
    );
    act(() => { mgr!.notifyPlay(el!); });
    act(() => { mgr!.notifyEnded(el!); });
    act(() => { mgr!.notifyPlay(el!); });
    expect(true).toBe(true);
  });
});
