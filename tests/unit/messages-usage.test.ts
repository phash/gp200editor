import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// messages-parity.test.ts compares every locale against en.json, so it only
// catches a key that some locales have and others lack. A key that no file
// has at all — because a component asked for one that was never written —
// looks like perfect parity and ships. `home.uploadCta` did exactly that
// from cd70c71 until this test, throwing MISSING_MESSAGE on every render of
// the editor page in production.
//
// This walks the other direction: from the t('...') call sites in src/ back
// to en.json.

const NAMESPACE_BINDING =
  /(?:const|let)\s+(\w+)\s*=\s*(?:await\s+)?(?:useTranslations|getTranslations)\s*\(\s*(?:\{[^}]*namespace:\s*)?['"`]([\w.]+)['"`]/g;
// t('some.key') — literal single-quoted keys only. Template literals and
// computed keys are resolved at runtime and can't be checked statically.
const CALL = (varName: string) =>
  new RegExp(`\\b${varName}\\s*\\(\\s*['"]([\\w.]+)['"]`, 'g');

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (fs.statSync(full).isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(entry) ? [full] : [];
  });
}

function hasKey(obj: unknown, dotted: string): boolean {
  let cur: unknown = obj;
  for (const part of dotted.split('.')) {
    if (cur === null || typeof cur !== 'object') return false;
    if (!(part in (cur as Record<string, unknown>))) return false;
    cur = (cur as Record<string, unknown>)[part];
  }
  return true;
}

describe('translation keys used in src/ exist in en.json', () => {
  const en = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'messages', 'en.json'), 'utf-8'),
  );

  it('every literal t(...) call resolves to a real key', () => {
    const missing: string[] = [];

    for (const file of sourceFiles(path.join(process.cwd(), 'src'))) {
      const src = fs.readFileSync(file, 'utf-8');

      for (const [, varName, namespace] of src.matchAll(NAMESPACE_BINDING)) {
        for (const [, key] of src.matchAll(CALL(varName))) {
          const dotted = `${namespace}.${key}`;
          if (!hasKey(en, dotted)) {
            missing.push(`${path.relative(process.cwd(), file)}: ${dotted}`);
          }
        }
      }
    }

    expect([...new Set(missing)].sort()).toEqual([]);
  });
});
