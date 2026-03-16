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
  const { preset, loadPreset, setPatchName, toggleEffect, reorderEffects } = usePreset();
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
        <h1 className="text-2xl font-bold mb-6">{t('title')}</h1>
        <FileUpload onFile={handleFile} />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">{t('title')}</h1>
      <div className="mb-6">
        <label htmlFor="patch-name" className="block text-sm font-medium mb-1">
          {t('patchName')}
        </label>
        <input
          id="patch-name"
          type="text"
          value={preset.patchName}
          onChange={(e) => setPatchName(e.target.value)}
          maxLength={32}
          data-testid="patch-name-input"
          className="border rounded px-3 py-2 w-full max-w-xs"
        />
      </div>
      <div className="grid gap-3 mb-6" onDragEnd={() => { setDragIndex(null); setDragOverIndex(null); }}>
        {preset.effects.map((slot, i) => (
          <EffectSlot
            key={`${i}-${slot.effectId}`}
            slot={slot}
            index={i}
            onToggle={toggleEffect}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            isDragOver={dragOverIndex === i && dragIndex !== i}
          />
        ))}
      </div>
      <button
        onClick={handleDownload}
        data-testid="download-btn"
        className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
      >
        {t('download')}
      </button>
    </div>
  );
}
