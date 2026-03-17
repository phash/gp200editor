'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/routing';

export default function LoginPage() {
  const t = useTranslations('auth');
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (res.ok) {
        router.push('/profile');
        router.refresh();
      } else {
        const data = await res.json();
        setError(data.error ?? t('loginFailed'));
      }
    } catch {
      setError(t('loginFailed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-center flex-1 px-4 py-16">
      <div
        className="w-full max-w-sm rounded-lg p-6"
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.03)',
        }}
      >
        <h1
          className="font-mono-display text-xl font-bold tracking-tight mb-6"
          style={{ color: 'var(--accent-amber)' }}
        >
          {t('loginTitle')}
        </h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label
              className="block font-mono-display text-[11px] font-medium tracking-wider uppercase mb-1.5"
              htmlFor="email"
              style={{ color: 'var(--text-secondary)' }}
            >
              {t('email')}
            </label>
            <input
              id="email"
              name="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded px-3 py-2 text-sm focus:outline-none transition-shadow"
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-active)',
                color: 'var(--text-primary)',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--accent-amber)';
                e.currentTarget.style.boxShadow = '0 0 0 2px var(--glow-amber)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-active)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            />
          </div>
          <div>
            <label
              className="block font-mono-display text-[11px] font-medium tracking-wider uppercase mb-1.5"
              htmlFor="password"
              style={{ color: 'var(--text-secondary)' }}
            >
              {t('password')}
            </label>
            <input
              id="password"
              name="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded px-3 py-2 text-sm focus:outline-none transition-shadow"
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-active)',
                color: 'var(--text-primary)',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--accent-amber)';
                e.currentTarget.style.boxShadow = '0 0 0 2px var(--glow-amber)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-active)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            />
          </div>
          {error && (
            <p
              className="text-sm rounded px-3 py-2"
              style={{
                color: 'var(--accent-red)',
                background: 'var(--glow-red)',
                border: '1px solid rgba(196, 78, 78, 0.25)',
              }}
            >
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full font-mono-display text-sm font-bold tracking-wider uppercase rounded py-2.5 transition-all duration-150 disabled:opacity-50"
            style={{
              background: 'var(--glow-amber)',
              border: '1px solid var(--accent-amber)',
              color: 'var(--accent-amber)',
              boxShadow: '0 0 12px var(--glow-amber)',
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.background = 'var(--accent-amber)';
                e.currentTarget.style.color = 'var(--bg-primary)';
                e.currentTarget.style.boxShadow = '0 0 20px var(--glow-amber)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--glow-amber)';
              e.currentTarget.style.color = 'var(--accent-amber)';
              e.currentTarget.style.boxShadow = '0 0 12px var(--glow-amber)';
            }}
          >
            {loading ? t('loading') : t('loginButton')}
          </button>
        </form>
        <div
          className="mt-5 pt-4 text-sm text-center space-y-2"
          style={{ borderTop: '1px solid var(--border-subtle)' }}
        >
          <p>
            <span style={{ color: 'var(--text-muted)' }}>{t('noAccount')} </span>
            <Link
              href="/auth/register"
              className="transition-colors"
              style={{ color: 'var(--accent-amber)' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--accent-amber)')}
            >
              {t('register')}
            </Link>
          </p>
          <p>
            <Link
              href="/auth/forgot-password"
              className="transition-colors"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent-amber)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
            >
              {t('forgotPassword')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
