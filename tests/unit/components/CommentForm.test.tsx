import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import messages from '../../../messages/en.json';
import { CommentForm } from '@/components/comments/CommentForm';

function wrap(node: React.ReactNode) {
  return <NextIntlClientProvider locale="en" messages={messages}>{node}</NextIntlClientProvider>;
}

describe('CommentForm', () => {
  it('shows char counter that updates on input', () => {
    render(wrap(<CommentForm presetId="p1" onSubmit={vi.fn()} />));
    const textarea = screen.getByRole('textbox');
    expect(screen.getByText('0 / 1000')).toBeTruthy();
    fireEvent.change(textarea, { target: { value: 'hello' } });
    expect(screen.getByText('5 / 1000')).toBeTruthy();
  });

  it('calls onSubmit with body and resets', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(wrap(<CommentForm presetId="p1" onSubmit={onSubmit} />));
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'hi' } });
    fireEvent.click(screen.getByRole('button', { name: /post/i }));
    expect(onSubmit).toHaveBeenCalledWith('hi');
    await Promise.resolve();
    await Promise.resolve();
    expect((textarea as HTMLTextAreaElement).value).toBe('');
  });

  it('disables submit when body is empty or whitespace', () => {
    render(wrap(<CommentForm presetId="p1" onSubmit={vi.fn()} />));
    const submit = screen.getByRole('button', { name: /post/i });
    expect((submit as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '   ' } });
    expect((submit as HTMLButtonElement).disabled).toBe(true);
  });
});
