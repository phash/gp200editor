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

/** Heading tokens that mark a section as internal/developer-facing. A heading
 *  is hidden from the marketing surface if ANY of its whitespace/punctuation
 *  separated tokens is in this set — so combined headings like
 *  "Performance + Security" or "Schema / Performance" still count as internal
 *  and security notes never lead the landing page. */
const INTERNAL_HEADING_TOKENS = new Set([
  'security', 'schema', 'protocol', 'storage', 'validation',
  'ci', 'chore', 'refactor', 'internal', 'deps', 'dependency',
  'dependencies', 'test', 'tests', 'infra', 'build',
]);

/** True when a changelog section heading is worth showing to end users on the
 *  landing "what's new" block. Everything that isn't explicitly internal
 *  (Features, Bugfixes, Fix, UI, i18n, Performance, …) qualifies. */
export function isUserFacingHeading(heading: string): boolean {
  const tokens = heading.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  return tokens.length > 0 && !tokens.some((tok) => INTERNAL_HEADING_TOKENS.has(tok));
}

/** Reduce a release list to the most recent release that has at least one
 *  user-facing section, keeping only those sections. Scans newest→oldest so a
 *  release that's purely internal (e.g. a security-only hotfix) doesn't blank
 *  out the landing block — we fall through to the last release users care
 *  about. Returns null if nothing user-facing exists. Pure, so it's unit
 *  testable without touching the filesystem. */
export function pickLatestUserFacing(releases: ChangelogRelease[]): ChangelogRelease | null {
  for (const release of releases) {
    const sections = release.sections.filter((s) => isUserFacingHeading(s.heading));
    if (sections.length > 0) return { ...release, sections };
  }
  return null;
}

/** Convenience wrapper around pickLatestUserFacing over the parsed CHANGELOG. */
export function getLatestUserFacingRelease(): ChangelogRelease | null {
  return pickLatestUserFacing(getChangelog());
}
