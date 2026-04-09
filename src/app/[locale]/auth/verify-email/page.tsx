'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';

export default function VerifyEmailPage() {
  const t = useTranslations('auth');
  const router = useRouter();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token');
    if (!token) {
      setStatus('error');
      setErrorMsg(t('verifyInvalidToken'));
      return;
    }

    fetch(`/api/auth/verify-email?token=${token}`)
      .then(async (res) => {
        if (res.ok) {
          setStatus('success');
          setTimeout(() => {
            router.push('/editor');
            router.refresh();
          }, 2000);
        } else {
          const data = await res.json();
          setStatus('error');
          setErrorMsg(data.error ?? t('verifyInvalidToken'));
        }
      })
      .catch(() => {
        setStatus('error');
        setErrorMsg(t('verifyInvalidToken'));
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        {status === 'verifying' && (
          <>
            <h1 className="font-mono-display text-xl font-bold tracking-tight mb-4"
              style={{ color: 'var(--accent-amber)' }}>
              {t('verifyTitle')}
            </h1>
            <p style={{ color: 'var(--text-muted)' }}>{t('verifyChecking')}</p>
          </>
        )}
        {status === 'success' && (
          <>
            <h1 className="font-mono-display text-xl font-bold tracking-tight mb-4"
              style={{ color: 'var(--accent-green)' }}>
              {t('verifySuccess')}
            </h1>
            <p style={{ color: 'var(--text-muted)' }}>{t('verifyRedirecting')}</p>
          </>
        )}
        {status === 'error' && (
          <>
            <h1 className="font-mono-display text-xl font-bold tracking-tight mb-4"
              style={{ color: 'var(--accent-red)' }}>
              {t('verifyFailed')}
            </h1>
            <p style={{ color: 'var(--text-muted)' }}>{errorMsg}</p>
          </>
        )}
      </div>
    </div>
  );
}
