import { describe, it, expect } from 'vitest';
import { parseChangelog } from '@/lib/changelog';

describe('parseChangelog', () => {
  it('returns empty array for empty input', () => {
    expect(parseChangelog('')).toEqual([]);
  });

  it('parses a single release with sections and items', () => {
    const md = `# Changelog

## 2026-04-11

### Features
- **Foo** — did the foo thing
- **Bar** — did the bar thing

### Bugfixes
- **Baz** — fixed baz
`;
    const releases = parseChangelog(md);
    expect(releases).toHaveLength(1);
    expect(releases[0].date).toBe('2026-04-11');
    expect(releases[0].sections).toHaveLength(2);
    expect(releases[0].sections[0].heading).toBe('Features');
    expect(releases[0].sections[0].items).toEqual([
      { title: 'Foo', body: 'did the foo thing' },
      { title: 'Bar', body: 'did the bar thing' },
    ]);
    expect(releases[0].sections[1].heading).toBe('Bugfixes');
    expect(releases[0].sections[1].items).toEqual([
      { title: 'Baz', body: 'fixed baz' },
    ]);
  });

  it('parses multiple releases in order', () => {
    const md = `# Changelog

## 2026-04-11

### Features
- **A** — newer

## 2026-03-24

### Bugfixes
- **B** — older
`;
    const releases = parseChangelog(md);
    expect(releases).toHaveLength(2);
    expect(releases[0].date).toBe('2026-04-11');
    expect(releases[1].date).toBe('2026-03-24');
  });

  it('handles bullets with no body', () => {
    const md = `## 2026-04-11

### Features
- **Title only**
`;
    const releases = parseChangelog(md);
    expect(releases[0].sections[0].items).toEqual([
      { title: 'Title only', body: '' },
    ]);
  });

  it('handles unbold bullets as plain body', () => {
    const md = `## 2026-04-11

### Features
- plain text without bold
`;
    const releases = parseChangelog(md);
    expect(releases[0].sections[0].items).toEqual([
      { title: '', body: 'plain text without bold' },
    ]);
  });

  it('ignores blank lines and prose between items', () => {
    const md = `## 2026-04-11

Some paragraph text that should be ignored.

### Features

- **Foo** — works
`;
    const releases = parseChangelog(md);
    expect(releases[0].sections[0].items).toHaveLength(1);
    expect(releases[0].sections[0].items[0].title).toBe('Foo');
  });
});
