/**
 * Server-only helper that reads CHANGELOG.md from the repo root and parses
 * it into a structured list of releases. Used by the home page (to show a
 * "what's new" excerpt) and the full /changelog page.
 *
 * Format expected:
 *   ## YYYY-MM-DD
 *   ### Features | Bugfixes | Protocol | ...
 *   - **Title** — description text
 *
 * No external markdown library — the format is stable and a 30-line
 * regex parser is good enough here. If the format ever changes, the
 * tests/unit/changelog.test.ts fixtures will catch it.
 */
import fs from 'node:fs';
import path from 'node:path';

export type ChangelogItem = {
  /** Short title extracted from the **bold** part at the start of a bullet. */
  title: string;
  /** Remaining text after the title. May be empty. */
  body: string;
};

export type ChangelogSection = {
  /** "Features", "Bugfixes", "Protocol", etc. */
  heading: string;
  items: ChangelogItem[];
};

export type ChangelogRelease = {
  /** Raw date string from the h2 heading, e.g. "2026-04-11". */
  date: string;
  sections: ChangelogSection[];
};

/** Read + parse CHANGELOG.md. Cached per module instance (good enough
 *  since the file is shipped in the Docker image and doesn't change at
 *  runtime). Called from Server Components only. */
let cached: ChangelogRelease[] | null = null;

export function getChangelog(): ChangelogRelease[] {
  if (cached) return cached;
  const filePath = path.join(process.cwd(), 'CHANGELOG.md');
  let raw = '';
  try {
    raw = fs.readFileSync(filePath, 'utf-8');
  } catch {
    return (cached = []);
  }
  cached = parseChangelog(raw);
  return cached;
}

export function parseChangelog(markdown: string): ChangelogRelease[] {
  const releases: ChangelogRelease[] = [];
  const lines = markdown.split(/\r?\n/);

  let currentRelease: ChangelogRelease | null = null;
  let currentSection: ChangelogSection | null = null;

  for (const line of lines) {
    // Release heading: "## 2026-04-11"
    const releaseMatch = line.match(/^##\s+(\d{4}-\d{2}-\d{2})\s*$/);
    if (releaseMatch) {
      currentRelease = { date: releaseMatch[1], sections: [] };
      currentSection = null;
      releases.push(currentRelease);
      continue;
    }

    // Section heading: "### Features"
    const sectionMatch = line.match(/^###\s+(.+?)\s*$/);
    if (sectionMatch && currentRelease) {
      currentSection = { heading: sectionMatch[1], items: [] };
      currentRelease.sections.push(currentSection);
      continue;
    }

    // Bullet item: "- **Title** — body text"
    // Also matches "- **Title**" with no body, and "- plain text" (title = "", body = text).
    const bulletMatch = line.match(/^-\s+(.*)$/);
    if (bulletMatch && currentSection) {
      const content = bulletMatch[1];
      const boldMatch = content.match(/^\*\*(.+?)\*\*(?:\s*[—–-]\s*(.*))?$/);
      if (boldMatch) {
        currentSection.items.push({
          title: boldMatch[1].trim(),
          body: (boldMatch[2] ?? '').trim(),
        });
      } else {
        currentSection.items.push({ title: '', body: content.trim() });
      }
      continue;
    }
    // Everything else (blank lines, prose paragraphs) is ignored — the
    // changelog format is strict bullets under section headings.
  }

  return releases;
}
