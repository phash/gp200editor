import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import messages from '../../../messages/en.json';
import { CommentItem } from '@/components/comments/CommentItem';

vi.mock('@/i18n/routing', () => ({
  Link: ({ children, ...props }: { children: React.ReactNode } & Record<string, unknown>) => <a {...props}>{children}</a>,
}));

function wrap(node: React.ReactNode) {
  return <NextIntlClientProvider locale="en" messages={messages}>{node}</NextIntlClientProvider>;
}

const baseComment = {
  id: 'c1', body: 'hello there', editedAt: null, deletedAt: null, deletedBy: null,
  createdAt: new Date().toISOString(), userId: 'u1',
  user: { id: 'u1', username: 'alice' },
};

describe('CommentItem', () => {
  it('renders body + username', () => {
    render(wrap(<CommentItem comment={baseComment} currentUserId={null} isAdmin={false} onReply={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} />));
    expect(screen.getByText('hello there')).toBeTruthy();
    expect(screen.getByText('@alice')).toBeTruthy();
  });

  it('shows edited badge when editedAt set', () => {
    render(wrap(<CommentItem comment={{ ...baseComment, editedAt: new Date().toISOString() }} currentUserId={null} isAdmin={false} onReply={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} />));
    expect(screen.getByText(/edited/i)).toBeTruthy();
  });

  it('shows "Removed by author" placeholder when soft-deleted by author', () => {
    render(wrap(<CommentItem comment={{ ...baseComment, body: null, deletedAt: new Date().toISOString(), deletedBy: 'AUTHOR' }} currentUserId={null} isAdmin={false} onReply={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} />));
    expect(screen.getByText(/removed by author/i)).toBeTruthy();
  });

  it('shows "Removed by moderator" when deletedBy=ADMIN', () => {
    render(wrap(<CommentItem comment={{ ...baseComment, body: null, deletedAt: new Date().toISOString(), deletedBy: 'ADMIN' }} currentUserId={null} isAdmin={false} onReply={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} />));
    expect(screen.getByText(/removed by moderator/i)).toBeTruthy();
  });

  it('shows Edit + Delete buttons for own comment', () => {
    render(wrap(<CommentItem comment={baseComment} currentUserId="u1" isAdmin={false} onReply={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} />));
    expect(screen.getByRole('button', { name: /edit/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /delete/i })).toBeTruthy();
  });

  it('shows Reply button only on top-level (no parentId)', () => {
    render(wrap(<CommentItem comment={baseComment} currentUserId="u2" isAdmin={false} onReply={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} />));
    expect(screen.getByRole('button', { name: /reply/i })).toBeTruthy();
  });
});
