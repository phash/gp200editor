import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  parseListingPage,
  parseDetailPage,
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
