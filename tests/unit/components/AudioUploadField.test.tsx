import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import messages from '../../../messages/en.json';
import { AudioUploadField } from '@/components/audio/AudioUploadField';

const refresh = vi.fn();
vi.mock('@/i18n/routing', () => ({
  useRouter: () => ({ refresh }),
}));

function wrap(node: React.ReactNode) {
  return <NextIntlClientProvider locale="en" messages={messages}>{node}</NextIntlClientProvider>;
}

function fakeFile(name = 'test.mp3', type = 'audio/mpeg', size = 1024): File {
  return new File([new Uint8Array(size)], name, { type });
}

describe('AudioUploadField', () => {
  it('renders placeholder when no audio is attached', () => {
    render(wrap(<AudioUploadField presetId="p1" hasAudio={false} onChange={vi.fn()} />));
    expect(screen.getByText(/Pick MP3 or M4A/i)).toBeTruthy();
  });

  it('POSTs the file to /api/presets/[id]/audio on file pick', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      audioKey: 'k', audioUrl: '/api/preset-audio/k', audioMimeType: 'audio/mpeg', audioDurationMs: 5000,
    }), { status: 200 }));
    const onChange = vi.fn();
    render(wrap(<AudioUploadField presetId="p1" hasAudio={false} onChange={onChange} />));
    const input = screen.getByLabelText(/audio snippet/i, { selector: 'input[type="file"]' }) as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [fakeFile()] });
    fireEvent.change(input);
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledWith('/api/presets/p1/audio', expect.objectContaining({ method: 'POST' })));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ audioKey: 'k' })));
    fetchSpy.mockRestore();
  });

  // The share page is a Server Component and cannot pass a function prop
  // (doing so 500'd the page for owners). Without onChange the field
  // refreshes the route so the server-rendered player shows the new state.
  it('refreshes the route after upload when no onChange is given', async () => {
    refresh.mockClear();
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      audioKey: 'k', audioUrl: '/api/preset-audio/k', audioMimeType: 'audio/mpeg', audioDurationMs: 5000,
    }), { status: 200 }));
    render(wrap(<AudioUploadField presetId="p1" hasAudio={false} />));
    const input = screen.getByLabelText(/audio snippet/i, { selector: 'input[type="file"]' }) as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [fakeFile()] });
    fireEvent.change(input);
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    fetchSpy.mockRestore();
  });

  it('surfaces tooLong error from server', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify({ error: 'tooLong' }), { status: 400 }));
    render(wrap(<AudioUploadField presetId="p1" hasAudio={false} onChange={vi.fn()} />));
    const input = screen.getByLabelText(/audio snippet/i, { selector: 'input[type="file"]' }) as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [fakeFile()] });
    fireEvent.change(input);
    await waitFor(() => expect(screen.getByText(/max 30 s/i)).toBeTruthy());
    fetchSpy.mockRestore();
  });

  it('shows Replace + Remove when hasAudio=true', () => {
    render(wrap(<AudioUploadField presetId="p1" hasAudio={true} onChange={vi.fn()} />));
    expect(screen.getByRole('button', { name: /replace/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /remove/i })).toBeTruthy();
  });
});
