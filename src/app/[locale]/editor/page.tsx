'use client';
import { useTranslations } from 'next-intl';
import { FileUpload } from '@/components/FileUpload';
import { EffectSlot } from '@/components/EffectSlot';
import { usePreset } from '@/hooks/usePreset';
import { PRSTDecoder } from '@/core/PRSTDecoder';
import { PRSTEncoder } from '@/core/PRSTEncoder';
import { useCallback, useState, useEffect } from 'react';
import { useRouter } from '@/i18n/routing';
import { useMidiDevice } from '@/hooks/useMidiDevice';
import { DeviceStatusBar } from '@/components/DeviceStatusBar';
import { DeviceSlotBrowser } from '@/components/DeviceSlotBrowser';

export default function EditorPage() {
  const t = useTranslations('editor');
  const router = useRouter();
  const { preset, loadPreset, setPatchName, toggleEffect, changeEffect, reorderEffects, setParam } = usePreset();
  const midiDevice = useMidiDevice();
  const [slotBrowserMode, setSlotBrowserMode] = useState<'pull' | 'push' | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    fetch('/api/profile')
      .then((r) => setIsLoggedIn(r.ok))
      .catch(() => setIsLoggedIn(false));
  }, []);

  // Disconnect MIDI on page unload to abort any running loadPresetNames loop
  useEffect(() => {
    return () => { midiDevice.disconnect(); };
  }, [midiDevice.disconnect]);

  const handleFile = useCallback((buffer: Uint8Array, _filename: string) => {
    try {
      const decoder = new PRSTDecoder(buffer);
      loadPreset(decoder.decode());
    } catch (err) {
      alert(`${t('loadError')}: ${err instanceof Error ? err.message : String(err)}`);
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

  async function handleSaveToPresets() {
    const ab = encodePreset();
    if (!ab || !preset) return;

    setSaveStatus('saving');
    try {
      const blob = new Blob([ab], { type: 'application/octet-stream' });
      const file = new File([blob], `${preset.patchName}.prst`, { type: 'application/octet-stream' });
      const formData = new FormData();
      formData.append('preset', file);

      const res = await fetch('/api/presets', { method: 'POST', body: formData });
      if (res.ok) {
        setSaveStatus('saved');
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

  async function handlePullConfirm(slot: number) {
    try {
      const loaded = await midiDevice.pullPreset(slot);
      loadPreset(loaded);
    } catch {
      alert(t('loadError'));
    } finally {
      setSlotBrowserMode(null);
    }
  }

  async function handlePushConfirm(slot: number) {
    if (!preset) return;
    try {
      await midiDevice.pushPreset(preset, slot);
    } catch {
      alert(t('pushError'));
    } finally {
      setSlotBrowserMode(null);
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
    }
    setDragIndex(null);
    setDragOverIndex(null);
  }, [dragIndex, reorderEffects]);

  if (!preset) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <h1 className="font-mono-display text-2xl font-bold mb-8 tracking-tight"
          style={{ color: 'var(--text-primary)' }}>
          {t('title')}
        </h1>
        <FileUpload onFile={handleFile} />
        <div className="mt-4">
          <DeviceStatusBar
            midiDevice={midiDevice}
            currentPresetName={null}
            hasPreset={false}
            onPullRequest={() => handleOpenBrowser('pull')}
            onPushRequest={() => {}}
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
      </div>
    );
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      {/* Header with patch name */}
      <div className="flex items-center gap-4 mb-8">
        <h1 className="font-mono-display text-lg font-bold tracking-tight flex-shrink-0"
          style={{ color: 'var(--text-muted)' }}>
          {t('patchName')}
        </h1>
        <input
          id="patch-name"
          type="text"
          value={preset.patchName}
          onChange={(e) => setPatchName(e.target.value)}
          maxLength={32}
          data-testid="patch-name-input"
          className="font-mono-display text-xl font-bold tracking-tight bg-transparent border-none outline-none w-full"
          style={{ color: 'var(--accent-amber)' }}
        />
      </div>

      {/* Device sync */}
      <div className="mb-4">
        <DeviceStatusBar
          midiDevice={midiDevice}
          currentPresetName={preset?.patchName ?? null}
          hasPreset={!!preset}
          onPullRequest={() => handleOpenBrowser('pull')}
          onPushRequest={() => handleOpenBrowser('push')}
        />
      </div>

      {/* Signal chain */}
      <div className="flex flex-col gap-2 mb-8" onDragEnd={() => { setDragIndex(null); setDragOverIndex(null); }}>
        {preset.effects.map((slot, i) => (
          <EffectSlot
            key={`${i}-${slot.effectId}`}
            slot={slot}
            index={i}
            onToggle={toggleEffect}
            onChangeEffect={changeEffect}
            onParamChange={setParam}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            isDragOver={dragOverIndex === i && dragIndex !== i}
          />
        ))}
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-4 flex-wrap">
        <button
          onClick={handleDownload}
          data-testid="download-btn"
          className="font-mono-display text-sm font-bold tracking-wider uppercase px-8 py-3 rounded-lg transition-all duration-200"
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

        {isLoggedIn ? (
          <>
            <button
              onClick={handleSaveToPresets}
              disabled={saveStatus === 'saving' || saveStatus === 'saved'}
              data-testid="save-to-presets-btn"
              className="font-mono-display text-sm font-bold tracking-wider uppercase px-8 py-3 rounded-lg transition-all duration-200 disabled:opacity-50"
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
               t('saveToPresets')}
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
