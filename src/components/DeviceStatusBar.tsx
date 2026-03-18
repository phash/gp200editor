'use client';
import { useTranslations } from 'next-intl';
import type { UseMidiDeviceReturn } from '@/hooks/useMidiDevice';
import { SysExCodec } from '@/core/SysExCodec';
import { useState, useEffect } from 'react';

interface DeviceStatusBarProps {
  midiDevice: UseMidiDeviceReturn;
  currentPresetName: string | null;
  hasPreset: boolean;
  onPullRequest: () => void;
  onPushRequest: () => void;
}

export function DeviceStatusBar({
  midiDevice,
  currentPresetName,
  hasPreset,
  onPullRequest,
  onPushRequest,
}: DeviceStatusBarProps) {
  const t = useTranslations('device');
  const { status, errorMessage, currentSlot, connect, disconnect } = midiDevice;
  const [webMidiSupported, setWebMidiSupported] = useState(false);

  useEffect(() => {
    setWebMidiSupported('requestMIDIAccess' in navigator);
  }, []);

  const ledColor =
    status === 'connected'   ? 'var(--accent-green)' :
    status === 'connecting'  ? 'var(--accent-amber)' :
    status === 'error'       ? 'var(--accent-red)'   :
    '#555';

  const slotLabel = currentSlot !== null ? SysExCodec.slotToLabel(currentSlot) : '—';
  const slotName  = currentSlot !== null && midiDevice.presetNames[currentSlot]
    ? ` »${midiDevice.presetNames[currentSlot]}«`
    : currentPresetName ? ` »${currentPresetName}«` : '';

  return (
    <div
      className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm"
      style={{
        border: `1px solid ${status === 'connected' ? 'rgba(74,222,128,0.25)' : 'rgba(255,255,255,0.08)'}`,
        background: status === 'connected' ? 'rgba(74,222,128,0.04)' : 'rgba(255,255,255,0.02)',
      }}
      data-testid="device-status-bar"
    >
      {/* LED */}
      <span
        style={{
          width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
          background: ledColor,
          boxShadow: status === 'connected' ? `0 0 6px ${ledColor}` :
                     status === 'connecting' ? `0 0 6px ${ledColor}` : 'none',
          animation: status === 'connecting' ? 'pulse 1s infinite' : 'none',
        }}
      />

      {/* Status text */}
      {status === 'disconnected' && (
        <span className="font-mono-display" style={{ color: 'var(--text-muted)' }}>
          {t('noDevice')}
        </span>
      )}
      {status === 'connecting' && (
        <span className="font-mono-display" style={{ color: 'var(--accent-amber)' }}>
          {t('connecting')}
        </span>
      )}
      {status === 'connected' && (
        <span className="font-mono-display" style={{ color: 'var(--accent-green)', fontSize: '0.8em' }}>
          GP-200
          <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>
            · Slot <strong style={{ color: 'var(--accent-amber)' }}>{slotLabel}</strong>
            {slotName}
          </span>
        </span>
      )}
      {status === 'error' && (
        <span className="font-mono-display" style={{ color: 'var(--accent-red)', fontSize: '0.8em' }}>
          {errorMessage ?? t('error')}
        </span>
      )}

      {/* Actions */}
      <div className="ml-auto flex gap-2">
        {status === 'disconnected' && !webMidiSupported && (
          <span className="font-mono-display" style={{ color: 'var(--text-muted)', fontSize: '0.75em' }}>
            {t('chromeOnly')}
          </span>
        )}
        {status === 'disconnected' && webMidiSupported && (
          <button
            onClick={connect}
            className="font-mono-display text-xs font-bold uppercase px-3 py-1 rounded"
            style={{ border: '1px solid rgba(212,162,78,0.4)', color: 'var(--accent-amber)', background: 'transparent' }}
          >
            {t('connect')}
          </button>
        )}
        {status === 'error' && (
          <button
            onClick={connect}
            className="font-mono-display text-xs font-bold uppercase px-3 py-1 rounded"
            style={{ border: '1px solid rgba(255,80,80,0.4)', color: 'var(--accent-red)', background: 'transparent' }}
          >
            {t('retry')}
          </button>
        )}
        {status === 'connected' && (
          <>
            <button
              onClick={onPullRequest}
              className="font-mono-display text-xs font-bold px-3 py-1 rounded"
              style={{ border: '1px solid rgba(212,162,78,0.4)', color: 'var(--accent-amber)', background: 'rgba(212,162,78,0.06)' }}
            >
              {t('pull')}
            </button>
            <button
              onClick={onPushRequest}
              disabled={!hasPreset}
              className="font-mono-display text-xs font-bold px-3 py-1 rounded disabled:opacity-40"
              style={{ border: '1px solid rgba(212,162,78,0.4)', color: 'var(--accent-amber)', background: 'rgba(212,162,78,0.06)' }}
            >
              {t('push')}
            </button>
            <button
              onClick={disconnect}
              className="font-mono-display text-xs px-2 py-1 rounded"
              style={{ color: 'var(--text-muted)', opacity: 0.5 }}
            >
              ×
            </button>
          </>
        )}
      </div>
    </div>
  );
}
