'use client';

import { useEffect, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from '@/i18n/routing';

export default function VerifyEmailPage() {
  const t = useTranslations('auth');
  const locale = useLocale();
  const router = useRouter();
  const [status, setStatus] = useState<'pending' | 'verifying' | 'success' | 'error'>('pending');
  const [errorMsg, setErrorMsg] = useState('');
  const [token, setToken] = useState<string | null>(null);

  // Token only available client-side. Read once in effect so SSR stays stable.
  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get('token'));
  }, []);

  const verify = async () => {
    if (!token) {
      setStatus('error');
      setErrorMsg(t('verifyInvalidToken'));
      return;
    }
    setStatus('verifying');
    try {
      const res = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, locale }),
      });
      if (res.ok) {
        setStatus('success');
        setTimeout(() => {
          router.push('/editor');
          router.refresh();
        }, 2000);
      } else {
        const data = await res.json().catch(() => ({}));
        setStatus('error');
        setErrorMsg(data.error ?? t('verifyInvalidToken'));
      }
    } catch {
      setStatus('error');
      setErrorMsg(t('verifyInvalidToken'));
    }
  };

  return (
    <div className="flex items-center justify-center flex-1 px-4 py-16">
      <div
        className="w-full max-w-sm rounded-lg p-6 text-center"
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
        }}
      >
        {status === 'pending' && (
          <>
            <h1
              className="font-mono-display text-xl font-bold tracking-tight mb-4"
              style={{ color: 'var(--accent-amber)' }}
            >
              {t('verifyTitle')}
            </h1>
            <p className="mb-6 text-sm" style={{ color: 'var(--text-muted)' }}>
              {t('verifyConfirmDescription')}
            </p>
            <button
              type="button"
              onClick={verify}
              disabled={!token}
              className="w-full px-4 py-3 rounded font-mono-display text-sm font-bold tracking-wide uppercase disabled:opacity-50 transition-opacity"
              style={{ background: 'var(--accent-amber)', color: '#0a0a0a' }}
            >
              {t('verifyConfirmButton')}
            </button>
          </>
        )}
        {status === 'verifying' && (
          <>
            <h1
              className="font-mono-display text-xl font-bold tracking-tight mb-4"
              style={{ color: 'var(--accent-amber)' }}
            >
              {t('verifyTitle')}
            </h1>
            <p style={{ color: 'var(--text-muted)' }}>{t('verifyChecking')}</p>
          </>
        )}
        {status === 'success' && (
          <>
            <h1
              className="font-mono-display text-xl font-bold tracking-tight mb-4"
              style={{ color: 'var(--accent-green)' }}
            >
              {t('verifySuccess')}
            </h1>
            <p style={{ color: 'var(--text-muted)' }}>{t('verifyRedirecting')}</p>
          </>
        )}
        {status === 'error' && (
          <>
            <h1
              className="font-mono-display text-xl font-bold tracking-tight mb-4"
              style={{ color: 'var(--accent-red)' }}
            >
              {t('verifyFailed')}
            </h1>
            <p style={{ color: 'var(--text-muted)' }}>{errorMsg}</p>
          </>
        )}
      </div>
    </div>
  );
}
