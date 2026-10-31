/**
 * Title and description for a /share/[token] page.
 *
 * GSC (Oct 2026) showed share pages at position ~9 with a 2.9% CTR. The old
 * title spent its visible width on "by @factory-library", and the
 * description named the amp three times because the ingest pipeline writes
 * an auto-generated chain summary into Preset.description.
 *
 * GSC 2026-07-30..10-29: still 3.7% CTR over 292 share URLs. Searchers look
 * for an amp or a style ("marshall jcm800 gp-200 preset", "valeton gp 200
 * presets free download"), so title and description now lead with those and
 * say "free download" outright. The title is fitted to ~60 characters by
 * dropping the least specific part first; the brand suffix went, Google shows
 * the site name on its own.
 */

const MAX_TITLE = 60;
const MAX_DESCRIPTION = 155;
const CALL_TO_ACTION = 'Get the .prst or open it in the browser editor.';
// Prefix of the description the library ingest generates from the decoded chain.
const AUTO_DESCRIPTION_PREFIX = 'Valeton GP-200 preset:';

type ShareMetaInput = {
  name: string;
  style: string | null;
  description: string | null;
  amp: string | null;
  cab: string | null;
  drive: string | null;
};

function stripTrademarks(name: string): string {
  return name.replace(/[®™]/g, '');
}

/** "Mesa/Boogie® Dual Rectifier® (Modern mode)" → "Mesa/Boogie Dual Rectifier" */
export function plainAmpName(realName: string): string {
  return stripTrademarks(realName).replace(/\s*\([^)]*\)/g, '').trim();
}

function humanDescription(description: string | null): string | null {
  if (!description || description.startsWith(AUTO_DESCRIPTION_PREFIX)) return null;
  const text = description
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.\s]+$/, '');
  return text || null;
}

function chainSentence(
  amp: string | null,
  cab: string | null,
  drive: string | null,
  style: string | null,
): string {
  const parts: string[] = [];
  if (amp) parts.push(`${plainAmpName(amp)} amp${cab ? ` into ${stripTrademarks(cab)}` : ''}`);
  else if (cab) parts.push(stripTrademarks(cab));
  if (drive) parts.push(`with ${stripTrademarks(drive)}`);
  const lead = `Free Valeton GP-200 ${style ? `${style} ` : ''}preset download`;
  return parts.length ? `${lead}: ${parts.join(', ')}.` : `${lead}.`;
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).replace(/[\s,.;:–-]+$/, '')}…`;
}

function buildTitle(name: string, style: string | undefined, amp: string | null): string {
  const ampName = amp ? plainAmpName(amp) : null;
  const variants = [
    style && ampName && `${style} ${ampName}`,
    ampName,
    style,
  ].filter((v): v is string => Boolean(v));
  for (const lead of variants) {
    const title = `${name} – ${lead} GP-200 Preset | Free Download`;
    if (title.length <= MAX_TITLE) return title;
  }
  return `${name} – Free GP-200 Preset Download`;
}

export function buildShareMeta(input: ShareMetaInput): { title: string; description: string } {
  const style = input.style?.trim() || undefined;
  const title = buildTitle(input.name, style, input.amp);

  const human = humanDescription(input.description);
  const description = truncate(
    [chainSentence(input.amp, input.cab, input.drive, style ?? null), human && `${human}.`, CALL_TO_ACTION]
      .filter(Boolean)
      .join(' '),
    MAX_DESCRIPTION,
  );

  return { title, description };
}
