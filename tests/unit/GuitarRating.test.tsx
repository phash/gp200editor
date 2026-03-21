import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GuitarRating } from '@/components/GuitarRating';

describe('GuitarRating', () => {
  it('renders 5 guitars', () => {
    render(<GuitarRating value={3} />);
    const guitars = screen.getAllByRole('img', { hidden: true });
    expect(guitars).toHaveLength(5);
  });

  it('shows correct filled count for value=3', () => {
    render(<GuitarRating value={3} />);
    expect(screen.getAllByLabelText('filled guitar')).toHaveLength(3);
    expect(screen.getAllByLabelText('empty guitar')).toHaveLength(2);
  });

  it('calls onRate when interactive and guitar clicked', () => {
    const onRate = vi.fn();
    render(<GuitarRating value={0} onRate={onRate} />);
    fireEvent.click(screen.getAllByRole('button')[2]); // 3rd guitar
    expect(onRate).toHaveBeenCalledWith(3);
  });

  it('does not render buttons when no onRate provided', () => {
    render(<GuitarRating value={3} />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});
