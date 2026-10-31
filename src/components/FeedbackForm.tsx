'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_MAX,
  FEEDBACK_MIN,
  type FeedbackCategory,
} from '@/lib/feedbackValidators';

export type FeedbackAccess = 'anonymous' | 'unverified' | 'verified';

const CATEGORY_ICON: Record<FeedbackCategory, string> = { BUG: '🐞', IDEA: '💡', GENERAL: '💬' };

const panelStyle = {
  background: 'var(--bg-surface)',
  border: '1px solid var(--border-subtle)',
} as const;

/** Same-origin path of the page the user came from, if any. */
function referrerPath(): string | null {
  try {
    if (!document.referrer) return null;
    const ref = new URL(document.referrer);
    if (ref.origin !== window.location.origin) return null;
    if (ref.pathname.replace(/^\/[a-zA-Z-]{2,5}(?=\/|$)/, '').startsWith('/feedback')) return null;
    return `${ref.pathname}${ref.search}`.slice(0, 300);
  } catch {
    return null;
  }
}

export function FeedbackForm({ access, email }: { access: FeedbackAccess; email: string | null }) {
  const t = useTranslations('feedback');
  const locale = useLocale();
  const [category, setCategory] = useState<FeedbackCategory>('BUG');
  const [message, setMessage] = useState('');
  const [pagePath, setPagePath] = useState<string | null>(null);
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState('');
  const [resent, setResent] = useState(false);
  // Submit stays disabled until hydration: a click before that would fall
  // back to a native form submit and bypass the API call.
  const [hydrated, setHydrated] = useState(false);

  // ?category=IDEA preselects a category (promo links). window.location
  // instead of useSearchParams — the latter breaks in the production build.
  useEffect(() => {
    const c = new URLSearchParams(window.location.search).get('category')?.toUpperCase();
    if (c && (FEEDBACK_CATEGORIES as readonly string[]).includes(c)) setCategory(c as FeedbackCategory);
    const from = new URLSearchParams(window.location.search).get('from');
    setPagePath(from && from.startsWith('/') && !from.startsWith('//') ? from.slice(0, 300) : referrerPath());
    setHydrated(true);
  }, []);

  if (access === 'anonymous') {
    return (
      <section className="rounded-lg p-6" style={panelStyle} data-testid="feedback-login-required">
        <h2 className="font-mono-display text-lg font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
          {t('loginTitle')}
        </h2>
        <p className="text-sm mb-5" style={{ color: 'var(--text-secondary)' }}>{t('loginBody')}</p>
        <div className="flex flex-wrap gap-3">
          <Link href="/auth/login" className="font-mono-display text-sm font-bold px-4 py-2 rounded"
            style={{ background: 'var(--accent-amber)', color: '#111' }}>
            {t('loginCta')}
          </Link>
          <Link href="/auth/register" className="font-mono-display text-sm font-bold px-4 py-2 rounded transition-colors hover:bg-[rgba(212,162,78,0.12)]"
            style={{ border: '1px solid var(--accent-amber)', color: 'var(--accent-amber)' }}>
            {t('registerCta')}
          </Link>
        </div>
      </section>
    );
  }

  if (access === 'unverified') {
    const resend = async () => {
      if (!email) return;
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, locale }),
      });
      if (res.ok) setResent(true);
    };
    return (
      <section className="rounded-lg p-6" style={panelStyle} data-testid="feedback-verify-required">
        <h2 className="font-mono-display text-lg font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
          {t('verifyTitle')}
        </h2>
        <p className="text-sm mb-5" style={{ color: 'var(--text-secondary)' }}>{t('verifyBody')}</p>
        <ResendButton sent={resent} onClick={resend} />
      </section>
    );
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    if (message.trim().length < FEEDBACK_MIN) {
      setError(t('errors.tooShort', { min: FEEDBACK_MIN }));
      return;
    }
    setState('sending');
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          message,
          pagePath,
          locale,
          company_url: form.get('company_url') || undefined,
        }),
      });
      if (res.ok) {
        setState('sent');
        setMessage('');
        return;
      }
      setError(
        res.status === 429 ? t('errors.tooMany') : res.status === 409 ? t('errors.duplicate') : t('errors.generic'),
      );
    } catch {
      setError(t('errors.generic'));
    }
    setState('idle');
  }

  if (state === 'sent') {
    return (
      <section className="rounded-lg p-6" style={panelStyle} role="status" data-testid="feedback-success">
        <h2 className="font-mono-display text-lg font-bold mb-2" style={{ color: 'var(--accent-green)' }}>
          {t('successTitle')}
        </h2>
        <p className="text-sm mb-5" style={{ color: 'var(--text-secondary)' }}>{t('successBody')}</p>
        <button type="button" onClick={() => setState('idle')}
          className="font-mono-display text-sm underline" style={{ color: 'var(--accent-amber)' }}>
          {t('sendAnother')}
        </button>
      </section>
    );
  }

  const length = message.trim().length;
  return (
    <form onSubmit={submit} method="post" className="rounded-lg p-6 flex flex-col gap-6" style={panelStyle} data-testid="feedback-form" noValidate>
      <fieldset>
        <legend className="font-mono-display text-[11px] font-medium tracking-wider uppercase mb-3"
          style={{ color: 'var(--text-secondary)' }}>
          {t('categoryLabel')}
        </legend>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {FEEDBACK_CATEGORIES.map((c) => {
            const active = c === category;
            return (
              <label key={c}
                className="cursor-pointer rounded-lg p-3 flex flex-col gap-1 transition-colors focus-within:ring-2 focus-within:ring-[var(--accent-amber)]"
                style={{
                  border: active ? '1px solid var(--accent-amber)' : '1px solid var(--border-subtle)',
                  background: active ? 'rgba(212,162,78,0.10)' : 'var(--bg-elevated)',
                }}
                data-testid={`feedback-category-${c}`}
              >
                <input type="radio" name="category" value={c} checked={active}
                  onChange={() => setCategory(c)} className="sr-only" />
                <span className="font-mono-display text-sm font-bold"
                  style={{ color: active ? 'var(--accent-amber)' : 'var(--text-primary)' }}>
                  <span aria-hidden="true">{CATEGORY_ICON[c]} </span>{t(`categories.${c}.label`)}
                </span>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t(`categories.${c}.hint`)}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div>
        <label htmlFor="feedback-message"
          className="block font-mono-display text-[11px] font-medium tracking-wider uppercase mb-1.5"
          style={{ color: 'var(--text-secondary)' }}>
          {t('messageLabel')}
        </label>
        <textarea
          id="feedback-message"
          name="message"
          rows={7}
          maxLength={FEEDBACK_MAX}
          value={message}
          onChange={(e) => { setMessage(e.target.value); if (error) setError(''); }}
          placeholder={t(`placeholders.${category}`)}
          required
          aria-describedby="feedback-count feedback-context"
          className="w-full rounded px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent-amber)] focus:shadow-[0_0_0_2px_var(--glow-amber)]"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-active)', color: 'var(--text-primary)' }}
          data-testid="feedback-message"
        />
        <p id="feedback-count" className="text-right font-mono-display text-[11px] mt-1"
          style={{ color: length > 0 && length < FEEDBACK_MIN ? 'var(--accent-red)' : 'var(--text-muted)' }}>
          {t('charCount', { count: message.length, max: FEEDBACK_MAX })}
        </p>
      </div>

      {/* Honeypot — invisible to humans, bots fill it. Name must not be `website` (User field). */}
      <div aria-hidden="true" style={{ position: 'absolute', left: '-10000px', width: 1, height: 1, overflow: 'hidden' }}>
        <label htmlFor="company_url">Company URL</label>
        <input id="company_url" name="company_url" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="text-xs space-y-1" style={{ color: 'var(--text-muted)' }}>
        <p id="feedback-context">{category === 'BUG' && t('contextNote')}</p>
        <p>
          {t('privacyNote')}{' '}
          <Link href="/legal" className="underline" style={{ color: 'var(--text-secondary)' }}>{t('privacyLink')}</Link>.
        </p>
      </div>

      {error && (
        <p role="alert" className="text-sm rounded px-3 py-2"
          style={{ color: 'var(--accent-red)', background: 'var(--glow-red)', border: '1px solid rgba(196, 78, 78, 0.25)' }}
          data-testid="feedback-error">
          {error}
        </p>
      )}

      <button type="submit" disabled={!hydrated || state === 'sending'}
        className="self-start font-mono-display text-sm font-bold px-5 py-2.5 rounded transition-all disabled:opacity-60 hover:shadow-[0_0_12px_rgba(212,162,78,0.45)]"
        style={{ background: 'var(--accent-amber)', color: '#111' }}
        data-testid="feedback-submit">
        {state === 'sending' ? t('submitting') : t('submit')}
      </button>
    </form>
  );
}

function ResendButton({ sent, onClick }: { sent: boolean; onClick: () => void }) {
  const tAuth = useTranslations('auth');
  if (sent) return <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{tAuth('resendSent')}</p>;
  return (
    <button type="button" onClick={onClick}
      className="font-mono-display text-sm font-bold px-4 py-2 rounded"
      style={{ background: 'var(--accent-amber)', color: '#111' }}>
      {tAuth('resendVerification')}
    </button>
  );
}
