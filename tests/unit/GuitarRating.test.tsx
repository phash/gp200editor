import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { GuitarRating } from '@/components/GuitarRating';

const messages = {
  gallery: {
    ratingStarFilled: 'filled rating star',
    ratingStarEmpty: 'empty rating star',
  },
};

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe('GuitarRating', () => {
  it('renders 5 guitars', () => {
    renderWithIntl(<GuitarRating value={3} />);
    const guitars = screen.getAllByRole('img', { hidden: true });
    expect(guitars).toHaveLength(5);
  });

  it('shows correct filled count for value=3', () => {
    renderWithIntl(<GuitarRating value={3} />);
    expect(screen.getAllByLabelText('filled rating star')).toHaveLength(3);
    expect(screen.getAllByLabelText('empty rating star')).toHaveLength(2);
  });

  it('calls onRate when interactive and guitar clicked', () => {
    const onRate = vi.fn();
    renderWithIntl(<GuitarRating value={0} onRate={onRate} />);
    fireEvent.click(screen.getAllByRole('button')[2]); // 3rd guitar
    expect(onRate).toHaveBeenCalledWith(3);
  });

  it('does not render buttons when no onRate provided', () => {
    renderWithIntl(<GuitarRating value={3} />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});
