'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';

export default function ForgotPasswordPage() {
  const t = useTranslations('auth');
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
    } finally {
      setLoading(false);
      setSent(true);
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
          {t('forgotPasswordTitle')}
        </h1>
        {sent ? (
          <div>
            <p
              className="text-sm mb-4 rounded px-3 py-2"
              data-testid="forgot-password-sent"
              style={{
                color: 'var(--accent-green)',
                background: 'var(--glow-green)',
                border: '1px solid rgba(78, 196, 106, 0.25)',
              }}
            >
              {t('forgotPasswordSent')}
            </p>
            <Link
              href="/auth/login"
              className="text-sm transition-colors"
              style={{ color: 'var(--accent-amber)' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--accent-amber)')}
            >
              {t('backToLogin')}
            </Link>
          </div>
        ) : (
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
              {loading ? t('loading') : t('sendResetButton')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
