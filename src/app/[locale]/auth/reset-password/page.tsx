'use client';

import { useState, Suspense } from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useRouter } from '@/i18n/routing';

function ResetPasswordForm() {
  const t = useTranslations('auth');
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      });
      if (res.ok) {
        router.push('/profile');
        router.refresh();
      } else {
        const data = await res.json();
        setError(data.error ?? t('resetError'));
      }
    } catch {
      setError(t('resetError'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label
          className="block font-mono-display text-[11px] font-medium tracking-wider uppercase mb-1.5"
          htmlFor="newPassword"
          style={{ color: 'var(--text-secondary)' }}
        >
          {t('newPassword')}
        </label>
        <input
          id="newPassword"
          name="newPassword"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
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
        disabled={loading || !token}
        className="w-full font-mono-display text-sm font-bold tracking-wider uppercase rounded py-2.5 transition-all duration-150 disabled:opacity-50"
        style={{
          background: 'var(--glow-amber)',
          border: '1px solid var(--accent-amber)',
          color: 'var(--accent-amber)',
          boxShadow: '0 0 12px var(--glow-amber)',
        }}
        onMouseEnter={(e) => {
          if (!loading && token) {
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
        {loading ? t('loading') : t('resetButton')}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  const t = useTranslations('auth');
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
          {t('resetPasswordTitle')}
        </h1>
        <Suspense fallback={<p style={{ color: 'var(--text-muted)' }}>…</p>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
