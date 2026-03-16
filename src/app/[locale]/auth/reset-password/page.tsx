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
        <label className="block text-sm font-medium mb-1" htmlFor="newPassword">
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
          className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <button
        type="submit"
        disabled={loading || !token}
        className="w-full bg-blue-600 text-white rounded py-2 hover:bg-blue-700 disabled:opacity-50 transition"
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
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold mb-6">{t('resetPasswordTitle')}</h1>
        <Suspense fallback={<p>…</p>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
