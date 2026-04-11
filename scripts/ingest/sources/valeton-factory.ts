import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { IngestSource, PresetCandidate } from '../types';

/**
 * Iterates a local folder of Valeton factory presets (e.g. from a Wine
 * install of the official GP-200 editor). Non-recursive.
 */
export function valetonFactorySource(folder: string): IngestSource {
  return {
    id: 'valeton-factory',
    description: `Valeton GP-200 factory presets in ${folder}`,
    async *fetch(): AsyncIterable<PresetCandidate> {
      let entries: string[];
      try {
        entries = await readdir(folder);
      } catch (err) {
        console.warn(`valeton-factory: cannot read ${folder}: ${err instanceof Error ? err.message : err}`);
        return;
      }

      for (const entry of entries) {
        if (!entry.toLowerCase().endsWith('.prst')) continue;
        const full = join(folder, entry);
        try {
          const buffer = await readFile(full);
          yield {
            buffer,
            sourceUrl: `valeton://factory/v1.8.0/${entry}`,
            sourceLabel: 'Valeton GP-200 Factory Preset (firmware v1.8.0)',
            suggestedName: entry.replace(/\.prst$/i, ''),
            hint: `Factory preset from Valeton GP-200 firmware.`,
          };
        } catch (err) {
          console.warn(`valeton-factory: skipped ${entry}: ${err instanceof Error ? err.message : err}`);
        }
      }
    },
  };
}
