import { describe, it, expect, vi } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Under jsdom, next-intl/server resolves to its react-client build, whose
// getTranslations throws "not supported in Client Components". The pages
// below only use it for title/description copy — the URLs under test are
// built independently — so an echo translator is enough to reach them.
vi.mock('next-intl/server', () => ({
  getTranslations: async () => Object.assign((key: string) => key, { rich: (key: string) => key }),
}));

import { generateMetadata as guideMetadata } from '@/app/[locale]/guides/[slug]/page';
import { generateMetadata as guidesIndexMetadata } from '@/app/[locale]/guides/page';
import { generateMetadata as changelogMetadata } from '@/app/[locale]/changelog/page';
import { generateMetadata as helpMetadata } from '@/app/[locale]/help/page';
import { generateMetadata as playlistsMetadata } from '@/app/[locale]/playlists/page';
import { GUIDE_SLUGS } from '@/content/guides';

// Under localePrefix 'as-needed' English is served from the unprefixed
// path and /en/... only 307s there. Any canonical, hreflang or og:url
// naming a /en/ URL points Google at a redirect instead of a document —
// which is how the index ended up split across both forms of the same page.
const EN_PREFIXED = /preset-forge\.com\/en(\/|$)/;

describe('English URLs in metadata are unprefixed', () => {
  it('guide detail pages', async () => {
    const slug = GUIDE_SLUGS[0];
    const meta = await guideMetadata({ params: Promise.resolve({ locale: 'en' as const, slug }) });

    expect(meta.alternates?.canonical).not.toMatch(EN_PREFIXED);
    expect(meta.alternates?.languages?.['x-default']).not.toMatch(EN_PREFIXED);
    expect(meta.alternates?.languages?.en).not.toMatch(EN_PREFIXED);
    expect(meta.openGraph?.url).not.toMatch(EN_PREFIXED);
  });

  it('keeps other locales prefixed on guide detail pages', async () => {
    const slug = GUIDE_SLUGS[0];
    const meta = await guideMetadata({ params: Promise.resolve({ locale: 'de' as const, slug }) });
    expect(meta.alternates?.canonical).toBe(
      `https://www.preset-forge.com/de/guides/${slug}`,
    );
  });

  it.each([
    ['guides index', guidesIndexMetadata],
    ['changelog', changelogMetadata],
    ['help', helpMetadata],
    ['playlists', playlistsMetadata],
  ])('%s', async (_name, generate) => {
    const meta = await generate({ params: Promise.resolve({ locale: 'en' as const }) });

    expect(meta.alternates?.canonical).not.toMatch(EN_PREFIXED);
    expect(meta.alternates?.languages?.['x-default']).not.toMatch(EN_PREFIXED);
    expect(meta.openGraph?.url ?? '').not.toMatch(EN_PREFIXED);
  });
});

// The behaviour tests above can only cover pages whose generateMetadata runs
// without a database. This catches the rest — and any new page — at the
// source level: interpolating a locale into a URL by hand reintroduces the
// /en/ bug, so localeUrl() is the only sanctioned way to build one.
describe('no hand-built locale URLs in src/', () => {
  function walk(dir: string): string[] {
    return readdirSync(dir).flatMap((entry) => {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) return walk(full);
      return /\.tsx?$/.test(entry) ? [full] : [];
    });
  }

  it('never interpolates a locale straight after BASE_URL', () => {
    const offenders = walk(join(process.cwd(), 'src'))
      .filter((file) => !file.endsWith(join('lib', 'hreflang.ts')))
      .flatMap((file) =>
        readFileSync(file, 'utf8')
          .split('\n')
          .map((line, i) => ({ file, line: i + 1, text: line }))
          .filter(({ text }) => /\$\{BASE_URL\}\/\$\{/.test(text)),
      )
      .map(({ file, line, text }) => `${file}:${line} ${text.trim()}`);

    expect(offenders).toEqual([]);
  });
});
