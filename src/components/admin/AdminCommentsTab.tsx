'use client';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

interface AdminComment {
  id: string;
  body: string | null;
  createdAt: string;
  deletedAt: string | null;
  user: { id: string; username: string };
  preset: { id: string; name: string; shareToken: string };
}

export function AdminCommentsTab() {
  const t = useTranslations('admin.comments');
  const [comments, setComments] = useState<AdminComment[]>([]);
  const [target, setTarget] = useState<AdminComment | null>(null);
  const [reason, setReason] = useState('');

  async function load() {
    const res = await fetch('/api/admin/comments');
    if (res.ok) {
      const data = await res.json();
      setComments(data.comments);
    }
  }
  useEffect(() => { load(); }, []);

  async function hardDelete() {
    if (!target || reason.trim().length < 5) return;
    const res = await fetch(`/api/comments/${target.id}`, {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    if (res.ok) {
      setTarget(null); setReason('');
      load();
    }
  }

  return (
    <div>
      <table className="w-full text-sm">
        <thead>
          <tr style={{ color: 'var(--text-muted)' }}>
            <th className="text-left">{t('columnUser')}</th>
            <th className="text-left">{t('columnPreset')}</th>
            <th className="text-left">{t('columnBody')}</th>
            <th className="text-left">{t('columnDate')}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {comments.map((c) => (
            <tr key={c.id} style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <td>@{c.user.username}</td>
              <td>{c.preset.name}</td>
              <td className="truncate max-w-xs" style={{ opacity: c.deletedAt ? 0.4 : 1 }}>
                {c.body ?? '(deleted)'}
              </td>
              <td>{new Date(c.createdAt).toLocaleString()}</td>
              <td>
                {!c.deletedAt && (
                  <button onClick={() => setTarget(c)} style={{ color: '#ef4444' }}>
                    {t('hardDeleteButton')}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {target && (
        <div role="dialog" className="fixed inset-0 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="p-4 rounded max-w-md" style={{ background: 'var(--surface)', border: '1px solid var(--accent-amber-dim)' }}>
            <h4 className="font-mono-display mb-2">{t('hardDeleteDialogTitle')}</h4>
            <label className="text-xs block mb-1">{t('hardDeleteReasonLabel')}</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value.slice(0, 200))}
              rows={3}
              className="w-full p-2 text-sm rounded mb-3"
              style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--text-primary)', border: '1px solid rgba(255,255,255,0.08)' }}
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => { setTarget(null); setReason(''); }} className="px-3 py-1">Cancel</button>
              <button onClick={hardDelete} disabled={reason.trim().length < 5} style={{ color: '#ef4444' }} className="px-3 py-1">
                {t('confirmDelete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
