import fs from 'node:fs/promises';
import type { IngestSource, PresetCandidate } from '../types';

type ManualEntry = {
  url: string;
  label: string;
  name?: string;
};

/**
 * Reads a JSON file of manually curated URLs and downloads each as a
 * preset candidate. Any fetch failure is logged and skipped.
 */
export function manualSource(jsonPath: string): IngestSource {
  return {
    id: 'manual',
    description: `Manual curated list from ${jsonPath}`,
    async *fetch(): AsyncIterable<PresetCandidate> {
      let entries: ManualEntry[];
      try {
        const text = await fs.readFile(jsonPath, 'utf-8');
        entries = JSON.parse(text);
        if (!Array.isArray(entries)) throw new Error('manual-sources.json must be an array');
      } catch (err) {
        console.warn(`manual: cannot read ${jsonPath}: ${err instanceof Error ? err.message : err}`);
        return;
      }

      for (const entry of entries) {
        try {
          const res = await fetch(entry.url);
          if (!res.ok) {
            console.warn(`manual: ${entry.url} -> HTTP ${res.status}`);
            continue;
          }
          const buffer = Buffer.from(await res.arrayBuffer());
          yield {
            buffer,
            sourceUrl: entry.url,
            sourceLabel: entry.label,
            suggestedName: entry.name,
          };
        } catch (err) {
          console.warn(`manual: ${entry.url} failed: ${err instanceof Error ? err.message : err}`);
        }
      }
    },
  };
}
