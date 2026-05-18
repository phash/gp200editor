import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import messages from '../../../messages/en.json';

vi.mock('@/i18n/routing', () => ({
  Link: ({ href, children, className, style }: { href: string; children: React.ReactNode; className?: string; style?: React.CSSProperties }) => (
    <a href={href} className={className} style={style}>{children}</a>
  ),
}));

import { RateableGuitarRating } from '@/components/RateableGuitarRating';

function wrap(node: React.ReactNode) {
  return <NextIntlClientProvider locale="en" messages={messages}>{node}</NextIntlClientProvider>;
}

describe('RateableGuitarRating', () => {
  it('shows sign-in tooltip on anon click', () => {
    render(wrap(<RateableGuitarRating presetId="p1" average={4.2} count={5} canRate={false} existing={0} reason="anon" />));
    const button = screen.getAllByRole('button')[0];
    fireEvent.click(button);
    expect(screen.getByText(/sign in to rate/i)).toBeTruthy();
  });

  it('shows own-preset tooltip when reason=own', () => {
    render(wrap(<RateableGuitarRating presetId="p1" average={4.2} count={5} canRate={false} existing={0} reason="own" />));
    const button = screen.getAllByRole('button')[0];
    fireEvent.click(button);
    expect(screen.getByText(/cannot rate your own preset/i)).toBeTruthy();
  });

  it('POSTs and optimistically updates when canRate', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify({ ok: true })));
    render(wrap(<RateableGuitarRating presetId="p1" average={4.2} count={5} canRate={true} existing={0} reason={null} />));
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[4]); // 5-star
    expect(fetchMock).toHaveBeenCalledWith('/api/presets/p1/rate', expect.objectContaining({ method: 'POST' }));
    fetchMock.mockRestore();
  });
});
