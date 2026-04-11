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

// Minimal-but-robust HTML entity decoder. The previous implementation only
// handled 5 named entities, which meant anything else (&#8217; curly quote,
// &copy;, &eacute;, etc.) leaked through literally into ingested preset names
// and descriptions. We don't want to pull in a full HTML parser for scraping,
// but we do need to handle:
//   1. numeric decimal   — &#NNNN;
//   2. numeric hex       — &#xHHHH; / &#XHHHH;
//   3. ~30 common named entities real-world content uses (curly quotes,
//      copyright, accented vowels for French/German band names, etc.)
// Unknown entities are passed through unchanged so a bad lookup never
// produces garbage.
const NAMED_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'",
  nbsp: ' ', copy: '\u00A9', reg: '\u00AE', trade: '\u2122',
  hellip: '\u2026', mdash: '\u2014', ndash: '\u2013',
  lsquo: '\u2018', rsquo: '\u2019', ldquo: '\u201C', rdquo: '\u201D',
  laquo: '\u00AB', raquo: '\u00BB', deg: '\u00B0',
  auml: '\u00E4', ouml: '\u00F6', uuml: '\u00FC', szlig: '\u00DF',
  Auml: '\u00C4', Ouml: '\u00D6', Uuml: '\u00DC',
  eacute: '\u00E9', egrave: '\u00E8', ecirc: '\u00EA',
  aacute: '\u00E1', agrave: '\u00E0', acirc: '\u00E2',
  iacute: '\u00ED', igrave: '\u00EC', icirc: '\u00EE',
  oacute: '\u00F3', ograve: '\u00F2', ocirc: '\u00F4',
  uacute: '\u00FA', ugrave: '\u00F9', ucirc: '\u00FB',
  ntilde: '\u00F1', ccedil: '\u00E7',
};

// Reject code points that have no business landing in user-facing preset
// metadata even if the source page legitimately contains them. Ranges:
//   0x00–0x1F minus TAB/LF  — C0 control chars, BEL, backspace, etc.
//   0x7F–0x9F               — DEL + C1 control chars
//   0x202A–0x202E, 0x2066–0x2069 — bidi override / isolate (spoofing)
//   0xD800–0xDFFF           — UTF-16 surrogates (malformed input)
//   0xFDD0–0xFDEF, 0xFFFE–0xFFFF — Unicode noncharacters
function isSafeCodePoint(code: number): boolean {
  if (code < 0x20) return code === 0x09 || code === 0x0a;
  if (code >= 0x7f && code <= 0x9f) return false;
  if (code >= 0x202a && code <= 0x202e) return false;
  if (code >= 0x2066 && code <= 0x2069) return false;
  if (code >= 0xd800 && code <= 0xdfff) return false;
  if (code >= 0xfdd0 && code <= 0xfdef) return false;
  if (code === 0xfffe || code === 0xffff) return false;
  return true;
}

export function decodeHtmlEntities(s: string): string {
  return s.replace(/&(#[xX][0-9a-fA-F]+|#[0-9]+|[a-zA-Z]+);/g, (full, body: string) => {
    if (body[0] === '#') {
      const isHex = body[1] === 'x' || body[1] === 'X';
      const code = parseInt(body.slice(isHex ? 2 : 1), isHex ? 16 : 10);
      if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return full;
      if (!isSafeCodePoint(code)) return full;
      try {
        return String.fromCodePoint(code);
      } catch {
        return full;
      }
    }
    const mapped = NAMED_ENTITIES[body];
    return mapped ?? full;
  });
}
