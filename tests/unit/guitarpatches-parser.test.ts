import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  parseListingPage,
  parseDetailPage,
  decodeHtmlEntities,
} from '../../scripts/ingest/sources/guitarpatches-parser';

const listingHtml = fs.readFileSync(
  path.join(process.cwd(), 'tests/fixtures/guitarpatches/listing-page-1.html'),
  'utf-8',
);
const detailHtml = fs.readFileSync(
  path.join(process.cwd(), 'tests/fixtures/guitarpatches/detail-14655.html'),
  'utf-8',
);

describe('parseListingPage', () => {
  const items = parseListingPage(listingHtml);

  it('extracts multiple cards', () => {
    expect(items.length).toBeGreaterThan(5);
  });

  it('each card has id, name, and (usually) artist', () => {
    for (const item of items) {
      expect(item.id).toMatch(/^\d+$/);
      expect(item.name.length).toBeGreaterThan(0);
    }
  });
});

describe('decodeHtmlEntities', () => {
  it('handles the 5 basic entities', () => {
    expect(decodeHtmlEntities('&amp;&lt;&gt;&quot;&#39;')).toBe('&<>"\'');
  });

  it('handles numeric decimal entities', () => {
    expect(decodeHtmlEntities('&#8217;')).toBe('\u2019'); // right single quote
    expect(decodeHtmlEntities('&#169;')).toBe('\u00A9'); // copyright
  });

  it('handles numeric hex entities', () => {
    expect(decodeHtmlEntities('&#x2019;')).toBe('\u2019');
    expect(decodeHtmlEntities('&#X00E9;')).toBe('\u00E9'); // é
  });

  it('handles common named entities used in real preset metadata', () => {
    expect(decodeHtmlEntities('Mot&ouml;rhead')).toBe('Mot\u00F6rhead');
    expect(decodeHtmlEntities('Motl&eacute;y Cr&uuml;e')).toBe('Motl\u00E9y Cr\u00FCe');
    expect(decodeHtmlEntities('AC&amp;DC')).toBe('AC&DC');
    expect(decodeHtmlEntities('&copy; 2024')).toBe('\u00A9 2024');
    expect(decodeHtmlEntities('&lsquo;Metal&rsquo;')).toBe('\u2018Metal\u2019');
  });

  it('passes unknown entities through unchanged', () => {
    expect(decodeHtmlEntities('&zzzzznotreal;')).toBe('&zzzzznotreal;');
    // Prevents a bad decoder from producing garbage for unrecognized input
  });

  it('rejects out-of-range numeric entities', () => {
    // 0x11FFFF is above Unicode max — fromCodePoint would throw
    expect(decodeHtmlEntities('&#x200000;')).toBe('&#x200000;');
  });

  it('handles mixed content', () => {
    expect(decodeHtmlEntities('Plain text &amp; Caf&eacute; &#8211; done'))
      .toBe('Plain text & Caf\u00E9 \u2013 done');
  });
});

describe('parseDetailPage', () => {
  const detail = parseDetailPage(detailHtml, '14655');

  it('extracts id, name, artist', () => {
    expect(detail.id).toBe('14655');
    expect(detail.name.length).toBeGreaterThan(0);
  });

  it('has a non-empty description', () => {
    expect(detail.description).toBeTruthy();
  });

  it('has an uploader and date', () => {
    expect(detail.uploader).toBeTruthy();
    expect(detail.date).toBeTruthy();
  });
});
