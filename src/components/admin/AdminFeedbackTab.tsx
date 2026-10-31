'use client';
import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { FEEDBACK_STATUSES, type FeedbackCategory, type FeedbackStatus } from '@/lib/feedbackValidators';

interface AdminFeedback {
  id: string;
  category: FeedbackCategory;
  message: string;
  pagePath: string | null;
  userAgent: string | null;
  locale: string;
  status: FeedbackStatus;
  createdAt: string;
  user: { id: string; username: string };
}

const CATEGORY_ICON: Record<FeedbackCategory, string> = { BUG: '🐞', IDEA: '💡', GENERAL: '💬' };
const STATUS_COLOR: Record<FeedbackStatus, string> = {
  NEW: 'var(--accent-amber)',
  READ: 'var(--text-secondary)',
  DONE: 'var(--accent-green)',
};

export function AdminFeedbackTab({ onChange }: { onChange?: () => void } = {}) {
  const t = useTranslations('admin.feedback');
  const tf = useTranslations('feedback');
  const [items, setItems] = useState<AdminFeedback[]>([]);
  const [counts, setCounts] = useState<Record<FeedbackStatus, number>>({ NEW: 0, READ: 0, DONE: 0 });
  const [filter, setFilter] = useState<FeedbackStatus | 'ALL'>('NEW');
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (append: boolean, cur: string | null) => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (filter !== 'ALL') qs.set('status', filter);
      if (append && cur) qs.set('cursor', cur);
      const res = await fetch(`/api/admin/feedback?${qs}`);
      if (!res.ok) return;
      const data = await res.json();
      setItems((prev) => (append ? [...prev, ...data.feedback] : data.feedback));
      setCounts(data.counts);
      setCursor(data.nextCursor);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(false, null); }, [load]);

  async function setStatus(id: string, status: FeedbackStatus) {
    const res = await fetch(`/api/admin/feedback/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (res.ok) { load(false, null); onChange?.(); }
  }

  const filters: (FeedbackStatus | 'ALL')[] = [...FEEDBACK_STATUSES, 'ALL'];

  return (
    <div>
      <div className="flex gap-2 mb-4 flex-wrap">
        {filters.map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className="font-mono-display text-xs px-3 py-1 rounded"
            style={{
              border: filter === f ? '1px solid var(--accent-amber)' : '1px solid var(--border-subtle)',
              color: filter === f ? 'var(--accent-amber)' : 'var(--text-secondary)',
            }}>
            {f === 'ALL' ? t('all') : `${t(`status.${f}`)} (${counts[f]})`}
          </button>
        ))}
      </div>

      {items.length === 0 && !loading && (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('empty')}</p>
      )}

      <ul className="flex flex-col gap-3">
        {items.map((f) => (
          <li key={f.id} className="rounded-lg p-4"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
            data-testid="admin-feedback-item">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
              <span className="font-mono-display font-bold" style={{ color: 'var(--text-primary)' }}>
                {CATEGORY_ICON[f.category]} {tf(`categories.${f.category}.label`)}
              </span>
              <span>@{f.user.username}</span>
              <span>{new Date(f.createdAt).toLocaleString()}</span>
              <span>{f.locale}</span>
              <span className="font-mono-display" style={{ color: STATUS_COLOR[f.status] }}>{t(`status.${f.status}`)}</span>
            </div>
            <p className="text-sm whitespace-pre-wrap break-words mb-3" style={{ color: 'var(--text-primary)' }}>{f.message}</p>
            {(f.pagePath || f.userAgent) && (
              <p className="text-[11px] font-mono-display mb-3 break-all" style={{ color: 'var(--text-muted)' }}>
                {t('columnContext')}: {f.pagePath ?? '—'} · {f.userAgent ?? '—'}
              </p>
            )}
            <div className="flex gap-3 text-xs font-mono-display">
              {f.status === 'NEW' && (
                <button onClick={() => setStatus(f.id, 'READ')} style={{ color: 'var(--text-secondary)' }}>{t('markRead')}</button>
              )}
              {f.status !== 'DONE' && (
                <button onClick={() => setStatus(f.id, 'DONE')} style={{ color: 'var(--accent-green)' }}>{t('markDone')}</button>
              )}
              {f.status !== 'NEW' && (
                <button onClick={() => setStatus(f.id, 'NEW')} style={{ color: 'var(--accent-amber)' }}>{t('reopen')}</button>
              )}
            </div>
          </li>
        ))}
      </ul>

      {cursor && (
        <button onClick={() => load(true, cursor)} disabled={loading}
          className="mt-4 font-mono-display text-xs underline" style={{ color: 'var(--accent-amber)' }}>
          {t('loadMore')}
        </button>
      )}
    </div>
  );
}
