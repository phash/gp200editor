import { describe, it, expect } from 'vitest';
import { parseChangelog, parseInline, isUserFacingHeading, pickLatestUserFacing } from '@/lib/changelog';

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

  it('parses a bold lead-in followed by prose without a dash separator', () => {
    const md = [
      '## 2026-06-18',
      '',
      '### Fix',
      '- **Did the thing (#80).** Then more prose with `code`.',
    ].join('\n');
    const releases = parseChangelog(md);
    expect(releases[0].sections[0].items[0]).toEqual({
      title: 'Did the thing (#80).',
      body: 'Then more prose with `code`.',
    });
  });

  it('still splits the classic "Title — body" dash form', () => {
    const md = ['## 2026-06-18', '', '### Fix', '- **Title** — the body'].join('\n');
    const releases = parseChangelog(md);
    expect(releases[0].sections[0].items[0]).toEqual({ title: 'Title', body: 'the body' });
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

describe('parseInline', () => {
  it('returns a single text token for plain text', () => {
    expect(parseInline('hello world')).toEqual([{ type: 'text', value: 'hello world' }]);
  });

  it('parses a code span between text', () => {
    expect(parseInline('use `npm ci` now')).toEqual([
      { type: 'text', value: 'use ' },
      { type: 'code', value: 'npm ci' },
      { type: 'text', value: ' now' },
    ]);
  });

  it('parses italic and bold spans', () => {
    expect(parseInline('the *Typ* and **bold** end')).toEqual([
      { type: 'text', value: 'the ' },
      { type: 'em', value: 'Typ' },
      { type: 'text', value: ' and ' },
      { type: 'strong', value: 'bold' },
      { type: 'text', value: ' end' },
    ]);
  });

  it('does not parse markup inside a code span', () => {
    expect(parseInline('`a*b*c`')).toEqual([{ type: 'code', value: 'a*b*c' }]);
  });

  it('handles adjacent path-like code spans', () => {
    expect(parseInline('`/api/share/[token]` and `flagged: false`')).toEqual([
      { type: 'code', value: '/api/share/[token]' },
      { type: 'text', value: ' and ' },
      { type: 'code', value: 'flagged: false' },
    ]);
  });

  it('returns an empty array for an empty string', () => {
    expect(parseInline('')).toEqual([]);
  });
});

describe('isUserFacingHeading', () => {
  it('accepts user-facing headings', () => {
    for (const h of ['Features', 'Bugfixes', 'Fix', 'UI / i18n', 'Performance', 'i18n-Polish (Sprach-Review)']) {
      expect(isUserFacingHeading(h)).toBe(true);
    }
  });

  it('rejects internal headings', () => {
    for (const h of ['Security', 'Schema', 'Protocol', 'Storage / Validation', 'Local CI', 'Schema / Performance']) {
      expect(isUserFacingHeading(h)).toBe(false);
    }
  });

  it('treats a combined heading as internal if any token is internal', () => {
    expect(isUserFacingHeading('Performance + Security')).toBe(false);
  });

  it('rejects an empty heading', () => {
    expect(isUserFacingHeading('   ')).toBe(false);
  });
});

describe('pickLatestUserFacing', () => {
  const release = (date: string, ...headings: string[]) => ({
    date,
    sections: headings.map((heading) => ({ heading, items: [{ title: heading, body: '' }] })),
  });

  it('keeps only the user-facing sections of the newest release that has any', () => {
    const picked = pickLatestUserFacing([
      release('2026-05-19', 'Security', 'Fix'),
      release('2026-05-10', 'Features'),
    ]);
    expect(picked?.date).toBe('2026-05-19');
    expect(picked?.sections.map((s) => s.heading)).toEqual(['Fix']);
  });

  it('falls through a purely-internal release to the last user-facing one', () => {
    const picked = pickLatestUserFacing([
      release('2026-05-19', 'Security', 'Schema'),
      release('2026-05-10', 'Features'),
    ]);
    expect(picked?.date).toBe('2026-05-10');
    expect(picked?.sections.map((s) => s.heading)).toEqual(['Features']);
  });

  it('returns null when nothing is user-facing', () => {
    expect(pickLatestUserFacing([release('2026-05-19', 'Security')])).toBeNull();
  });
});
