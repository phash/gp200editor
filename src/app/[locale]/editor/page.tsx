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
import { useRouter, Link } from '@/i18n/routing';
import { useMidiDeviceContext } from '@/contexts/MidiDeviceContext';
import { DeviceStatusBar } from '@/components/DeviceStatusBar';
import { DeviceSlotBrowser } from '@/components/DeviceSlotBrowser';
import { FirmwareCompatDialog } from '@/components/FirmwareCompatDialog';
import { PatchSettingsCard } from '@/components/PatchSettingsCard';
import { ControllerPanel } from '@/components/ControllerPanel';
import { HelpButton } from '@/components/HelpButton';
// Firmware compat now uses version check (sub=0x0A) result, not version string matching
import { SavePresetDialog } from '@/components/SavePresetDialog';
import { AddToPlaylistDialog } from '@/components/AddToPlaylistDialog';
import { GuitarRating } from '@/components/GuitarRating';
import { SysExCodec } from '@/core/SysExCodec';
import { convertHLX } from '@/core/HLXConverter';
import type { GP200Preset } from '@/core/types';

const PRESET_STYLES = [
  'Rock', 'Metal', 'Blues', 'Jazz', 'Country', 'Funk',
  'Pop', 'Punk', 'Ambient', 'Clean', 'Acoustic', 'Experimental',
];

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
  // Bank tab drag & drop (swap slots within bank)
  const [bankDragIndex, setBankDragIndex] = useState<number | null>(null);
  const [bankDragOverIndex, setBankDragOverIndex] = useState<number | null>(null);
  const [swapping, setSwapping] = useState(false);
  // Track which bank slots have been reordered but not yet saved to device
  const [bankDirtySlots, setBankDirtySlots] = useState<Set<number>>(new Set());
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [username, setUsername] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showPlaylistDialog, setShowPlaylistDialog] = useState(false);
  const [firmwareWarningDismissed, setFirmwareWarningDismissed] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'pedals'>('pedals');
  const pedalGridRef = useRef<HTMLDivElement>(null);
  // Track source preset when loaded from gallery (for update vs save-as-new)
  const [sourcePreset, setSourcePreset] = useState<{ id: string; username: string; author: string; style: string; description: string } | null>(null);
  const [importedFromHLX, setImportedFromHLX] = useState(false);
  const [myRating, setMyRating] = useState(0);
  const [presetStyle, setPresetStyle] = useState('');
  const [presetNote, setPresetNote] = useState('');
  const [patchVolume, setPatchVolume] = useState(50);
  const [patchPan, setPatchPan] = useState(0);
  const [patchTempo, setPatchTempo] = useState(120);

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
        const decoded = decoder.decode();
        loadPreset(decoded);
        if (info?.id) {
          setSourcePreset({ id: info.id, username: info.username, author: info.author ?? '', style: info.style ?? '', description: info.description ?? '' });
          setPresetStyle(info.style ?? '');
          setPresetNote(info.description ?? '');
        }
        // Send to device if connected (live preview, not saved)
        sendPresetToDevice(decoded);
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

  // Re-pull current preset when device slot changes (hardware slot switch)
  const bankBaseSlotRef = useRef(bankBaseSlot);
  bankBaseSlotRef.current = bankBaseSlot;
  useEffect(() => {
    if (midiDevice.status !== 'connected') return;
    let pulling = false;
    midiDevice.setOnDeviceChange(async (slot) => {
      if (pulling || slot === null) return;
      pulling = true;
      console.log(`[GP-200] onDeviceChange: slot ${slot} (${SysExCodec.slotToLabel(slot)})`);
      const base = bankBaseSlotRef.current;
      const newBankBase = Math.floor(slot / 4) * 4;

      try {
        if (base !== null && newBankBase === base) {
          // Same bank — just pull the changed slot
          const fresh = await midiDevice.pullPreset(slot);
          loadPreset(fresh);
          const tabIdx = slot - base;
          setActiveTab(tabIdx);
          setBankPresets(prev => {
            const updated = [...prev];
            updated[tabIdx] = fresh;
            return updated;
          });
        } else {
          // Different bank — pull all 4 slots of the new bank
          const pulled: (GP200Preset | null)[] = [null, null, null, null];
          for (let i = 0; i < 4; i++) {
            try { pulled[i] = await midiDevice.pullPreset(newBankBase + i); } catch {}
          }
          const tabIdx = slot - newBankBase;
          setBankPresets(pulled);
          setBankBaseSlot(newBankBase);
          setBankDirtySlots(new Set());
          setActiveTab(tabIdx);
          if (pulled[tabIdx]) loadPreset(pulled[tabIdx]);
        }
      } catch {} finally { pulling = false; }
    });
    return () => midiDevice.setOnDeviceChange(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [midiDevice.status, midiDevice.currentSlot, bankBaseSlot]);

  // Direct toggle update from hardware (no pull needed — device editing buffer isn't in saved data)
  useEffect(() => {
    if (midiDevice.status !== 'connected') return;
    midiDevice.setOnDeviceToggle((blockIndex, enabled) => {
      console.log(`[GP-200] onDeviceToggle: block=${blockIndex} enabled=${enabled}`);
      toggleEffect(blockIndex, enabled);
    });
    return () => midiDevice.setOnDeviceToggle(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [midiDevice.status]);

  // Direct effect type change from hardware (sub=0x0C parsed: block + new effectId)
  useEffect(() => {
    if (midiDevice.status !== 'connected') return;
    midiDevice.setOnDeviceEffectChange((blockIndex, effectId) => {
      console.log(`[GP-200] onDeviceEffectChange: block=${blockIndex} effectId=0x${effectId.toString(16)}`);
      changeEffect(blockIndex, effectId);
    });
    return () => midiDevice.setOnDeviceEffectChange(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [midiDevice.status]);

  // Direct param change from hardware knob turns (sub=0x10 with zeros at [29:37])
  useEffect(() => {
    if (midiDevice.status !== 'connected') return;
    midiDevice.setOnDeviceParamChange((blockIndex, paramIndex, value) => {
      setParam(blockIndex, paramIndex, value);
    });
    return () => midiDevice.setOnDeviceParamChange(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [midiDevice.status]);

  // Auto-start background loading of all preset names after connection
  useEffect(() => {
    if (midiDevice.status === 'connected' && midiDevice.namesLoadProgress < 256) {
      midiDevice.loadPresetNames();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [midiDevice.status]);

  // Send all effect data to device for live preview (no save)
  const sendPresetToDevice = useCallback((decoded: GP200Preset) => {
    if (midiDevice.status !== 'connected') return;
    for (const eff of decoded.effects) {
      midiDevice.sendToggle(eff.slotIndex, eff.enabled);
      for (let p = 0; p < eff.params.length; p++) {
        if (eff.params[p] !== undefined) {
          midiDevice.sendParamChange(eff.slotIndex, p, eff.effectId, eff.params[p]);
        }
      }
    }
    if (decoded.author) midiDevice.sendAuthor(decoded.author);
  }, [midiDevice]);

  const handleFile = useCallback((buffer: Uint8Array, filename: string) => {
    try {
      let decoded: GP200Preset;
      if (filename.toLowerCase().endsWith('.hlx')) {
        // HLX import (experimental)
        const text = new TextDecoder().decode(buffer);
        const hlx = JSON.parse(text);
        decoded = convertHLX(hlx);
        setImportedFromHLX(true);
      } else {
        const decoder = new PRSTDecoder(buffer);
        decoded = decoder.decode();
        setImportedFromHLX(false);
      }
      loadPreset(decoded);
      sendPresetToDevice(decoded);
      setLoadError(null);
      setSourcePreset(null);
    } catch (err) {
      setLoadError(`${t('loadError')}: ${err instanceof Error ? err.message : String(err)}`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // Sync editor state with dialog values
    if (data.author) setAuthor(data.author);
    if (data.style) setPresetStyle(data.style);
    if (data.note) setPresetNote(data.note);
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

  async function handleRate(score: number) {
    if (!sourcePreset) return;
    await fetch(`/api/presets/${sourcePreset.id}/rate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ score }),
    });
    setMyRating(score);
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
    setBankDirtySlots(new Set());
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
      await midiDevice.writePresetToSlot(preset, slot);
      setLoadError(null);
    } catch {
      setLoadError(t('pushError'));
    } finally {
      setSlotBrowserMode(null);
    }
  }

  async function handleSaveToActiveSlot() {
    if (!preset) return;
    const slot = bankBaseSlot !== null ? bankBaseSlot + activeTab : midiDevice.currentSlot ?? 0;
    await midiDevice.saveToSlot(preset.patchName, slot);
    // Update bank cache so tab-switching loads the saved state
    if (bankBaseSlot !== null) {
      setBankPresets(prev => {
        const updated = [...prev];
        updated[activeTab] = { ...preset };
        return updated;
      });
    }
  }

  async function handleTabSwitch(tabIndex: number) {
    setActiveTab(tabIndex);
    if (midiDevice.status === 'connected' && bankBaseSlot !== null) {
      const slot = bankBaseSlot + tabIndex;
      midiDevice.sendSlotChange(slot);
      // Pull fresh from device to stay in sync
      try {
        const fresh = await midiDevice.pullPreset(slot);
        loadPreset(fresh);
        setBankPresets(prev => {
          const updated = [...prev];
          updated[tabIndex] = fresh;
          return updated;
        });
      } catch {
        // Fallback to cache
        if (bankPresets[tabIndex]) loadPreset(bankPresets[tabIndex]);
      }
    } else if (bankPresets[tabIndex]) {
      loadPreset(bankPresets[tabIndex]);
    }
  }


  function handleBankSwap(fromTab: number, toTab: number) {
    if (fromTab === toTab || bankBaseSlot === null || swapping) return;
    const presetA = bankPresets[fromTab];
    const presetB = bankPresets[toTab];
    if (!presetA && !presetB) return;

    // Swap locally only — no device push until user clicks Save
    const newBank = [...bankPresets];
    newBank[fromTab] = presetB;
    newBank[toTab] = presetA;
    setBankPresets(newBank);

    // Mark both slots as dirty
    setBankDirtySlots(prev => {
      const next = new Set(Array.from(prev));
      next.add(fromTab);
      next.add(toTab);
      return next;
    });

    // Update editor if active tab was involved
    if (activeTab === fromTab) {
      if (presetB) loadPreset(presetB);
    } else if (activeTab === toTab) {
      if (presetA) loadPreset(presetA);
    }
  }

  async function handleBankSave() {
    if (bankBaseSlot === null || midiDevice.status !== 'connected' || bankDirtySlots.size === 0) return;
    setSwapping(true);
    try {
      for (const tabIdx of Array.from(bankDirtySlots)) {
        const preset = bankPresets[tabIdx];
        if (preset) {
          await midiDevice.writePresetToSlot(preset, bankBaseSlot + tabIdx);
        }
      }
      setBankDirtySlots(new Set());
      // Switch device to the active tab's slot
      midiDevice.sendSlotChange(bankBaseSlot + activeTab);
    } catch {
      setLoadError(t('swapError'));
    } finally {
      setSwapping(false);
    }
  }

  function handleOpenBrowser(mode: 'pull' | 'push') {
    setSlotBrowserMode(mode);
    if (midiDevice.namesLoadProgress < 256) {
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

  // Firmware compat: identity response doesn't contain real FW version,
  // so we rely on the version check (sub=0x0A) result instead.
  const firmwareOk = midiDevice.deviceInfo?.versionAccepted ?? false;
  const firmwareVersionStr = midiDevice.deviceInfo
    ? (midiDevice.deviceInfo.firmwareValues.length > 0
        ? midiDevice.deviceInfo.firmwareValues.join('.')
        : '')
    : '';
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
        <div className="flex items-center gap-3 mb-8">
          <h1 className="font-mono-display text-2xl font-bold tracking-tight"
            style={{ color: 'var(--text-primary)' }}>
            {t('title')}
          </h1>
          <HelpButton section="editor" />
        </div>
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
    <div className={`mx-auto ${viewMode === 'pedals' ? 'max-w-6xl' : 'max-w-2xl'}`}>
      {/* Sticky Device Bar — top */}
      <div className="sticky top-0 z-30 px-8 pt-3 pb-2" style={{ background: 'var(--bg-primary)' }}>
        <DeviceStatusBar
          midiDevice={bankBaseSlot !== null
            ? { ...midiDevice, currentSlot: bankBaseSlot + activeTab }
            : midiDevice}
          currentPresetName={preset?.patchName ?? null}
          hasPreset={!!preset}
          onPullRequest={() => handleOpenBrowser('pull')}
          onPushRequest={() => handleOpenBrowser('push')}
          onSaveToActiveSlot={midiDevice.status === 'connected' ? handleSaveToActiveSlot : undefined}
          onPresetNameChange={preset ? (name: string) => setPatchName(name) : undefined}
        />
      </div>

      <div className="p-8 pt-2">
      {/* Experimental HLX import badge */}
      {importedFromHLX && (
        <div className="mb-4 px-3 py-1.5 rounded-lg font-mono-display text-[11px] tracking-wider uppercase inline-flex items-center gap-2"
          style={{ background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.3)', color: '#a855f7' }}>
          EXPERIMENTAL — imported from Line6 HX Stomp (.hlx)
        </div>
      )}

      {/* Header with patch name + author + slot */}
      <div className="flex items-center gap-4 mb-4 flex-wrap">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <HelpButton section="editor" />
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
      {/* Author + Style + Note */}
      <div className="flex items-center gap-6 mb-4 flex-wrap">
        <div className="flex items-center gap-2">
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
        <div className="flex items-center gap-2">
          <span className="font-mono-display text-[11px] font-medium tracking-wider uppercase flex-shrink-0"
            style={{ color: 'var(--text-muted)' }}>
            {t('styleLabel')}:
          </span>
          <select
            value={PRESET_STYLES.includes(presetStyle) ? presetStyle : presetStyle ? '__custom__' : ''}
            onChange={(e) => {
              const val = e.target.value === '__custom__' ? '' : e.target.value;
              setPresetStyle(val);
              if (val && midiDevice.status === 'connected') {
                midiDevice.sendStyleName(val);
              }
            }}
            className="font-mono-display text-sm bg-transparent border-none outline-none cursor-pointer"
            style={{ color: 'var(--text-secondary)' }}
          >
            <option value="">—</option>
            {PRESET_STYLES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
            <option value="__custom__">{t('customStyle')}</option>
          </select>
          {!PRESET_STYLES.includes(presetStyle) && presetStyle && (
            <input
              type="text"
              value={presetStyle}
              onChange={(e) => {
                setPresetStyle(e.target.value);
                if (midiDevice.status === 'connected') {
                  midiDevice.sendStyleName(e.target.value);
                }
              }}
              maxLength={16}
              className="font-mono-display text-sm bg-transparent border-none outline-none"
              style={{ color: 'var(--text-secondary)' }}
            />
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 mb-8">
        <span className="font-mono-display text-[11px] font-medium tracking-wider uppercase flex-shrink-0"
          style={{ color: 'var(--text-muted)' }}>
          {t('noteLabel')}:
        </span>
        <input
          type="text"
          value={presetNote}
          onChange={(e) => {
            setPresetNote(e.target.value);
            if (midiDevice.status === 'connected') {
              midiDevice.sendNote(e.target.value);
            }
          }}
          maxLength={40}
          placeholder="—"
          className="font-mono-display text-sm bg-transparent border-none outline-none flex-1"
          style={{ color: 'var(--text-secondary)' }}
        />
      </div>

      {/* Patch Settings: Volume, Pan, Tempo */}
      <div className="mb-4">
        <PatchSettingsCard
          volume={patchVolume}
          pan={patchPan}
          tempo={patchTempo}
          onVolumeChange={(v) => {
            setPatchVolume(v);
            if (midiDevice.status === 'connected') midiDevice.sendPatchVolume(v);
          }}
          onPanChange={(v) => {
            setPatchPan(v);
            if (midiDevice.status === 'connected') {
              // UI: -50..+50 → Device: left=255-205(v*2 from 255), right=0-100(v*2)
              const deviceVal = v >= 0 ? v * 2 : 256 + v * 2;
              midiDevice.sendPatchPan(deviceVal);
            }
          }}
          onTempoChange={(v) => {
            setPatchTempo(v);
            if (midiDevice.status === 'connected') midiDevice.sendPatchTempo(v);
          }}
          connected={midiDevice.status === 'connected'}
        />
      </div>

      {/* EXP / Controller Assignments */}
      <ControllerPanel
        preset={preset}
        connected={midiDevice.status === 'connected'}
        onParamSelect={(page, item, blockIndex, paramIdx) => {
          if (midiDevice.status === 'connected') {
            midiDevice.sendExpParamSelect(page, item, blockIndex, paramIdx);
          }
        }}
        onMinMax={(page, item, min, max) => {
          if (midiDevice.status === 'connected') {
            midiDevice.sendExpMinMax(page, item, min, max);
          }
        }}
      />

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
            const name = (activeTab === i && preset) ? preset.patchName : bankPresets[i]?.patchName;
            const isActive = activeTab === i;
            const isDragSource = bankDragIndex === i;
            const isDragOver = bankDragOverIndex === i && bankDragIndex !== null && bankDragIndex !== i;
            return (
              <button
                key={i}
                onClick={() => handleTabSwitch(i)}
                draggable={!swapping}
                onDragStart={(e) => {
                  setBankDragIndex(i);
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('text/plain', String(i));
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  if (bankDragIndex !== null && bankDragIndex !== i) {
                    setBankDragOverIndex(i);
                  }
                }}
                onDragLeave={() => {
                  if (bankDragOverIndex === i) setBankDragOverIndex(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const from = bankDragIndex;
                  setBankDragIndex(null);
                  setBankDragOverIndex(null);
                  if (from !== null && from !== i) {
                    handleBankSwap(from, i);
                  }
                }}
                onDragEnd={() => {
                  setBankDragIndex(null);
                  setBankDragOverIndex(null);
                }}
                className="flex-1 font-mono-display text-xs py-2 px-2 transition-colors"
                style={{
                  background: isDragOver ? 'rgba(212,162,78,0.3)'
                    : isActive ? 'rgba(212,162,78,0.15)' : 'rgba(255,255,255,0.03)',
                  borderBottom: isDragOver ? '2px solid var(--accent-amber)'
                    : isActive ? '2px solid var(--accent-amber)' : '2px solid transparent',
                  color: isActive ? 'var(--accent-amber)' : 'var(--text-muted)',
                  opacity: isDragSource ? 0.4 : 1,
                  cursor: !swapping ? 'grab' : undefined,
                }}
              >
                <div className="font-bold">{label}{bankDirtySlots.has(i) ? ' •' : ''}</div>
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
          {bankDirtySlots.size > 0 && midiDevice.status === 'connected' && (
            <button
              onClick={handleBankSave}
              disabled={swapping}
              className="font-mono-display text-[10px] font-bold uppercase px-3 rounded transition-colors"
              style={{
                border: '1px solid rgba(74,222,128,0.5)',
                color: 'var(--accent-green)',
                background: 'rgba(74,222,128,0.08)',
              }}
            >
              {swapping ? '…' : t('saveBankOrder')}
            </button>
          )}
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
          const slotKey = `${i}-${slot.effectId}`;
          const slotProps = {
            slot,
            index: i,
            onToggle: (index: number) => {
              toggleEffect(index);
              if (midiDevice.status === 'connected' && preset) {
                const eff = preset.effects[index];
                midiDevice.sendToggle(eff.slotIndex, !eff.enabled);
              }
            },
            onChangeEffect: (slotIndex: number, effectId: number) => {
              changeEffect(slotIndex, effectId);
              if (midiDevice.status === 'connected') {
                midiDevice.sendEffectChange(slotIndex, effectId);
              }
            },
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
            ? <EffectSlotCard key={slotKey} {...slotProps} />
            : <EffectSlot key={slotKey} {...slotProps} />;
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
            accept=".prst,.hlx"
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
        <Link
          href="/gallery"
          className="font-mono-display text-sm font-bold tracking-wider uppercase px-6 py-3 rounded-lg transition-all duration-200"
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-active)',
            color: 'var(--text-secondary)',
          }}
        >
          {t('loadFromGallery')}
        </Link>
        {isLoggedIn && (
          <Link
            href="/presets"
            className="font-mono-display text-sm font-bold tracking-wider uppercase px-6 py-3 rounded-lg transition-all duration-200"
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-active)',
              color: 'var(--text-secondary)',
            }}
          >
            {t('loadFromPresets')}
          </Link>
        )}

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
            {/* Rate preset — only when loaded from someone else's gallery */}
            {sourcePreset && sourcePreset.username !== username && isLoggedIn && (
              <div className="flex items-center gap-2">
                <span className="font-mono-display text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                  {t('ratePreset')}
                </span>
                <GuitarRating value={myRating} onRate={handleRate} size="md" />
              </div>
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
          defaultStyle={presetStyle}
          defaultNote={presetNote}
          onSave={handleSaveToPresets}
          onCancel={() => setShowSaveDialog(false)}
          saving={saveStatus === 'saving'}
        />
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
    </div>
  );
}
