import type { Config } from "tailwindcss";

// Every color here reads from a CSS variable defined in src/app/globals.css
// so theme tweaks stay in one place and dark/light variants would Just Work.
// Ships the full pedalboard palette as Tailwind utilities — hover: and
// focus-visible: variants become usable without inline style+JS.
const config: Config = {
  content: [
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        'bg-primary':        'var(--bg-primary)',
        'bg-surface':        'var(--bg-surface)',
        'bg-surface-raised': 'var(--bg-surface-raised)',
        'bg-elevated':       'var(--bg-elevated)',
        'bg-card':           'var(--bg-card)',
        'bg-input':          'var(--bg-input)',
        'bg-deep':           'var(--bg-deep)',
        'bg-hover':          'var(--bg-hover)',
        'text-primary':      'var(--text-primary)',
        'text-secondary':    'var(--text-secondary)',
        'text-muted':        'var(--text-muted)',
        'border-subtle':     'var(--border-subtle)',
        'border-active':     'var(--border-active)',
        'accent-amber':      'var(--accent-amber)',
        'accent-amber-dim':  'var(--accent-amber-dim)',
        'accent-red':        'var(--accent-red)',
        'accent-green':      'var(--accent-green)',
      },
      boxShadow: {
        'glow-amber': '0 0 12px var(--glow-amber)',
        'glow-red':   '0 0 12px var(--glow-red)',
        'glow-green': '0 0 12px var(--glow-green)',
        'card':       '0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.03)',
      },
    },
  },
  plugins: [],
};
export default config;
