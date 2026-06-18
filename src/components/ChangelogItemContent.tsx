import { parseInline, type ChangelogItem } from '@/lib/changelog';

/** Render the limited inline markdown of a changelog line (`code`, **bold**,
 *  *italic*) as real elements instead of literal characters. Server-only —
 *  pulled in by the changelog page and the homepage "what's new" block. */
function Inline({ text }: { text: string }) {
  return (
    <>
      {parseInline(text).map((tok, i) => {
        switch (tok.type) {
          case 'code':
            return (
              <code
                key={i}
                className="font-mono-display text-[0.85em] px-1 py-0.5 rounded-[3px] align-baseline"
                style={{
                  background: 'var(--bg-surface-raised)',
                  color: 'var(--accent-amber)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                {tok.value}
              </code>
            );
          case 'strong':
            return (
              <strong key={i} style={{ color: 'var(--text-secondary)' }}>
                {tok.value}
              </strong>
            );
          case 'em':
            return <em key={i}>{tok.value}</em>;
          default:
            return <span key={i}>{tok.value}</span>;
        }
      })}
    </>
  );
}

/** The inner content of one changelog bullet: bold lead-in title + body, with
 *  inline markdown rendered. The em-dash separator only reads well after a
 *  short label — when the title is a full lead-in sentence (ends in terminal
 *  punctuation) we follow it with a plain space instead. */
export function ChangelogItemContent({ item }: { item: ChangelogItem }) {
  if (!item.title) {
    return (
      <span style={{ color: 'var(--text-muted)' }}>
        <Inline text={item.body} />
      </span>
    );
  }

  const sep = /[.!?:…)]$/.test(item.title) ? ' ' : ' — ';
  return (
    <>
      <strong style={{ color: 'var(--text-secondary)' }}>
        <Inline text={item.title} />
      </strong>
      {item.body && (
        <span style={{ color: 'var(--text-muted)' }}>
          {sep}
          <Inline text={item.body} />
        </span>
      )}
    </>
  );
}
