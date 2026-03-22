'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ConfirmDialog } from './ConfirmDialog';
import { WarnDialog } from './WarnDialog';

interface UserAdminActionsProps {
  type: 'user';
  targetId: string;
  username: string;
  suspended: boolean;
  onAction?: () => void;
}

interface PresetAdminActionsProps {
  type: 'preset';
  targetId: string;
  isPublic: boolean;
  flagged: boolean;
  onAction?: () => void;
}

type AdminActionsProps = UserAdminActionsProps | PresetAdminActionsProps;

export function AdminActions(props: AdminActionsProps) {
  const t = useTranslations('admin');
  const [confirmAction, setConfirmAction] = useState<string | null>(null);
  const [showWarn, setShowWarn] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleAction(action: string, body?: Record<string, unknown>) {
    setLoading(true);
    try {
      const endpoint = props.type === 'user'
        ? `/api/admin/users/${props.targetId}`
        : `/api/admin/presets/${props.targetId}`;
      const method = action === 'delete' ? 'DELETE' : 'PATCH';

      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });

      if (res.ok) {
        props.onAction?.();
      }
    } finally {
      setLoading(false);
      setConfirmAction(null);
    }
  }

  async function handleWarn(reason: string, message?: string) {
    if (props.type !== 'user') return;
    setLoading(true);
    try {
      await fetch(`/api/admin/users/${props.targetId}/warn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason, message }),
      });
      props.onAction?.();
    } finally {
      setLoading(false);
      setShowWarn(false);
    }
  }

  const buttonClass = 'px-2 py-1 text-xs rounded transition-colors';
  const buttonBorder = (color: string) => ({
    border: `1px solid ${color}`,
    color,
    background: 'transparent',
  });

  if (props.type === 'user') {
    return (
      <>
        <div className="flex gap-2 flex-wrap">
          <button className={buttonClass} style={buttonBorder('#60a5fa')} onClick={() => setShowWarn(true)}>
            {t('actions.warn')}
          </button>
          <button className={buttonClass} style={buttonBorder('#f59e0b')}
            onClick={() => setConfirmAction('suspend')}>
            {props.suspended ? t('actions.unsuspend') : t('actions.suspend')}
          </button>
          <button className={buttonClass} style={buttonBorder('#ef4444')}
            onClick={() => setConfirmAction('delete')}>
            {t('actions.delete')}
          </button>
        </div>

        <ConfirmDialog
          open={confirmAction === 'suspend'}
          message={t('confirm.suspendUser')}
          onConfirm={() => handleAction('patch', { suspended: !props.suspended })}
          onCancel={() => setConfirmAction(null)}
          loading={loading}
        />
        <ConfirmDialog
          open={confirmAction === 'delete'}
          message={t('confirm.deleteUser')}
          onConfirm={() => handleAction('delete')}
          onCancel={() => setConfirmAction(null)}
          loading={loading}
        />
        <WarnDialog
          open={showWarn}
          username={props.username}
          onSend={handleWarn}
          onCancel={() => setShowWarn(false)}
          loading={loading}
        />
      </>
    );
  }

  // Preset actions
  return (
    <>
      <div className="flex gap-2 flex-wrap">
        <button className={buttonClass} style={buttonBorder('#f59e0b')}
          onClick={() => handleAction('patch', { public: !props.isPublic })}>
          {props.isPublic ? t('actions.unpublish') : t('actions.republish')}
        </button>
        <button className={buttonClass} style={buttonBorder('#f59e0b')}
          onClick={() => handleAction('patch', { flagged: !props.flagged })}>
          {props.flagged ? t('actions.unflag') : t('actions.flag')}
        </button>
        <button className={buttonClass} style={buttonBorder('#ef4444')}
          onClick={() => setConfirmAction('delete')}>
          {t('actions.delete')}
        </button>
      </div>

      <ConfirmDialog
        open={confirmAction === 'delete'}
        message={t('confirm.deletePreset')}
        onConfirm={() => handleAction('delete')}
        onCancel={() => setConfirmAction(null)}
        loading={loading}
      />
    </>
  );
}
