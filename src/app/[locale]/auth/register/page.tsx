'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';

export default function RegisterPage() {
  const t = useTranslations('auth');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, username, password }),
      });
      if (res.ok) {
        setRegistered(true);
      } else {
        const data = await res.json();
        const apiError = data.error as string | undefined;
        if (apiError?.includes('Email already taken')) {
          setError(t('emailTaken'));
        } else if (apiError?.includes('Username already taken')) {
          setError(t('usernameTaken'));
        } else if (apiError?.includes('at least 8')) {
          setError(t('passwordTooShort'));
        } else {
          setError(apiError ?? t('registrationError'));
        }
      }
    } catch {
      setError(t('registrationError'));
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
        {registered ? (
          <div className="text-center py-4">
            <h1 className="font-mono-display text-xl font-bold tracking-tight mb-4"
              style={{ color: 'var(--accent-green)' }}>
              {t('registerSuccess')}
            </h1>
            <p style={{ color: 'var(--text-muted)' }}>{t('registerCheckEmail')}</p>
          </div>
        ) : (
        <>
        <h1
          className="font-mono-display text-xl font-bold tracking-tight mb-6"
          style={{ color: 'var(--accent-amber)' }}
        >
          {t('registerTitle')}
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
              htmlFor="username"
              style={{ color: 'var(--text-secondary)' }}
            >
              {t('username')}
            </label>
            <input
              id="username"
              name="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              minLength={3}
              maxLength={30}
              pattern="[a-zA-Z0-9_]+"
              className="w-full rounded px-3 py-2 text-sm focus:outline-none transition-shadow font-mono-display"
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
              minLength={8}
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
            {loading ? t('loading') : t('registerButton')}
          </button>
        </form>
        </>
        )}
        <div
          className="mt-5 pt-4 text-sm text-center"
          style={{ borderTop: '1px solid var(--border-subtle)' }}
        >
          <p>
            <span style={{ color: 'var(--text-muted)' }}>{t('haveAccount')} </span>
            <Link
              href="/auth/login"
              className="transition-colors"
              style={{ color: 'var(--accent-amber)' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--accent-amber)')}
            >
              {t('login')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
