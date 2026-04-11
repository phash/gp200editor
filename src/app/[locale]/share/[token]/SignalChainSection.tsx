import type { PresetJson, NameRef } from '@/core/PRSTJsonCodec';

function HighlightChip({ label, nameRef }: { label: string; nameRef: NameRef }) {
  return (
    <div
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded text-xs"
      style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      <span
        className="font-mono-display font-bold tracking-wider uppercase"
        style={{ color: 'var(--accent-amber)' }}
      >
        {label}
      </span>
      <span style={{ color: 'var(--text-secondary)' }}>{nameRef.valetonName}</span>
      {nameRef.realName && (
        <span style={{ color: 'var(--text-muted)' }}>→ {nameRef.realName}</span>
      )}
    </div>
  );
}

export function SignalChainSection({ json }: { json: PresetJson }) {
  const activeSlots = json.signalChain.filter((s) => s.active);
  if (activeSlots.length === 0) return null;

  return (
    <section aria-labelledby="signal-chain-heading" className="mb-6">
      <h2
        id="signal-chain-heading"
        className="font-mono-display text-sm uppercase tracking-wider mb-3"
        style={{ color: 'var(--text-muted)' }}
      >
        Signal Chain
      </h2>

      <div className="flex flex-wrap gap-2 mb-4">
        {json.highlights.amp && <HighlightChip label="AMP" nameRef={json.highlights.amp} />}
        {json.highlights.cab && <HighlightChip label="CAB" nameRef={json.highlights.cab} />}
        {json.highlights.drive && <HighlightChip label="DRIVE" nameRef={json.highlights.drive} />}
      </div>

      <ol className="space-y-1.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
        {activeSlots.map((s) => (
          <li key={s.slot} className="flex gap-3 items-baseline">
            <span style={{ color: 'var(--text-muted)' }}>{s.slot + 1}.</span>
            <span
              className="font-mono-display text-[10px] tracking-wider px-2 py-0.5 rounded uppercase"
              style={{
                color: 'var(--accent-amber)',
                background: 'var(--glow-amber)',
                border: '1px solid var(--accent-amber-dim)',
              }}
            >
              {s.module}
            </span>
            <span>{s.valetonName}</span>
            {s.realName && (
              <>
                <span aria-hidden="true" style={{ color: 'var(--text-muted)' }}>→</span>
                <span style={{ color: 'var(--text-muted)' }}>{s.realName}</span>
              </>
            )}
          </li>
        ))}
      </ol>

      <p className="sr-only">{json.summary}</p>
    </section>
  );
}
