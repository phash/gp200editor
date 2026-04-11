export type ListingItem = {
  id: string;
  name: string;
  artist: string | null;
};

export type DetailInfo = {
  id: string;
  name: string;
  artist: string | null;
  description: string | null;
  uploader: string | null;
  date: string | null;
};

// Listing cards contain an onclick handler with ID=NNNN plus h1/h2 for name/artist.
// The site's markup has occasional tag-mismatch so regexes are deliberately tolerant.

const LISTING_CARD_RE =
  /onclick="[^"]*ID=(\d+)[^"]*"[\s\S]*?<h1[^>]*>([^<]+)<\/h1>[\s\S]*?<h2[^>]*>([^<]*)<\/h2>/g;

export function parseListingPage(html: string): ListingItem[] {
  const items: ListingItem[] = [];
  let match: RegExpExecArray | null;
  LISTING_CARD_RE.lastIndex = 0;
  while ((match = LISTING_CARD_RE.exec(html)) !== null) {
    items.push({
      id: match[1],
      name: decodeHtmlEntities(match[2].trim()),
      artist: match[3].trim() ? decodeHtmlEntities(match[3].trim()) : null,
    });
  }
  return items;
}

const DETAIL_TITLE_RE = /<p\s+class="title is-3"[^>]*>([^<]+)</;
const DETAIL_SUBTITLE_RE = /<p\s+class="subtitle is-5"[^>]*>([\s\S]*?)<\/p>/;
const DETAIL_H3_RE = /<h3\s+class="title is-6[^"]*"[^>]*>([^<]+)<\/h3>/g;

export function parseDetailPage(html: string, id: string): DetailInfo {
  const titleMatch = DETAIL_TITLE_RE.exec(html);
  let name = '';
  let artist: string | null = null;
  if (titleMatch) {
    const raw = decodeHtmlEntities(titleMatch[1].trim());
    const dashIdx = raw.lastIndexOf(' - ');
    if (dashIdx > 0) {
      name = raw.slice(0, dashIdx).trim();
      artist = raw.slice(dashIdx + 3).trim();
    } else {
      name = raw;
    }
  }

  const descMatch = DETAIL_SUBTITLE_RE.exec(html);
  const description = descMatch
    ? decodeHtmlEntities(descMatch[1].replace(/<[^>]+>/g, '').trim()) || null
    : null;

  DETAIL_H3_RE.lastIndex = 0;
  const h3Values: string[] = [];
  let h3Match: RegExpExecArray | null;
  while ((h3Match = DETAIL_H3_RE.exec(html)) !== null) {
    h3Values.push(decodeHtmlEntities(h3Match[1].trim()));
  }
  const [uploader = null, date = null] = h3Values;

  return { id, name, artist, description, uploader, date };
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}
