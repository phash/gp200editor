'use client';
import { useCallback, useEffect, useState } from 'react';
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

  const load = useCallback(async (initial = false) => {
    const url = `/api/presets/${presetId}/comments${!initial && cursor ? `?cursor=${cursor}` : ''}`;
    const res = await fetch(url);
    if (!res.ok) return;
    const data = await res.json();
    setComments((prev) => initial ? data.comments : [...prev, ...data.comments]);
    setCursor(data.nextCursor);
    setHasMore(!!data.nextCursor);
  }, [presetId, cursor]);

  useEffect(() => { load(true); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [presetId]);

  function handleError(status: number) {
    if (status === 429) setToast(t('rateLimitToast'));
    setTimeout(() => setToast(null), 3000);
  }

  async function postTop(body: string) {
    const res = await fetch(`/api/presets/${presetId}/comments`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ body }),
    });
    if (res.ok) { setCursor(null); load(true); } else handleError(res.status);
  }

  async function postReply(parentId: string, body: string) {
    const res = await fetch(`/api/comments/${parentId}/reply`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ body }),
    });
    if (res.ok) { setCursor(null); load(true); } else handleError(res.status);
  }

  async function edit(id: string, body: string) {
    const res = await fetch(`/api/comments/${id}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ body }),
    });
    if (res.ok) { setCursor(null); load(true); } else handleError(res.status);
  }

  async function del(id: string) {
    const res = await fetch(`/api/comments/${id}`, { method: 'DELETE' });
    if (res.ok) { setCursor(null); load(true); } else handleError(res.status);
  }

  return (
    <section className="mt-8">
      <h3 className="font-mono-display text-sm uppercase tracking-widest mb-3" style={{ color: 'var(--text-secondary)' }}>
        Comments
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
          Email verification required to comment.
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
