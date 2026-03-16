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
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold mb-6">{t('forgotPasswordTitle')}</h1>
        {sent ? (
          <div>
            <p className="text-gray-700 mb-4" data-testid="forgot-password-sent">
              {t('forgotPasswordSent')}
            </p>
            <Link href="/auth/login" className="text-blue-600 hover:underline text-sm">
              {t('backToLogin')}
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="email">
                {t('email')}
              </label>
              <input
                id="email"
                name="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white rounded py-2 hover:bg-blue-700 disabled:opacity-50 transition"
            >
              {loading ? t('loading') : t('sendResetButton')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
