import { PRSTEncoder } from '@/core/PRSTEncoder';
import type { GP200Preset } from '@/core/types';

/**
 * Serialize a GP200Preset into the 1224-byte .prst binary format.
 *
 * Extracted from src/app/[locale]/editor/page.tsx so the editor page
 * doesn't need to own a PRSTEncoder instance for a one-line call. The
 * caller passes the preset explicitly — no React state coupling.
 */
export function encodePreset(preset: GP200Preset): ArrayBuffer {
  return new PRSTEncoder().encode(preset);
}

/**
 * Trigger a browser download of the preset as a .prst file. The file
 * is named after the patch name. Requires a DOM environment (uses
 * URL.createObjectURL + an anchor-click trick).
 */
export function downloadPresetFile(preset: GP200Preset): void {
  const ab = encodePreset(preset);
  const blob = new Blob([ab], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${preset.patchName}.prst`;
  a.click();
  URL.revokeObjectURL(url);
}
