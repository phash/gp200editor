'use client';
import { useRef } from 'react';
import { useTranslations } from 'next-intl';

interface FileUploadProps {
  onFile: (buffer: Uint8Array, filename: string) => void;
}

export function FileUpload({ onFile }: FileUploadProps) {
  const t = useTranslations('home');
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const buffer = new Uint8Array(e.target!.result as ArrayBuffer);
      onFile(buffer, file.name);
    };
    reader.readAsArrayBuffer(file);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  return (
    <div
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      className="border-2 border-dashed border-gray-400 rounded-xl p-12 text-center cursor-pointer hover:border-blue-500 transition"
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
      aria-label={t('uploadCta')}
      data-testid="file-upload-zone"
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
    >
      <p className="text-lg">{t('uploadCta')}</p>
      <p className="text-sm text-gray-500 mt-2">.prst</p>
      <input
        ref={inputRef}
        type="file"
        accept=".prst"
        className="hidden"
        onChange={handleChange}
        data-testid="file-input"
        aria-hidden="true"
      />
    </div>
  );
}
