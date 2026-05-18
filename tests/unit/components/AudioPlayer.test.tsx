import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import messages from '../../../messages/en.json';
import { AudioPlayer } from '@/components/audio/AudioPlayer';

function wrap(node: React.ReactNode) {
  return <NextIntlClientProvider locale="en" messages={messages}>{node}</NextIntlClientProvider>;
}

describe('AudioPlayer', () => {
  it('full variant renders Play button + duration label', () => {
    render(wrap(<AudioPlayer src="/api/preset-audio/preset-x-1.mp3" mime="audio/mpeg" durationMs={28000} variant="full" />));
    expect(screen.getByRole('button', { name: /play/i })).toBeTruthy();
    expect(screen.getByText('0:00 / 0:28')).toBeTruthy();
  });

  it('icon variant renders a single icon button', () => {
    render(wrap(<AudioPlayer src="/api/preset-audio/preset-x-1.mp3" mime="audio/mpeg" durationMs={5000} variant="icon" />));
    const btns = screen.getAllByRole('button');
    expect(btns.length).toBe(1);
  });

  it('click play calls .play() on the underlying <audio>', () => {
    const playSpy = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    render(wrap(<AudioPlayer src="/api/preset-audio/preset-x-1.mp3" mime="audio/mpeg" durationMs={5000} variant="full" />));
    fireEvent.click(screen.getByRole('button', { name: /play/i }));
    expect(playSpy).toHaveBeenCalled();
    playSpy.mockRestore();
  });
});
