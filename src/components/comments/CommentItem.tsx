'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { AutoLink } from '@/lib/autoLink';
import { CommentForm } from './CommentForm';

export interface CommentData {
  id: string;
  body: string | null;
  editedAt: string | null;
  deletedAt: string | null;
  deletedBy: string | null;
  createdAt: string;
  userId: string;
  user: { id: string; username: string; avatarKey?: string | null };
  parentId?: string | null;
}

interface Props {
  comment: CommentData;
  currentUserId: string | null;
  isAdmin: boolean;
  onReply: (parentId: string) => void;
  onEdit: (id: string, body: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function CommentItem({ comment, currentUserId, isAdmin, onReply, onEdit, onDelete }: Props) {
  const t = useTranslations('comments');
  const [editing, setEditing] = useState(false);

  const isOwn = currentUserId === comment.userId;
  const isDeleted = !!comment.deletedAt;
  const placeholder =
    comment.deletedBy === 'ADMIN' ? t('deletedByAdmin') :
    comment.deletedBy === 'AUTHOR' ? t('deletedByAuthor') :
    null;

  return (
    <div
      className="rounded p-3 mb-2"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <div className="flex items-center gap-2 mb-1 text-xs font-mono-display">
        <Link href={`/profile/${comment.user.username}`} style={{ color: 'var(--accent-amber)' }}>
          @{comment.user.username}
        </Link>
        <span style={{ color: 'var(--text-muted)' }}>
          {new Date(comment.createdAt).toLocaleString()}
        </span>
        {comment.editedAt && (
          <span className="italic" style={{ color: 'var(--text-muted)' }}>({t('edited')})</span>
        )}
      </div>

      {isDeleted ? (
        <p className="italic text-sm" style={{ color: 'var(--text-muted)' }}>{placeholder}</p>
      ) : editing ? (
        <CommentForm
          presetId="(edit)"
          initialValue={comment.body ?? ''}
          isEdit
          onSubmit={async (b) => { await onEdit(comment.id, b); setEditing(false); }}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <p className="text-sm" style={{ color: 'var(--text-primary)' }}>
          <AutoLink text={comment.body ?? ''} />
        </p>
      )}

      {!isDeleted && !editing && (
        <div className="flex gap-2 mt-2 text-[10px] font-mono-display uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          {!comment.parentId && (
            <button onClick={() => onReply(comment.id)}>{t('reply')}</button>
          )}
          {isOwn && (
            <>
              <button onClick={() => setEditing(true)}>{t('edit')}</button>
              <button onClick={() => onDelete(comment.id)}>{t('delete')}</button>
            </>
          )}
          {isAdmin && !isOwn && (
            <button onClick={() => onDelete(comment.id)} style={{ color: '#ef4444' }}>{t('delete')}</button>
          )}
        </div>
      )}
    </div>
  );
}
