'use client';
import { useTranslations } from 'next-intl';
import type { UseMidiDeviceReturn } from '@/hooks/useMidiDevice';
import { SysExCodec } from '@/core/SysExCodec';
// Firmware compat uses versionAccepted from handshake, not string matching
import { useState, useEffect } from 'react';

interface DeviceStatusBarProps {
  midiDevice: UseMidiDeviceReturn;
  currentPresetName: string | null;
  hasPreset: boolean;
  onPullRequest: () => void;
  onPushRequest: () => void;
  onSaveToActiveSlot?: () => void;
  onPresetNameChange?: (name: string) => void;
}

export function DeviceStatusBar({
  midiDevice,
  currentPresetName,
  hasPreset,
  onPullRequest,
  onPushRequest,
  onSaveToActiveSlot,
  onPresetNameChange,
}: DeviceStatusBarProps) {
  const t = useTranslations('device');
  const { status, errorMessage, currentSlot, connect, disconnect } = midiDevice;
  const [webMidiSupported, setWebMidiSupported] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');

  useEffect(() => {
    setWebMidiSupported('requestMIDIAccess' in navigator);
  }, []);

  const ledColor =
    status === 'connected'    ? 'var(--accent-green)' :
    status === 'connecting'   ? 'var(--accent-amber)' :
    status === 'handshaking'  ? 'var(--accent-amber)' :
    status === 'error'        ? 'var(--accent-red)'   :
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
          boxShadow: (status === 'connected') ? `0 0 6px ${ledColor}` :
                     (status === 'connecting' || status === 'handshaking') ? `0 0 6px ${ledColor}` : 'none',
          animation: (status === 'connecting' || status === 'handshaking') ? 'pulse 1s infinite' : 'none',
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
      {status === 'handshaking' && (
        <span className="font-mono-display" style={{ color: 'var(--accent-amber)' }}>
          {t('handshaking')}
          {midiDevice.handshakeStep && (
            <span style={{ color: 'var(--text-muted)', marginLeft: 8, fontSize: '0.85em' }}>
              {midiDevice.handshakeStep}
            </span>
          )}
        </span>
      )}
      {status === 'connected' && (
        <span className="font-mono-display" style={{ color: 'var(--accent-green)', fontSize: '0.8em' }}>
          GP-200
          {midiDevice.deviceInfo && (
            <span style={{ color: 'var(--text-muted)', marginLeft: 4, fontSize: '0.9em' }}>
              {t('firmware', { version: midiDevice.deviceInfo.firmwareValues.join('.') })}
            </span>
          )}
          {midiDevice.deviceInfo && !midiDevice.deviceInfo.versionAccepted && (
            <span style={{ color: 'var(--accent-red)', marginLeft: 8, fontSize: '0.85em' }} title={t('versionWarning')}>
              ⚠
            </span>
          )}
          <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>
            · {t('loadSlot')} <strong style={{ color: 'var(--accent-amber)' }}>{slotLabel}</strong>
            {editingName ? (
              <input
                autoFocus
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value.slice(0, 16))}
                onBlur={() => { if (onPresetNameChange && nameInput) onPresetNameChange(nameInput); setEditingName(false); }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { if (onPresetNameChange && nameInput) onPresetNameChange(nameInput); setEditingName(false); }
                  if (e.key === 'Escape') setEditingName(false);
                }}
                maxLength={16}
                className="font-mono-display text-sm bg-transparent border-b outline-none ml-2"
                style={{ color: 'var(--accent-amber)', borderColor: 'var(--accent-amber)', width: `${Math.max(nameInput.length, 4)}ch` }}
              />
            ) : (
              <span
                onDoubleClick={() => {
                  if (!onPresetNameChange) return;
                  const name = currentPresetName || midiDevice.presetNames[currentSlot!] || '';
                  setNameInput(name);
                  setEditingName(true);
                }}
                style={{ cursor: onPresetNameChange ? 'text' : 'default' }}
                title={onPresetNameChange ? t('loadSlot') : undefined}
              >
                {slotName}
              </span>
            )}
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
            {onSaveToActiveSlot && currentSlot !== null && hasPreset && (
              <button
                onClick={onSaveToActiveSlot}
                className="font-mono-display text-xs font-bold px-3 py-1 rounded"
                style={{ border: '1px solid rgba(74,222,128,0.4)', color: 'var(--accent-green)', background: 'rgba(74,222,128,0.06)' }}
              >
                {t('saveToActiveSlot', { slot: slotLabel })}
              </button>
            )}
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
