'use client';
import { useTranslations } from 'next-intl';
import { FileUpload } from '@/components/FileUpload';
import { EffectSlot } from '@/components/EffectSlot';
import { EffectSlotCard } from '@/components/EffectSlotCard';
import { PatchCableOverlay } from '@/components/PatchCableOverlay';
import { usePreset } from '@/hooks/usePreset';
import { PRSTDecoder } from '@/core/PRSTDecoder';
import { PRSTEncoder } from '@/core/PRSTEncoder';
import { useCallback, useState, useEffect, useRef } from 'react';
import { useRouter } from '@/i18n/routing';
import { useMidiDeviceContext } from '@/contexts/MidiDeviceContext';
import { DeviceStatusBar } from '@/components/DeviceStatusBar';
import { DeviceSlotBrowser } from '@/components/DeviceSlotBrowser';
import { FirmwareCompatDialog } from '@/components/FirmwareCompatDialog';
import { TESTED_FIRMWARE_VERSIONS } from '@/core/firmware';
import { SavePresetDialog } from '@/components/SavePresetDialog';
import { AddToPlaylistDialog } from '@/components/AddToPlaylistDialog';
import { SysExCodec } from '@/core/SysExCodec';
import type { GP200Preset } from '@/core/types';

export default function EditorPage() {
  const t = useTranslations('editor');
  const router = useRouter();
  const { preset, loadPreset, setPatchName, setAuthor, toggleEffect, changeEffect, reorderEffects, setParam } = usePreset();
  const midiDevice = useMidiDeviceContext();
  const [slotBrowserMode, setSlotBrowserMode] = useState<'pull' | 'push' | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  // Bank tabs: 4 presets (A/B/C/D) with active tab index
  const [bankPresets, setBankPresets] = useState<(GP200Preset | null)[]>([null, null, null, null]);
  const [bankBaseSlot, setBankBaseSlot] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [username, setUsername] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showPlaylistDialog, setShowPlaylistDialog] = useState(false);
  const [firmwareWarningDismissed, setFirmwareWarningDismissed] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'pedals'>('list');
  const pedalGridRef = useRef<HTMLDivElement>(null);
  // Track source preset when loaded from gallery (for update vs save-as-new)
  const [sourcePreset, setSourcePreset] = useState<{ id: string; username: string; author: string; style: string; description: string } | null>(null);

  useEffect(() => {
    fetch('/api/profile')
      .then((r) => {
        setIsLoggedIn(r.ok);
        if (r.ok) return r.json();
        return null;
      })
      .then((data: { username?: string } | null) => {
        if (data?.username) setUsername(data.username);
      })
      .catch(() => setIsLoggedIn(false));
  }, []);

  // Load preset from gallery share link (?share=TOKEN)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shareToken = params.get('share');
    if (!shareToken) return;
    // Fetch binary + info in parallel
    Promise.all([
      fetch(`/api/share/${shareToken}/download`).then(r => { if (!r.ok) throw new Error('Download failed'); return r.arrayBuffer(); }),
      fetch(`/api/share/${shareToken}`).then(r => r.ok ? r.json() : null),
    ])
      .then(([ab, info]) => {
        const decoder = new PRSTDecoder(new Uint8Array(ab));
        loadPreset(decoder.decode());
        if (info?.id) {
          setSourcePreset({ id: info.id, username: info.username, author: info.author ?? '', style: info.style ?? '', description: info.description ?? '' });
        }
      })
      .catch(() => {
        setLoadError(t('loadError'));
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reset firmware warning when device disconnects
  useEffect(() => {
    if (midiDevice.status === 'disconnected') {
      setFirmwareWarningDismissed(false);
    }
  }, [midiDevice.status]);

  // Auto-load entire bank from device after handshake
  useEffect(() => {
    if (midiDevice.currentPreset && midiDevice.currentSlot !== null && !preset) {
      const slot = midiDevice.currentSlot;
      // Pull entire bank containing the current slot
      handlePullConfirm(slot);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [midiDevice.currentPreset]);

  const handleFile = useCallback((buffer: Uint8Array, _filename: string) => {
    try {
      const decoder = new PRSTDecoder(buffer);
      loadPreset(decoder.decode());
      setLoadError(null);
      setSourcePreset(null); // Clear gallery source — this is a local file
    } catch (err) {
      setLoadError(`${t('loadError')}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [loadPreset, t]);

  function encodePreset(): ArrayBuffer | null {
    if (!preset) return null;
    const encoder = new PRSTEncoder();
    return encoder.encode(preset);
  }

  function handleDownload() {
    const ab = encodePreset();
    if (!ab || !preset) return;
    const blob = new Blob([ab], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${preset.patchName}.prst`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleSaveToPresets(data: { author: string; style: string; note: string; publish: boolean }) {
    // Update author in preset before encoding
    if (data.author) setAuthor(data.author);
    const ab = encodePreset();
    if (!ab || !preset) return;

    // Send metadata to connected device
    if (midiDevice.status === 'connected') {
      if (data.author) midiDevice.sendAuthor(data.author);
      if (data.style) midiDevice.sendStyleName(data.style);
      if (data.note) midiDevice.sendNote(data.note);
    }

    setSaveStatus('saving');
    try {
      const blob = new Blob([ab], { type: 'application/octet-stream' });
      const file = new File([blob], `${preset.patchName}.prst`, { type: 'application/octet-stream' });
      const formData = new FormData();
      formData.append('preset', file);
      if (data.author) formData.append('author', data.author);
      if (data.style) formData.append('style', data.style);
      if (data.note) formData.append('description', data.note);
      if (data.publish) formData.append('publish', 'true');

      const res = await fetch('/api/presets', { method: 'POST', body: formData });
      if (res.ok) {
        setSaveStatus('saved');
        setShowSaveDialog(false);
        setTimeout(() => {
          router.push('/presets');
          router.refresh();
        }, 800);
      } else {
        setSaveStatus('error');
        setTimeout(() => setSaveStatus('idle'), 3000);
      }
    } catch {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  }

  async function handleUpdatePreset() {
    const ab = encodePreset();
    if (!ab || !preset || !sourcePreset) return;

    setSaveStatus('saving');
    try {
      const blob = new Blob([ab], { type: 'application/octet-stream' });
      const file = new File([blob], `${preset.patchName}.prst`, { type: 'application/octet-stream' });
      const formData = new FormData();
      formData.append('preset', file);
      formData.append('name', preset.patchName);

      const res = await fetch(`/api/presets/${sourcePreset.id}`, { method: 'PATCH', body: formData });
      if (res.ok) {
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } else {
        setSaveStatus('error');
        setTimeout(() => setSaveStatus('idle'), 3000);
      }
    } catch {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  }

  async function handlePullConfirm(slot: number) {
    setSlotBrowserMode(null);
    const bank = Math.floor(slot / 4);
    const baseSlot = bank * 4;
    const tabIndex = slot % 4;
    const pulled: (GP200Preset | null)[] = [null, null, null, null];

    // Pull all 4 slots of the bank
    for (let i = 0; i < 4; i++) {
      try {
        pulled[i] = await midiDevice.pullPreset(baseSlot + i);
      } catch {
        // leave null on failure
      }
    }

    setBankPresets(pulled);
    setBankBaseSlot(baseSlot);
    setActiveTab(tabIndex);
    // Load the selected slot into the editor + switch device to that slot
    if (pulled[tabIndex]) {
      loadPreset(pulled[tabIndex]);
    }
    if (midiDevice.status === 'connected') {
      midiDevice.sendSlotChange(slot);
    }
  }

  async function handlePushConfirm(slot: number) {
    if (!preset) return;
    try {
      await midiDevice.pushPreset(preset, slot);
      setLoadError(null);
    } catch {
      setLoadError(t('pushError'));
    } finally {
      setSlotBrowserMode(null);
    }
  }

  function handleTabSwitch(tabIndex: number) {
    setActiveTab(tabIndex);
    if (bankPresets[tabIndex]) {
      loadPreset(bankPresets[tabIndex]);
    }
    if (midiDevice.status === 'connected' && bankBaseSlot !== null) {
      midiDevice.sendSlotChange(bankBaseSlot + tabIndex);
    }
  }


  function handleOpenBrowser(mode: 'pull' | 'push') {
    setSlotBrowserMode(mode);
    if (midiDevice.presetNames.every(n => n === null)) {
      midiDevice.loadPresetNames();
    }
  }

  const handleDragStart = useCallback((index: number) => {
    setDragIndex(index);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  }, []);

  const handleDrop = useCallback((toIndex: number) => {
    if (dragIndex !== null) {
      reorderEffects(dragIndex, toIndex);
      // Send reorder to device: build new order array
      if (midiDevice.status === 'connected' && preset) {
        const order = preset.effects.map(e => e.slotIndex);
        const [moved] = order.splice(dragIndex, 1);
        order.splice(toIndex, 0, moved);
        midiDevice.sendReorder(order);
      }
    }
    setDragIndex(null);
    setDragOverIndex(null);
  }, [dragIndex, reorderEffects, midiDevice, preset]);

  const td = useTranslations('device');

  const firmwareVersionStr = midiDevice.deviceInfo
    ? midiDevice.deviceInfo.firmwareValues.join('.')
    : '';
  const firmwareOk = TESTED_FIRMWARE_VERSIONS.includes(firmwareVersionStr);
  const showFirmwareDialog =
    midiDevice.status === 'connected' &&
    midiDevice.deviceInfo !== null &&
    !firmwareOk &&
    !firmwareWarningDismissed;

  if (!preset) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        {/* Device connection — prominent at top */}
        <div className="mb-8 p-4 rounded-lg" style={{ border: '1px solid rgba(212,162,78,0.2)', background: 'rgba(212,162,78,0.03)' }}>
          <DeviceStatusBar
            midiDevice={midiDevice}
            currentPresetName={null}
            hasPreset={false}
            onPullRequest={() => handleOpenBrowser('pull')}
            onPushRequest={() => {}}
          />
          {midiDevice.status === 'disconnected' && (
            <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
              {td('connectHint')}
            </p>
          )}
        </div>
        <h1 className="font-mono-display text-2xl font-bold mb-8 tracking-tight"
          style={{ color: 'var(--text-primary)' }}>
          {t('title')}
        </h1>
        <FileUpload onFile={handleFile} />
        {loadError && (
          <div
            className="mt-4 px-4 py-3 rounded-lg font-mono-display text-sm flex items-center justify-between"
            style={{
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)',
              color: '#ef4444',
            }}
          >
            <span>{loadError}</span>
            <button onClick={() => setLoadError(null)} className="ml-3 font-bold" style={{ color: '#ef4444' }}>
              ✕
            </button>
          </div>
        )}
        {slotBrowserMode && (
          <DeviceSlotBrowser
            mode={slotBrowserMode}
            presetNames={midiDevice.presetNames}
            namesLoadProgress={midiDevice.namesLoadProgress}
            currentSlot={midiDevice.currentSlot}
            onConfirm={slotBrowserMode === 'pull' ? handlePullConfirm : handlePushConfirm}
            onCancel={() => setSlotBrowserMode(null)}
          />
        )}
      </div>
    );
  }

  return (
    <div className={`p-8 mx-auto ${viewMode === 'pedals' ? 'max-w-6xl' : 'max-w-2xl'}`}>
      {/* Header with patch name + author + slot */}
      <div className="flex items-center gap-4 mb-4 flex-wrap">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <span className="font-mono-display text-sm font-bold tracking-tight flex-shrink-0"
            style={{ color: 'var(--text-muted)' }}>
            {t('patchName')}:
          </span>
          <input
            id="patch-name"
            type="text"
            value={preset.patchName}
            onChange={(e) => setPatchName(e.target.value)}
            maxLength={16}
            data-testid="patch-name-input"
            className="font-mono-display text-xl font-bold tracking-tight bg-transparent border-none outline-none min-w-0 flex-1"
            style={{ color: 'var(--accent-amber)' }}
          />
        </div>
        {bankBaseSlot !== null && (
          <span className="font-mono-display text-sm flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
            {t('slot')}: <strong style={{ color: 'var(--accent-amber)' }}>{SysExCodec.slotToLabel(bankBaseSlot + activeTab)}</strong>
          </span>
        )}
      </div>
      {/* Author + Style */}
      <div className="flex items-center gap-4 mb-8 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="font-mono-display text-[11px] font-medium tracking-wider uppercase flex-shrink-0"
            style={{ color: 'var(--text-muted)' }}>
            {t('author')}:
          </span>
          <input
            type="text"
            value={preset.author ?? ''}
            onChange={(e) => {
              setAuthor(e.target.value);
              if (midiDevice.status === 'connected') {
                midiDevice.sendAuthor(e.target.value);
              }
            }}
            maxLength={16}
            placeholder={username || '—'}
            data-testid="author-input"
            className="font-mono-display text-sm bg-transparent border-none outline-none"
            style={{ color: 'var(--text-secondary)' }}
          />
        </div>
        {sourcePreset?.style && (
          <span className="font-mono-display text-[11px] tracking-wider uppercase px-2 py-0.5 rounded"
            style={{ color: 'var(--text-muted)', background: 'rgba(212,162,78,0.08)', border: '1px solid rgba(212,162,78,0.15)' }}>
            {sourcePreset.style}
          </span>
        )}
      </div>

      {/* Bank tabs with prev/next navigation */}
      {bankBaseSlot !== null && (
        <div className="flex gap-1 mb-3 items-stretch">
          <button
            onClick={() => {
              const prevBase = bankBaseSlot === 0 ? 252 : bankBaseSlot - 4;
              handlePullConfirm(prevBase + activeTab);
            }}
            className="font-mono-display text-sm font-bold px-2 rounded-l transition-colors"
            style={{ color: 'var(--text-muted)', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
            title={`Bank ${Math.floor((bankBaseSlot === 0 ? 252 : bankBaseSlot - 4) / 4) + 1}`}
          >
            &lt;
          </button>
          {['A', 'B', 'C', 'D'].map((letter, i) => {
            const slotNum = bankBaseSlot + i;
            const label = SysExCodec.slotToLabel(slotNum);
            const name = bankPresets[i]?.patchName;
            const isActive = activeTab === i;
            return (
              <button
                key={i}
                onClick={() => handleTabSwitch(i)}
                className="flex-1 font-mono-display text-xs py-2 px-2 transition-colors"
                style={{
                  background: isActive ? 'rgba(212,162,78,0.15)' : 'rgba(255,255,255,0.03)',
                  borderBottom: isActive ? '2px solid var(--accent-amber)' : '2px solid transparent',
                  color: isActive ? 'var(--accent-amber)' : 'var(--text-muted)',
                }}
              >
                <div className="font-bold">{label}</div>
                <div className="truncate" style={{ fontSize: '0.85em', opacity: name ? 1 : 0.4 }}>
                  {name ?? '—'}
                </div>
              </button>
            );
          })}
          <button
            onClick={() => {
              const nextBase = bankBaseSlot >= 252 ? 0 : bankBaseSlot + 4;
              handlePullConfirm(nextBase + activeTab);
            }}
            className="font-mono-display text-sm font-bold px-2 rounded-r transition-colors"
            style={{ color: 'var(--text-muted)', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
            title={`Bank ${Math.floor((bankBaseSlot >= 252 ? 0 : bankBaseSlot + 4) / 4) + 1}`}
          >
            &gt;
          </button>
        </div>
      )}

      {/* View toggle */}
      <div className="flex items-center gap-1 mb-4">
        <button
          onClick={() => setViewMode('list')}
          className="font-mono-display text-[10px] font-bold tracking-wider uppercase px-3 py-1.5 rounded-l transition-all duration-150"
          style={{
            background: viewMode === 'list' ? 'var(--glow-amber)' : 'transparent',
            border: `1px solid ${viewMode === 'list' ? 'var(--accent-amber)' : 'var(--border-subtle)'}`,
            color: viewMode === 'list' ? 'var(--accent-amber)' : 'var(--text-muted)',
          }}
          aria-pressed={viewMode === 'list'}
        >
          {t('viewList')}
        </button>
        <button
          onClick={() => setViewMode('pedals')}
          className="font-mono-display text-[10px] font-bold tracking-wider uppercase px-3 py-1.5 rounded-r transition-all duration-150"
          style={{
            background: viewMode === 'pedals' ? 'var(--glow-amber)' : 'transparent',
            border: `1px solid ${viewMode === 'pedals' ? 'var(--accent-amber)' : 'var(--border-subtle)'}`,
            color: viewMode === 'pedals' ? 'var(--accent-amber)' : 'var(--text-muted)',
          }}
          aria-pressed={viewMode === 'pedals'}
        >
          {t('viewPedals')}
        </button>
      </div>

      {/* Signal chain */}
      <div
        ref={viewMode === 'pedals' ? pedalGridRef : undefined}
        className={viewMode === 'pedals'
          ? 'relative grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5 mb-8'
          : 'flex flex-col gap-2 mb-8'}
        onDragEnd={() => { setDragIndex(null); setDragOverIndex(null); }}
      >
        {viewMode === 'pedals' && preset && (
          <PatchCableOverlay
            containerRef={pedalGridRef}
            count={preset.effects.length}
            dragIndex={dragIndex}
            dragOverIndex={dragOverIndex}
          />
        )}
        {preset.effects.map((slot, i) => {
          const slotProps = {
            key: `${i}-${slot.effectId}`,
            slot,
            index: i,
            onToggle: (index: number) => {
              toggleEffect(index);
              if (midiDevice.status === 'connected' && preset) {
                const eff = preset.effects[index];
                midiDevice.sendToggle(eff.slotIndex, !eff.enabled);
              }
            },
            onChangeEffect: changeEffect,
            onParamChange: (slotIndex: number, paramIndex: number, value: number) => {
              setParam(slotIndex, paramIndex, value);
              if (midiDevice.status === 'connected' && preset) {
                const eff = preset.effects.find(e => e.slotIndex === slotIndex);
                if (eff) midiDevice.sendParamChange(slotIndex, paramIndex, eff.effectId, value);
              }
            },
            onDragStart: handleDragStart,
            onDragOver: handleDragOver,
            onDrop: handleDrop,
            isDragOver: dragOverIndex === i && dragIndex !== i,
          };
          return viewMode === 'pedals'
            ? <EffectSlotCard {...slotProps} />
            : <EffectSlot {...slotProps} />;
        })}
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-4 flex-wrap">
        <button
          onClick={handleDownload}
          data-testid="download-btn"
          className="font-mono-display text-sm font-bold tracking-wider uppercase px-6 py-3 rounded-lg transition-all duration-200"
          style={{
            background: 'var(--glow-amber)',
            border: '1px solid var(--accent-amber)',
            color: 'var(--accent-amber)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow = '0 0 20px var(--glow-amber)';
            e.currentTarget.style.background = 'rgba(212,162,78,0.25)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow = 'none';
            e.currentTarget.style.background = 'var(--glow-amber)';
          }}
        >
          {t('download')}
        </button>
        <button
          onClick={() => setShowPlaylistDialog(true)}
          disabled={!preset}
          className="rounded-lg px-4 py-2 font-mono-display text-sm font-bold transition-colors disabled:opacity-50"
          style={{ color: 'var(--accent-amber)', border: '1px solid var(--accent-amber)' }}
        >
          {t('addToPlaylist')}
        </button>
        <label
          className="font-mono-display text-sm font-bold tracking-wider uppercase px-6 py-3 rounded-lg transition-all duration-200 cursor-pointer"
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-active)',
            color: 'var(--text-secondary)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--accent-amber)';
            e.currentTarget.style.color = 'var(--accent-amber)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-active)';
            e.currentTarget.style.color = 'var(--text-secondary)';
          }}
        >
          {t('loadFromDisk')}
          <input
            type="file"
            accept=".prst"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = () => {
                const buf = new Uint8Array(reader.result as ArrayBuffer);
                handleFile(buf, file.name);
              };
              reader.readAsArrayBuffer(file);
              e.target.value = '';
            }}
          />
        </label>

        {isLoggedIn ? (
          <>
            {/* Update button — only if loaded from gallery AND user owns it */}
            {sourcePreset && sourcePreset.username === username && (
              <button
                onClick={handleUpdatePreset}
                disabled={saveStatus === 'saving' || saveStatus === 'saved'}
                className="font-mono-display text-sm font-bold tracking-wider uppercase px-6 py-3 rounded-lg transition-all duration-200 disabled:opacity-50"
                style={{
                  background: saveStatus === 'saved' ? 'var(--glow-green)' : 'var(--glow-amber)',
                  border: `1px solid ${saveStatus === 'saved' ? 'var(--accent-green)' : 'var(--accent-amber)'}`,
                  color: saveStatus === 'saved' ? 'var(--accent-green)' : 'var(--accent-amber)',
                }}
              >
                {saveStatus === 'saving' ? t('savingPreset') :
                 saveStatus === 'saved' ? t('updatedPreset') :
                 t('updatePreset')}
              </button>
            )}
            {/* Save as new — always available when logged in */}
            <button
              onClick={() => setShowSaveDialog(true)}
              disabled={saveStatus === 'saving' || saveStatus === 'saved'}
              data-testid="save-to-presets-btn"
              className="font-mono-display text-sm font-bold tracking-wider uppercase px-6 py-3 rounded-lg transition-all duration-200 disabled:opacity-50"
              style={{
                background: saveStatus === 'saved' ? 'var(--glow-green)' : 'var(--bg-elevated)',
                border: `1px solid ${saveStatus === 'saved' ? 'var(--accent-green)' : 'var(--border-active)'}`,
                color: saveStatus === 'saved' ? 'var(--accent-green)' : 'var(--text-secondary)',
              }}
              onMouseEnter={(e) => {
                if (saveStatus === 'idle') {
                  e.currentTarget.style.borderColor = 'var(--accent-amber)';
                  e.currentTarget.style.color = 'var(--accent-amber)';
                }
              }}
              onMouseLeave={(e) => {
                if (saveStatus === 'idle') {
                  e.currentTarget.style.borderColor = 'var(--border-active)';
                  e.currentTarget.style.color = 'var(--text-secondary)';
                }
              }}
            >
              {saveStatus === 'saving' ? t('savingPreset') :
               saveStatus === 'saved' ? t('presetSaved') :
               sourcePreset ? t('saveAsNew') : t('saveToPresets')}
            </button>
            {saveStatus === 'error' && (
              <span className="text-sm font-mono-display" style={{ color: 'var(--accent-red)' }}>
                {t('presetSaveFailed')}
              </span>
            )}
          </>
        ) : isLoggedIn === false ? (
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {t('loginToSave')}
          </span>
        ) : null}
      </div>

      {/* Error banner */}
      {loadError && (
        <div
          className="mt-4 px-4 py-3 rounded-lg font-mono-display text-sm flex items-center justify-between"
          style={{
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.3)',
            color: '#ef4444',
          }}
        >
          <span>{loadError}</span>
          <button onClick={() => setLoadError(null)} className="ml-3 font-bold" style={{ color: '#ef4444' }}>
            ✕
          </button>
        </div>
      )}

      {/* Save Preset Dialog */}
      {showSaveDialog && (
        <SavePresetDialog
          presetName={preset.patchName}
          defaultAuthor={preset.author || username}
          onSave={handleSaveToPresets}
          onCancel={() => setShowSaveDialog(false)}
          saving={saveStatus === 'saving'}
        />
      )}

      {/* Device sync — bottom */}
      <div className="mt-6">
        <DeviceStatusBar
          midiDevice={bankBaseSlot !== null
            ? { ...midiDevice, currentSlot: bankBaseSlot + activeTab }
            : midiDevice}
          currentPresetName={preset?.patchName ?? null}
          hasPreset={!!preset}
          onPullRequest={() => handleOpenBrowser('pull')}
          onPushRequest={() => handleOpenBrowser('push')}
        />
      </div>

      {slotBrowserMode && (
        <DeviceSlotBrowser
          mode={slotBrowserMode}
          presetNames={midiDevice.presetNames}
          namesLoadProgress={midiDevice.namesLoadProgress}
          currentSlot={midiDevice.currentSlot}
          onConfirm={slotBrowserMode === 'pull' ? handlePullConfirm : handlePushConfirm}
          onCancel={() => setSlotBrowserMode(null)}
        />
      )}

      {showPlaylistDialog && preset && (
        <AddToPlaylistDialog
          presetName={preset.patchName}
          presetBinary={encodePreset()!}
          onClose={() => setShowPlaylistDialog(false)}
        />
      )}

      {showFirmwareDialog && (
        <FirmwareCompatDialog
          detectedVersion={firmwareVersionStr}
          onContinue={() => setFirmwareWarningDismissed(true)}
          onDisconnect={() => { midiDevice.disconnect(); setFirmwareWarningDismissed(false); }}
        />
      )}
    </div>
  );
}
