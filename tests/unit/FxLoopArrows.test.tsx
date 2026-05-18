import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FxLoopArrows } from '@/components/FxLoopArrows';
import { NextIntlClientProvider } from 'next-intl';
import messages from '@/../messages/en.json';

function wrap(ui: React.ReactElement) {
  return (
    <NextIntlClientProvider locale="en" messages={messages}>
      {ui}
    </NextIntlClientProvider>
  );
}

describe('FxLoopArrows', () => {
  it('renders two arrow handles', () => {
    const onSend = vi.fn();
    const onReturn = vi.fn();
    render(wrap(<FxLoopArrows send={3} ret={7} onSendChange={onSend} onReturnChange={onReturn} />));
    expect(screen.getByLabelText(/send position/i)).toBeTruthy();
    expect(screen.getByLabelText(/return position/i)).toBeTruthy();
  });

  it('arrows in same gap show bypass class when send === ret', () => {
    render(wrap(<FxLoopArrows send={4} ret={4} onSendChange={() => {}} onReturnChange={() => {}} />));
    const sendArrow = screen.getByLabelText(/send position/i);
    expect(sendArrow.getAttribute('data-bypass')).toBe('true');
  });

  it('ArrowRight on SEND calls onSendChange(send+1)', () => {
    const onSend = vi.fn();
    render(wrap(<FxLoopArrows send={3} ret={7} onSendChange={onSend} onReturnChange={() => {}} />));
    const sendArrow = screen.getByLabelText(/send position/i);
    sendArrow.focus();
    fireEvent.keyDown(sendArrow, { key: 'ArrowRight' });
    expect(onSend).toHaveBeenCalledWith(4);
  });

  it('ArrowLeft on RETURN calls onReturnChange(ret-1)', () => {
    const onReturn = vi.fn();
    render(wrap(<FxLoopArrows send={3} ret={7} onSendChange={() => {}} onReturnChange={onReturn} />));
    const returnArrow = screen.getByLabelText(/return position/i);
    returnArrow.focus();
    fireEvent.keyDown(returnArrow, { key: 'ArrowLeft' });
    expect(onReturn).toHaveBeenCalledWith(6);
  });

  it('ArrowRight at position 10 does not exceed bounds', () => {
    const onSend = vi.fn();
    render(wrap(<FxLoopArrows send={10} ret={10} onSendChange={onSend} onReturnChange={() => {}} />));
    const sendArrow = screen.getByLabelText(/send position/i);
    sendArrow.focus();
    fireEvent.keyDown(sendArrow, { key: 'ArrowRight' });
    if (onSend.mock.calls.length > 0) {
      expect(onSend.mock.calls[0][0]).toBeLessThanOrEqual(10);
    }
  });
});
