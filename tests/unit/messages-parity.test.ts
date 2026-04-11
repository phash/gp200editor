import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// Recursively flatten a nested object into dot-notation key paths.
// { nav: { home: 'Home' } }  →  ['nav.home']
function flatKeys(obj: unknown, prefix = ''): string[] {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) return [];
  const out: string[] = [];
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      out.push(...flatKeys(v, key));
    } else {
      out.push(key);
    }
  }
  return out.sort();
}

describe('messages parity', () => {
  const messagesDir = path.join(process.cwd(), 'messages');
  const enRaw = JSON.parse(fs.readFileSync(path.join(messagesDir, 'en.json'), 'utf-8'));
  const enKeys = flatKeys(enRaw);

  const localeFiles = fs
    .readdirSync(messagesDir)
    .filter((f) => f.endsWith('.json') && f !== 'en.json');

  it('en.json has at least one key', () => {
    expect(enKeys.length).toBeGreaterThan(0);
  });

  for (const file of localeFiles) {
    it(`${file} has identical keys to en.json`, () => {
      const content = JSON.parse(fs.readFileSync(path.join(messagesDir, file), 'utf-8'));
      const keys = flatKeys(content);
      // Diff both ways so the error message tells us WHICH keys are missing/extra
      const missing = enKeys.filter((k) => !keys.includes(k));
      const extra = keys.filter((k) => !enKeys.includes(k));
      expect({ missing, extra }).toEqual({ missing: [], extra: [] });
    });
  }
});
