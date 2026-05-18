'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { CommentList, type TopLevelComment } from './CommentList';
import { CommentForm } from './CommentForm';

interface Props {
  presetId: string;
  currentUserId: string | null;
  isVerified: boolean;
  isAdmin: boolean;
}

export function CommentSection({ presetId, currentUserId, isVerified, isAdmin }: Props) {
  const t = useTranslations('comments');
  const [comments, setComments] = useState<TopLevelComment[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = useRef(false);

  function showToast(msg: string) {
    setToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 3000);
  }

  // Toast message per response status. 401 happens when the session expired
  // mid-typing; 429 is rate limit; anything else surfaces a generic error.
  function toastForStatus(status: number) {
    if (status === 429) showToast(t('rateLimitToast'));
    else if (status === 401 || status === 403) showToast(t('authToast'));
    else showToast(t('genericError'));
  }

  const load = useCallback(async (initial = false) => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      // Read cursor at call-time via the closure — passing `initial=true`
      // forces a fresh fetch ignoring the saved cursor (used after mutations).
      const cur = initial ? null : cursor;
      const url = `/api/presets/${presetId}/comments${cur ? `?cursor=${cur}` : ''}`;
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();
      setComments((prev) => initial ? data.comments : [...prev, ...data.comments]);
      setCursor(data.nextCursor);
      setHasMore(!!data.nextCursor);
    } finally {
      inFlightRef.current = false;
    }
  }, [presetId, cursor]);

  // Reload from scratch when presetId changes. We deliberately exclude `load`
  // from deps — its identity changes whenever cursor updates after a fetch,
  // and re-running this effect on every cursor flip would infinitely re-load.
  useEffect(() => { load(true); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [presetId]);

  // Each mutation throws on non-OK so CommentForm can keep the user's text.
  // The parent catches and surfaces the right toast for the status.
  async function postTop(body: string) {
    const res = await fetch(`/api/presets/${presetId}/comments`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ body }),
    });
    if (!res.ok) { toastForStatus(res.status); throw new Error(`HTTP ${res.status}`); }
    load(true);
  }

  async function postReply(parentId: string, body: string) {
    const res = await fetch(`/api/comments/${parentId}/reply`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ body }),
    });
    if (!res.ok) { toastForStatus(res.status); throw new Error(`HTTP ${res.status}`); }
    load(true);
  }

  async function edit(id: string, body: string) {
    const res = await fetch(`/api/comments/${id}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ body }),
    });
    if (!res.ok) { toastForStatus(res.status); throw new Error(`HTTP ${res.status}`); }
    load(true);
  }

  async function del(id: string) {
    const res = await fetch(`/api/comments/${id}`, { method: 'DELETE' });
    if (!res.ok) { toastForStatus(res.status); return; }
    load(true);
  }

  return (
    <section className="mt-8">
      <h3 className="font-mono-display text-sm uppercase tracking-widest mb-3" style={{ color: 'var(--text-secondary)' }}>
        {t('heading')}
      </h3>

      {!currentUserId ? (
        <p className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>
          <Link href="/auth/login" className="underline" style={{ color: 'var(--accent-amber)' }}>
            {t('signInToComment')}
          </Link>
        </p>
      ) : isVerified ? (
        <CommentForm presetId={presetId} onSubmit={postTop} />
      ) : (
        <p className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>
          {t('verifyRequired')}
        </p>
      )}

      <CommentList
        comments={comments}
        currentUserId={currentUserId}
        isAdmin={isAdmin}
        onReplySubmit={postReply}
        onEdit={edit}
        onDelete={del}
        hasMore={hasMore}
        onLoadMore={() => load(false)}
      />

      {toast && (
        <div className="fixed bottom-4 right-4 px-3 py-2 rounded text-sm"
          style={{ background: 'var(--surface)', border: '1px solid var(--accent-amber-dim)', color: 'var(--text-primary)' }}>
          {toast}
        </div>
      )}
    </section>
  );
}
