'use client';
import { CommentItem, type CommentData } from './CommentItem';
import { CommentForm } from './CommentForm';
import { useState } from 'react';
import { useTranslations } from 'next-intl';

export interface TopLevelComment extends CommentData {
  replies: CommentData[];
}

interface Props {
  comments: TopLevelComment[];
  currentUserId: string | null;
  isAdmin: boolean;
  onReplySubmit: (parentId: string, body: string) => Promise<void>;
  onEdit: (id: string, body: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  hasMore: boolean;
  onLoadMore: () => void;
}

export function CommentList({ comments, currentUserId, isAdmin, onReplySubmit, onEdit, onDelete, hasMore, onLoadMore }: Props) {
  const t = useTranslations('comments');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);

  if (comments.length === 0) {
    return <p className="text-sm italic" style={{ color: 'var(--text-muted)' }}>{t('emptyState')}</p>;
  }

  return (
    <div>
      {comments.map((c) => (
        <div key={c.id}>
          <CommentItem
            comment={c}
            currentUserId={currentUserId}
            isAdmin={isAdmin}
            onReply={(id) => setReplyingTo(id)}
            onEdit={onEdit}
            onDelete={onDelete}
          />
          <div className="ml-6 pl-3" style={{ borderLeft: '1px solid var(--accent-amber-dim)' }}>
            {c.replies.map((r) => (
              <CommentItem
                key={r.id}
                comment={r}
                currentUserId={currentUserId}
                isAdmin={isAdmin}
                onReply={() => {}}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
            {replyingTo === c.id && (
              <CommentForm
                presetId={c.id}
                parentId={c.id}
                onSubmit={async (body) => { await onReplySubmit(c.id, body); setReplyingTo(null); }}
                onCancel={() => setReplyingTo(null)}
              />
            )}
          </div>
        </div>
      ))}
      {hasMore && (
        <button
          onClick={onLoadMore}
          className="text-xs uppercase tracking-wider mt-2 font-mono-display"
          style={{ color: 'var(--accent-amber)' }}
        >
          {t('loadMore')}
        </button>
      )}
    </div>
  );
}
