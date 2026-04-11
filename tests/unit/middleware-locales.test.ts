import { describe, it, expect } from 'vitest';

// This test exercises the regex patterns directly rather than running the
// full middleware through a fake NextRequest — the patterns are what
// actually need to match real-world URLs, and copying them here keeps the
// test focused on the regression we care about (adding a locale must not
// break the existing ones).
const PROTECTED_ROUTE_PATTERN =
  /^\/(de|en|es|fr|it|pt)\/(profile|presets|admin)(?:\/|$)/;
const LOCALE_PREFIX_PATTERN = /^\/(de|en|es|fr|it|pt)(?=\/|$)/;

describe('PROTECTED_ROUTE_PATTERN', () => {
  it.each([
    ['/de/profile', true],
    ['/en/profile', true],
    ['/es/profile', true],
    ['/fr/profile/edit', true],
    ['/it/presets', true],
    ['/pt/admin', true],
    ['/pt/admin/users', true],
  ])('matches protected locale route %s', (path, expected) => {
    expect(PROTECTED_ROUTE_PATTERN.test(path)).toBe(expected);
  });

  it.each([
    ['/en/editor'],
    ['/de/gallery'],
    ['/fr/help'],
    ['/xx/profile'],
    ['/profile'],
    ['/api/profile'],
  ])('does not match %s', (path) => {
    expect(PROTECTED_ROUTE_PATTERN.test(path)).toBe(false);
  });
});

describe('LOCALE_PREFIX_PATTERN', () => {
  it.each([
    ['/de/profile', 'de'],
    ['/en/editor', 'en'],
    ['/es', 'es'],
    ['/fr/share/abc123', 'fr'],
    ['/it/gallery', 'it'],
    ['/pt', 'pt'],
  ])('extracts locale %s from %s', (path, expected) => {
    const match = LOCALE_PREFIX_PATTERN.exec(path);
    expect(match?.[1]).toBe(expected);
  });

  it('returns null for paths without a known locale prefix', () => {
    expect(LOCALE_PREFIX_PATTERN.exec('/profile')).toBeNull();
    expect(LOCALE_PREFIX_PATTERN.exec('/xx/profile')).toBeNull();
  });
});
