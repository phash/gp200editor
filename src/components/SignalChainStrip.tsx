const SLOT_NAMES = ['PRE','WAH','BST','AMP','NR','CAB','EQ','MOD','DLY','RVB','VOL'] as const;

interface Props {
  effects: string[];
}

export function SignalChainStrip({ effects }: Props) {
  return (
    <div
      className="flex items-center gap-1 font-mono-display text-[10px] uppercase tracking-wider"
      style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 8,
        padding: '8px 10px',
      }}
    >
      {SLOT_NAMES.map((slot, i) => {
        const real = effects[i];
        const active = !!real;
        return (
          <div
            key={slot}
            className="flex flex-col items-center px-2 py-1 rounded"
            style={{
              background: active ? 'var(--glow-amber)' : 'transparent',
              border: active ? '1px solid var(--accent-amber-dim)' : '1px solid transparent',
              color: active ? 'var(--accent-amber)' : 'var(--text-muted)',
              flex: '1 1 0',
              minWidth: 0,
            }}
          >
            <span className="opacity-80">{slot}</span>
            {real && (
              <span
                className="text-[9px] mt-0.5 truncate w-full text-center normal-case tracking-normal"
                style={{ color: 'var(--text-secondary)' }}
              >
                {real}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
