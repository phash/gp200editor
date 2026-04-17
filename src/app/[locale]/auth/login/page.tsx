'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/routing';
import { PasswordInput } from '@/components/PasswordInput';

export default function LoginPage() {
  const t = useTranslations('auth');
  const router = useRouter();
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showResend, setShowResend] = useState(false);
  const [resendSent, setResendSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login, password }),
      });
      if (res.ok) {
        router.push('/profile');
        router.refresh();
      } else {
        const data = await res.json();
        const apiError = data.error as string | undefined;
        if (apiError?.includes('not verified')) {
          setError(t('emailNotVerified'));
          setShowResend(true);
        } else {
          setError(t('loginFailed'));
        }
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
              htmlFor="login"
              style={{ color: 'var(--text-secondary)' }}
            >
              {t('emailOrUsername')}
            </label>
            <input
              id="login"
              name="login"
              type="text"
              autoComplete="username"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
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
          <PasswordInput
            id="password"
            name="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            label={t('password')}
          />
          {error && (
            <div
              className="text-sm rounded px-3 py-2"
              style={{
                color: 'var(--accent-red)',
                background: 'var(--glow-red)',
                border: '1px solid rgba(196, 78, 78, 0.25)',
              }}
            >
              <p>{error}</p>
              {showResend && !resendSent && (
                <button
                  type="button"
                  className="mt-1 text-xs underline"
                  style={{ color: 'var(--accent-amber)' }}
                  onClick={async () => {
                    await fetch('/api/auth/resend-verification', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ email: login }),
                    });
                    setResendSent(true);
                  }}
                >
                  {t('resendVerification')}
                </button>
              )}
              {resendSent && (
                <p className="mt-1 text-xs" style={{ color: 'var(--accent-green)' }}>
                  {t('resendSent')}
                </p>
              )}
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full font-mono-display text-sm font-bold tracking-wider uppercase rounded py-2.5 transition-all duration-150 disabled:opacity-50 bg-[var(--glow-amber)] border border-accent-amber text-accent-amber shadow-glow-amber hover:bg-accent-amber hover:text-bg-primary hover:shadow-[0_0_20px_var(--glow-amber)] disabled:hover:bg-[var(--glow-amber)] disabled:hover:text-accent-amber disabled:hover:shadow-glow-amber"
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
              className="transition-colors hover:text-[var(--text-primary)]"
              style={{ color: 'var(--accent-amber)' }}
            >
              {t('register')}
            </Link>
          </p>
          <p>
            <Link
              href="/auth/forgot-password"
              className="transition-colors hover:text-[var(--accent-amber)]"
              style={{ color: 'var(--text-muted)' }}
            >
              {t('forgotPassword')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
