'use client';
import { useTranslations } from 'next-intl';
import { FileUpload } from '@/components/FileUpload';
import { EffectSlot } from '@/components/EffectSlot';
import { usePreset } from '@/hooks/usePreset';
import { PRSTDecoder } from '@/core/PRSTDecoder';
import { PRSTEncoder } from '@/core/PRSTEncoder';
import { useCallback } from 'react';

export default function EditorPage() {
  const t = useTranslations('editor');
  const { preset, loadPreset, setPatchName, toggleEffect } = usePreset();

  const handleFile = useCallback((buffer: Uint8Array, _filename: string) => {
    try {
      const decoder = new PRSTDecoder(buffer);
      loadPreset(decoder.decode());
    } catch (err) {
      alert(`Fehler beim Laden: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [loadPreset]);

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
          maxLength={12}
          data-testid="patch-name-input"
          className="border rounded px-3 py-2 w-full max-w-xs"
        />
      </div>
      <div className="grid gap-3 mb-6">
        {preset.effects.map((slot) => (
          <EffectSlot
            key={slot.slotIndex}
            slot={slot}
            onToggle={toggleEffect}
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
