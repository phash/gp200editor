import type { IngestSource, PresetCandidate } from '../types';
import { parseListingPage, parseDetailPage } from './guitarpatches-parser';

const BASE = 'https://guitarpatches.com';
const UA = 'PresetForge-Ingest/1.0 (+https://preset-forge.com; contact: phash@phash.de)';
const CRAWL_DELAY_MS = 10_000;

async function delay(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function polite<T>(fn: () => Promise<T>): Promise<T> {
  const result = await fn();
  await delay(CRAWL_DELAY_MS);
  return result;
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (res.status === 429) {
      console.warn(`guitarpatches: 429 on ${url}, backing off 60s`);
      await delay(60_000);
      return null;
    }
    if (!res.ok) {
      console.warn(`guitarpatches: HTTP ${res.status} on ${url}`);
      return null;
    }
    return await res.text();
  } catch (err) {
    console.warn(`guitarpatches: ${url} failed: ${err instanceof Error ? err.message : err}`);
    return null;
  }
}

async function fetchBuffer(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (!res.ok) {
      console.warn(`guitarpatches: download HTTP ${res.status} on ${url}`);
      return null;
    }
    return Buffer.from(await res.arrayBuffer());
  } catch (err) {
    console.warn(`guitarpatches: download ${url} failed: ${err instanceof Error ? err.message : err}`);
    return null;
  }
}

export function guitarpatchesSource(maxPages = 20): IngestSource {
  return {
    id: 'guitarpatches',
    description: 'Community patches from guitarpatches.com',
    async *fetch(): AsyncIterable<PresetCandidate> {
      for (let page = 1; page <= maxPages; page++) {
        const listingUrl = `${BASE}/patches.php?unit=GP200&sort=date&page=${page}`;
        const listingHtml = await polite(() => fetchText(listingUrl));
        if (!listingHtml) {
          console.warn(`guitarpatches: stopping at page ${page} (no html)`);
          break;
        }

        const items = parseListingPage(listingHtml);
        if (items.length === 0) {
          console.log(`guitarpatches: page ${page} has no items, stopping`);
          break;
        }
        console.log(`guitarpatches: page ${page} has ${items.length} items`);

        for (const item of items) {
          const detailUrl = `${BASE}/patches.php?mode=show&unit=GP200&ID=${item.id}`;
          const detailHtml = await polite(() => fetchText(detailUrl));
          const detail = detailHtml
            ? parseDetailPage(detailHtml, item.id)
            : { id: item.id, name: item.name, artist: item.artist, description: null, uploader: null, date: null };

          const downloadUrl = `${BASE}/download.php?unit=GP200&mode=download&ID=${item.id}`;
          const buffer = await polite(() => fetchBuffer(downloadUrl));
          if (!buffer) continue;

          const hintParts: string[] = [];
          if (detail.artist) hintParts.push(`Inspired by ${detail.artist}.`);
          if (detail.uploader) {
            hintParts.push(
              `Originally uploaded by ${detail.uploader}${detail.date ? ` on ${detail.date}` : ''}.`,
            );
          }
          const hint = hintParts.join(' ') || undefined;

          yield {
            buffer,
            sourceUrl: detailUrl,
            sourceLabel: 'guitarpatches.com',
            suggestedName: detail.name || item.name,
            hint,
          };
        }
      }
    },
  };
}
