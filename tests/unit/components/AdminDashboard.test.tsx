import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import messages from '../../../messages/en.json';
import { AdminDashboard } from '@/components/AdminDashboard';

vi.mock('@/i18n/routing', () => ({
  Link: ({ children, ...props }: { children: React.ReactNode } & Record<string, unknown>) => <a {...props}>{children}</a>,
}));

function wrap(node: React.ReactNode) {
  return <NextIntlClientProvider locale="en" messages={messages}>{node}</NextIntlClientProvider>;
}

const STATS = { userCount: 2, presetCount: 3, errorCount: 0, suspendedCount: 0 };

function adminUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'u1',
    username: 'alice',
    email: 'alice@example.com',
    role: 'USER',
    suspended: false,
    emailVerified: true,
    createdAt: '2026-04-13T19:53:00.000Z',
    presetCount: 3,
    ...overrides,
  };
}

function mockFetch(users: ReturnType<typeof adminUser>[]) {
  return vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    const body = url.startsWith('/api/admin/stats')
      ? STATS
      : { users, total: users.length, page: 1, limit: 20, pages: 1 };
    return Promise.resolve({ ok: true, json: () => Promise.resolve(body) } as Response);
  });
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllGlobals());

describe('AdminDashboard users tab', () => {
  it('marks users whose email is not verified', async () => {
    vi.stubGlobal('fetch', mockFetch([adminUser({ username: 'bob', emailVerified: false })]));

    render(wrap(<AdminDashboard />));

    await waitFor(() => expect(screen.getByText('bob')).toBeTruthy());
    expect(screen.getByText(/unverified/i)).toBeTruthy();
  });

  it('does not mark verified users', async () => {
    vi.stubGlobal('fetch', mockFetch([adminUser({ emailVerified: true })]));

    render(wrap(<AdminDashboard />));

    await waitFor(() => expect(screen.getByText('alice')).toBeTruthy());
    expect(screen.queryByText(/unverified/i)).toBeNull();
  });

  it('renders the preset count coming from the API', async () => {
    vi.stubGlobal('fetch', mockFetch([adminUser({ presetCount: 7 })]));

    render(wrap(<AdminDashboard />));

    await waitFor(() => expect(screen.getByText('alice')).toBeTruthy());
    expect(screen.getByText(/7 presets/)).toBeTruthy();
  });
});
