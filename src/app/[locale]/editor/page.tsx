'use client';
import { useTranslations } from 'next-intl';
import { FileUpload } from '@/components/FileUpload';
import { EffectSlot } from '@/components/EffectSlot';
import { usePreset } from '@/hooks/usePreset';
import { PRSTDecoder } from '@/core/PRSTDecoder';
import { PRSTEncoder } from '@/core/PRSTEncoder';
import { useCallback, useState } from 'react';

export default function EditorPage() {
  const t = useTranslations('editor');
  const { preset, loadPreset, setPatchName, toggleEffect, changeEffect, reorderEffects, setParam } = usePreset();
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleFile = useCallback((buffer: Uint8Array, _filename: string) => {
    try {
      const decoder = new PRSTDecoder(buffer);
      loadPreset(decoder.decode());
    } catch (err) {
      alert(`${t('loadError')}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [loadPreset, t]);

  function handleDownload() {
    if (!preset) return;
    const encoder = new PRSTEncoder();
    const ab = encoder.encode(preset);
    const blob = new Blob([ab], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${preset.patchName}.prst`;
    a.click();
    URL.revokeObjectURL(url);
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

      {/* Download button */}
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
    </div>
  );
}
