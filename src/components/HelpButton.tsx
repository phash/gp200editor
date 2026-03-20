'use client';

import { Link } from '@/i18n/routing';

interface HelpButtonProps {
  section: string;
}

export function HelpButton({ section }: HelpButtonProps) {
  return (
    <Link
      href={`/help#${section}`}
      className="help-btn inline-flex items-center justify-center w-6 h-6 rounded-full font-mono-display text-[10px] font-bold transition-all duration-150"
      style={{
        border: '1px solid var(--border-subtle)',
        color: 'var(--text-muted)',
      }}
      title="Help"
    >
      ?
      <style>{`
        .help-btn:hover {
          border-color: var(--accent-amber) !important;
          color: var(--accent-amber) !important;
        }
      `}</style>
    </Link>
  );
}
