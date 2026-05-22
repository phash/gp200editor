'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';

// App-Router error boundary. Fires on any uncaught render error in this
// locale's tree. Posts to /api/errors/client so the same /admin/errors dashboard
// shows both server- and client-side failures.

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('error');

  useEffect(() => {
    // Fire-and-forget. We do NOT block the UI on reporting, and we do NOT show
    // the user whether reporting succeeded — they care about recovery, not
    // observability plumbing.
    fetch('/api/errors/client', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: error.message || 'unknown client error',
        stack: error.stack,
        url: typeof window !== 'undefined' ? window.location.href : undefined,
        metadata: { digest: error.digest ?? null },
      }),
    }).catch(() => {
      // intentional: never throw from inside the error boundary's effect
    });
  }, [error]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-16">
      <h1
        className="font-mono-display text-2xl font-bold tracking-tight mb-4"
        style={{ color: 'var(--accent-amber)' }}
      >
        {t('title')}
      </h1>
      <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
        {t('body')}
      </p>
      <button
        onClick={reset}
        className="px-6 py-2.5 rounded font-mono-display text-sm font-bold tracking-wider uppercase border transition-colors"
        style={{
          color: 'var(--accent-amber)',
          borderColor: 'var(--accent-amber)',
          background: 'var(--glow-amber)',
        }}
      >
        {t('retry')}
      </button>
    </div>
  );
}
