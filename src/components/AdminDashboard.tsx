'use client';

import { useEffect, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { ConfirmDialog } from './ConfirmDialog';
import { WarnDialog } from './WarnDialog';

type Tab = 'users' | 'presets' | 'errors' | 'auditLog';

interface Stats { userCount: number; presetCount: number; errorCount: number; suspendedCount: number; }
interface AdminUser { id: string; username: string; email: string; role: string; suspended: boolean; avatarUrl: string | null; createdAt: string; presetCount: number; }
interface AdminPreset { id: string; name: string; author: string | null; style: string | null; public: boolean; flagged: boolean; modules: string[]; downloadCount: number; ratingAverage: number; createdAt: string; ownerUsername: string; }
interface ErrorEntry { id: string; level: string; message: string; stack: string | null; url: string | null; userId: string | null; metadata: unknown; createdAt: string; }
interface AuditEntry { id: string; adminUsername: string; action: string; targetType: string; targetId: string; reason: string | null; metadata: unknown; createdAt: string; }

function buildGhIssueUrl(error: ErrorEntry): string {
  const title = encodeURIComponent(`[Bug] ${error.message}${error.url ? ` in ${error.url}` : ''}`);
  const body = encodeURIComponent(
    `## Error Details\n- **Message:** ${error.message}\n- **Route:** ${error.url ?? 'N/A'}\n- **Time:** ${error.createdAt}\n- **User:** ${error.userId ?? 'N/A'}\n\n` +
    (error.stack ? `## Stack Trace\n\`\`\`\n${error.stack}\n\`\`\`\n\n` : '') +
    (error.metadata ? `## Metadata\n\`\`\`json\n${JSON.stringify(error.metadata, null, 2)}\n\`\`\`\n` : '')
  );
  return `https://github.com/phash/gp200editor/issues/new?title=${title}&body=${body}`;
}

export function AdminDashboard() {
  const t = useTranslations('admin');

  const [tab, setTab] = useState<Tab>('users');
  const [stats, setStats] = useState<Stats>({ userCount: 0, presetCount: 0, errorCount: 0, suspendedCount: 0 });
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [presets, setPresets] = useState<AdminPreset[]>([]);
  const [errors, setErrors] = useState<ErrorEntry[]>([]);
  const [actions, setActions] = useState<AuditEntry[]>([]);
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState('');
  const [flaggedFilter, setFlaggedFilter] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [expandedError, setExpandedError] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [warnTarget, setWarnTarget] = useState<{ id: string; username: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const limit = 20;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const fetchStats = useCallback(() => {
    fetch('/api/admin/stats').then((r) => r.ok ? r.json() : null).then((d) => d && setStats(d)).catch(() => {});
  }, []);

  const fetchUsers = useCallback(() => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (search) params.set('q', search);
    fetch(`/api/admin/users?${params}`).then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) { setUsers(d.users); setTotal(d.total); } }).catch(() => {});
  }, [page, search]);

  const fetchPresets = useCallback(() => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (search) params.set('q', search);
    if (flaggedFilter) params.set('flagged', 'true');
    fetch(`/api/admin/presets?${params}`).then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) { setPresets(d.presets); setTotal(d.total); } }).catch(() => {});
  }, [page, search, flaggedFilter]);

  const fetchErrors = useCallback(() => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (search) params.set('q', search);
    if (levelFilter) params.set('level', levelFilter);
    fetch(`/api/admin/errors?${params}`).then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) { setErrors(d.errors); setTotal(d.total); } }).catch(() => {});
  }, [page, search, levelFilter]);

  const fetchActions = useCallback(() => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    fetch(`/api/admin/actions?${params}`).then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) { setActions(d.actions); setTotal(d.total); } }).catch(() => {});
  }, [page]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  useEffect(() => {
    setPage(1);
  }, [tab, search, levelFilter, flaggedFilter]);

  useEffect(() => {
    if (tab === 'users') fetchUsers();
    else if (tab === 'presets') fetchPresets();
    else if (tab === 'errors') fetchErrors();
    else if (tab === 'auditLog') fetchActions();
  }, [tab, fetchUsers, fetchPresets, fetchErrors, fetchActions]);

  function reload() { fetchStats(); if (tab === 'users') fetchUsers(); else if (tab === 'presets') fetchPresets(); else if (tab === 'errors') fetchErrors(); else fetchActions(); }

  async function adminFetch(url: string, method: string, body?: unknown) {
    setLoading(true);
    try {
      const res = await fetch(url, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      return res.ok;
    } finally { setLoading(false); }
  }

  async function handleUserAction(id: string, action: string, body?: unknown) {
    const url = action === 'delete' ? `/api/admin/users/${id}` : `/api/admin/users/${id}`;
    const method = action === 'delete' ? 'DELETE' : 'PATCH';
    if (await adminFetch(url, method, body)) reload();
    setConfirmAction(null);
  }

  async function handlePresetAction(id: string, action: string, body?: unknown) {
    const url = `/api/admin/presets/${id}`;
    const method = action === 'delete' ? 'DELETE' : 'PATCH';
    if (await adminFetch(url, method, body)) reload();
    setConfirmAction(null);
  }

  async function handleDeleteError(id: string) {
    if (await adminFetch(`/api/admin/errors/${id}`, 'DELETE')) reload();
    setConfirmAction(null);
  }

  async function handleDeleteAllErrors() {
    if (await adminFetch('/api/admin/errors', 'DELETE')) reload();
    setConfirmAction(null);
  }

  async function handleWarnUser(reason: string, message?: string) {
    if (!warnTarget) return;
    setLoading(true);
    try {
      await fetch(`/api/admin/users/${warnTarget.id}/warn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason, message }),
      });
    } finally {
      setLoading(false);
      setWarnTarget(null);
      reload();
    }
  }

  const tabs: Tab[] = ['users', 'presets', 'errors', 'auditLog'];
  const tabLabels: Record<Tab, string> = { users: t('users'), presets: t('presets'), errors: t('errors'), auditLog: t('auditLog') };

  const btnStyle = (color: string) => ({ border: `1px solid ${color}`, color, background: 'transparent' });
  const btnClass = 'px-2.5 py-1 text-xs rounded transition-colors cursor-pointer';

  return (
    <div>
      {/* Stats Bar */}
      <div className="grid grid-cols-4 gap-px rounded-lg overflow-hidden mb-6" style={{ background: 'var(--border-subtle)' }}>
        {[
          { label: t('stats.users'), value: stats.userCount, color: 'var(--accent-amber)' },
          { label: t('stats.presets'), value: stats.presetCount, color: 'var(--accent-amber)' },
          { label: t('stats.errors'), value: stats.errorCount, color: stats.errorCount > 0 ? '#ef4444' : 'var(--accent-amber)' },
          { label: t('stats.suspended'), value: stats.suspendedCount, color: 'var(--accent-amber)' },
        ].map((s) => (
          <div key={s.label} className="text-center py-4" style={{ background: 'var(--bg-surface)' }}>
            <div className="text-2xl font-mono" style={{ color: s.color }}>{s.value}</div>
            <div className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b mb-4" style={{ borderColor: 'var(--border-subtle)' }}>
        {tabs.map((t_) => (
          <button key={t_} onClick={() => setTab(t_)}
            className="px-6 py-3 text-sm cursor-pointer relative"
            style={{
              color: tab === t_ ? 'var(--accent-amber)' : 'var(--text-muted)',
              borderBottom: tab === t_ ? '2px solid var(--accent-amber)' : '2px solid transparent',
            }}>
            {tabLabels[t_]}
            {t_ === 'errors' && stats.errorCount > 0 && (
              <span className="absolute top-2 -right-0 text-[10px] px-1.5 rounded-full" style={{ background: '#ef4444', color: '#fff' }}>{stats.errorCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* Search / Filter Bar */}
      <div className="flex gap-3 mb-4 items-center">
        {tab !== 'auditLog' && (
          <input
            type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder={tab === 'users' ? t('searchUsers') : tab === 'presets' ? t('searchPresets') : t('searchErrors')}
            className="flex-1 px-3 py-2 rounded-lg text-sm"
            style={{ background: 'var(--bg-input, #2a2a2a)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
          />
        )}
        {tab === 'errors' && (
          <>
            <select value={levelFilter} onChange={(e) => setLevelFilter(e.target.value)}
              className="px-3 py-2 rounded-lg text-sm"
              style={{ background: 'var(--bg-input, #2a2a2a)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
              <option value="">{t('allLevels')}</option>
              <option value="error">error</option>
              <option value="warn">warn</option>
            </select>
            <button className={btnClass} style={btnStyle('#ef4444')}
              onClick={() => setConfirmAction({ message: t('confirm.deleteAllErrors'), onConfirm: handleDeleteAllErrors })}>
              {t('actions.deleteAll')}
            </button>
          </>
        )}
        {tab === 'presets' && (
          <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
            <input type="checkbox" checked={flaggedFilter} onChange={(e) => setFlaggedFilter(e.target.checked)} />
            {t('badges.flagged')}
          </label>
        )}
      </div>

      {/* Users Tab */}
      {tab === 'users' && (
        <div className="space-y-2">
          {users.length === 0 && <p className="text-sm py-8 text-center" style={{ color: 'var(--text-muted)' }}>{t('noResults')}</p>}
          {users.map((u) => (
            <div key={u.id} className="flex items-center p-3 rounded-lg"
              style={{
                background: 'var(--bg-card, #1a1a1a)',
                borderLeft: u.suspended ? '3px solid #ef4444' : undefined,
                opacity: u.suspended ? 0.7 : 1,
              }}>
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm mr-3"
                style={{ background: 'var(--border-subtle)', color: 'var(--text-muted)' }}>
                {u.username.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm" style={{ color: 'var(--text-primary)' }}>
                  {u.username}
                  {u.role === 'ADMIN' && <span className="ml-2 text-[11px] px-1.5 py-0.5 rounded" style={{ color: 'var(--accent-amber)', background: 'rgba(245,158,11,0.12)' }}>{t('badges.admin')}</span>}
                  {u.suspended && <span className="ml-2 text-[11px] px-1.5 py-0.5 rounded" style={{ color: '#ef4444', background: 'rgba(239,68,68,0.12)' }}>{t('badges.suspended')}</span>}
                </div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {u.email} · {t('presetCount', { count: u.presetCount })} · {t('memberSince', { date: new Date(u.createdAt).toLocaleDateString() })}
                </div>
              </div>
              <div className="flex gap-1.5">
                <button className={btnClass} style={btnStyle('#60a5fa')} onClick={() => setWarnTarget({ id: u.id, username: u.username })}>{t('actions.warn')}</button>
                <button className={btnClass} style={btnStyle('#f59e0b')}
                  onClick={() => setConfirmAction({ message: t('confirm.suspendUser'), onConfirm: () => handleUserAction(u.id, 'patch', { suspended: !u.suspended }) })}>
                  {u.suspended ? t('actions.unsuspend') : t('actions.suspend')}
                </button>
                <button className={btnClass} style={btnStyle('#ef4444')}
                  onClick={() => setConfirmAction({ message: t('confirm.deleteUser'), onConfirm: () => handleUserAction(u.id, 'delete') })}>
                  {t('actions.delete')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Presets Tab */}
      {tab === 'presets' && (
        <div className="space-y-2">
          {presets.length === 0 && <p className="text-sm py-8 text-center" style={{ color: 'var(--text-muted)' }}>{t('noResults')}</p>}
          {presets.map((p) => (
            <div key={p.id} className="flex items-center p-3 rounded-lg"
              style={{ background: 'var(--bg-card, #1a1a1a)', borderLeft: p.flagged ? '3px solid #f59e0b' : undefined }}>
              <div className="flex-1 min-w-0">
                <div className="text-sm" style={{ color: 'var(--text-primary)' }}>
                  {p.name}
                  {p.flagged && <span className="ml-2 text-[11px] px-1.5 py-0.5 rounded" style={{ color: '#f59e0b', background: 'rgba(245,158,11,0.12)' }}>{t('badges.flagged')}</span>}
                  {!p.public && <span className="ml-2 text-[11px] px-1.5 py-0.5 rounded" style={{ color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)' }}>private</span>}
                </div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {p.ownerUsername} · {p.modules.join(', ')} · {t('downloads', { count: p.downloadCount })} · ★{p.ratingAverage.toFixed(1)}
                </div>
              </div>
              <div className="flex gap-1.5">
                <button className={btnClass} style={btnStyle('#f59e0b')}
                  onClick={() => handlePresetAction(p.id, 'patch', { public: !p.public })}>
                  {p.public ? t('actions.unpublish') : t('actions.republish')}
                </button>
                <button className={btnClass} style={btnStyle('#f59e0b')}
                  onClick={() => handlePresetAction(p.id, 'patch', { flagged: !p.flagged })}>
                  {p.flagged ? t('actions.unflag') : t('actions.flag')}
                </button>
                <button className={btnClass} style={btnStyle('#ef4444')}
                  onClick={() => setConfirmAction({ message: t('confirm.deletePreset'), onConfirm: () => handlePresetAction(p.id, 'delete') })}>
                  {t('actions.delete')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Errors Tab */}
      {tab === 'errors' && (
        <div className="space-y-1">
          {errors.length === 0 && <p className="text-sm py-8 text-center" style={{ color: 'var(--text-muted)' }}>{t('noResults')}</p>}
          {errors.map((err) => (
            <div key={err.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <div className="flex items-center p-3 cursor-pointer" onClick={() => setExpandedError(expandedError === err.id ? null : err.id)}>
                <span className="text-[11px] font-mono px-1.5 py-0.5 rounded mr-3"
                  style={{
                    color: err.level === 'error' ? '#ef4444' : '#f59e0b',
                    background: err.level === 'error' ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)',
                  }}>
                  {err.level.toUpperCase()}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-mono truncate" style={{ color: 'var(--text-primary)' }}>{err.message}</div>
                  <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    {err.url ?? ''} · {err.userId ?? '—'} · {new Date(err.createdAt).toLocaleString()}
                  </div>
                </div>
                <span style={{ color: 'var(--text-muted)' }}>{expandedError === err.id ? '▼' : '▶'}</span>
              </div>
              {expandedError === err.id && (
                <div className="px-3 pb-3">
                  {err.stack && (
                    <pre className="text-xs p-3 rounded-lg mb-3 overflow-x-auto font-mono"
                      style={{ background: 'var(--bg-deep, #0d0d0d)', color: 'var(--text-muted)', maxHeight: '160px', overflowY: 'auto' }}>
                      {err.stack}
                      {err.metadata ? `\n--- Metadata ---\n${JSON.stringify(err.metadata, null, 2)}` : null}
                    </pre>
                  )}
                  <div className="flex gap-2">
                    <a href={buildGhIssueUrl(err)} target="_blank" rel="noopener noreferrer"
                      className={btnClass + ' flex items-center gap-1.5 no-underline'} style={btnStyle('var(--text-primary)')}>
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
                      {t('actions.createIssue')}
                    </a>
                    <button className={btnClass} style={btnStyle('var(--text-secondary)')}
                      onClick={() => navigator.clipboard.writeText(`${err.message}\n${err.stack ?? ''}\n${JSON.stringify(err.metadata)}`)}>
                      {t('actions.copy')}
                    </button>
                    <button className={btnClass} style={btnStyle('#ef4444')}
                      onClick={() => setConfirmAction({ message: t('confirm.deleteError'), onConfirm: () => handleDeleteError(err.id) })}>
                      {t('actions.delete')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Audit Log Tab */}
      {tab === 'auditLog' && (
        <div className="space-y-1">
          {actions.length === 0 && <p className="text-sm py-8 text-center" style={{ color: 'var(--text-muted)' }}>{t('noResults')}</p>}
          {actions.map((a) => (
            <div key={a.id} className="flex items-center p-3 rounded-lg" style={{ background: 'var(--bg-card, #1a1a1a)' }}>
              <div className="flex-1">
                <div className="text-sm" style={{ color: 'var(--text-primary)' }}>
                  <span style={{ color: 'var(--accent-amber)' }}>{a.adminUsername}</span>
                  {' → '}
                  <span className="font-mono text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.05)' }}>{a.action}</span>
                  {' → '}
                  <span style={{ color: 'var(--text-secondary)' }}>{a.targetType}:{a.targetId.slice(0, 8)}</span>
                </div>
                {a.reason && <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Reason: {a.reason}</div>}
              </div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{new Date(a.createdAt).toLocaleString()}</div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-4 mt-6">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)}
            className="px-3 py-1 rounded text-sm" style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
            ←
          </button>
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('page', { page, total: totalPages })}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}
            className="px-3 py-1 rounded text-sm" style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
            →
          </button>
        </div>
      )}

      {/* Dialogs */}
      <ConfirmDialog
        open={!!confirmAction}
        message={confirmAction?.message ?? ''}
        onConfirm={() => confirmAction?.onConfirm()}
        onCancel={() => setConfirmAction(null)}
        loading={loading}
      />
      <WarnDialog
        open={!!warnTarget}
        username={warnTarget?.username ?? ''}
        onSend={handleWarnUser}
        onCancel={() => setWarnTarget(null)}
        loading={loading}
      />
    </div>
  );
}
