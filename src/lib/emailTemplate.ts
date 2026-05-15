import type { Locale } from '@/i18n/locales';

export type EmailCta = { label: string; url: string };
export type EmailSection = { title: string; body: string; cta?: EmailCta };

export type RenderEmailOpts = {
  locale: Locale;
  preheader?: string;
  heading: string;
  intro: string;
  cta?: EmailCta;
  sections?: EmailSection[];
  closing?: string;
  brand?: string;
  tagline?: string;
  footerNote?: string;
  homeUrl?: string;
};

const BG_PAGE = '#0a0a0a';
const BG_CARD = '#1a1a1a';
const BG_SECTION = '#202020';
const BORDER = '#2a2724';
const TEXT = '#e8e4df';
const TEXT_MUTED = '#8a8580';
const AMBER = '#d4a24e';
const FONT_BODY = "'DM Sans', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif";
const FONT_DISPLAY = "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

function button(cta: EmailCta): string {
  return `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0;">
      <tr>
        <td bgcolor="${AMBER}" style="border-radius:6px; padding:0;">
          <a href="${escapeHtml(cta.url)}" target="_blank"
             style="display:inline-block; padding:12px 28px; font-family:${FONT_DISPLAY}; font-size:14px; font-weight:700; letter-spacing:0.5px; color:#0a0a0a; text-decoration:none; text-transform:uppercase;">
            ${escapeHtml(cta.label)}
          </a>
        </td>
      </tr>
    </table>`;
}

function section(s: EmailSection): string {
  return `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:16px 0;">
      <tr>
        <td bgcolor="${BG_SECTION}" style="padding:20px; border:1px solid ${BORDER}; border-radius:8px;">
          <h3 style="margin:0 0 8px; font-family:${FONT_DISPLAY}; font-size:15px; font-weight:700; color:${AMBER}; letter-spacing:0.3px;">
            ${escapeHtml(s.title)}
          </h3>
          <p style="margin:0 0 ${s.cta ? '14px' : '0'}; font-family:${FONT_BODY}; font-size:14px; line-height:1.6; color:${TEXT};">
            ${escapeHtml(s.body)}
          </p>
          ${s.cta ? `<a href="${escapeHtml(s.cta.url)}" target="_blank" style="display:inline-block; font-family:${FONT_DISPLAY}; font-size:13px; font-weight:700; color:${AMBER}; text-decoration:none; letter-spacing:0.3px;">${escapeHtml(s.cta.label)} →</a>` : ''}
        </td>
      </tr>
    </table>`;
}

export function renderEmailHtml(opts: RenderEmailOpts): string {
  const brand = opts.brand ?? 'PRESET FORGE';
  const tagline = opts.tagline ?? '';
  const homeUrl = opts.homeUrl ?? `https://www.preset-forge.com/${opts.locale}`;
  const preheader = opts.preheader ?? opts.intro.slice(0, 140);

  return `<!DOCTYPE html>
<html lang="${opts.locale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>${escapeHtml(opts.heading)}</title>
</head>
<body style="margin:0; padding:0; background:${BG_PAGE}; font-family:${FONT_BODY};">
  <div style="display:none; overflow:hidden; line-height:1px; opacity:0; max-height:0; max-width:0;">${escapeHtml(preheader)}</div>
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" bgcolor="${BG_PAGE}" style="padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width:600px; width:100%;">
          <tr>
            <td align="center" style="padding:8px 0 24px;">
              <a href="${escapeHtml(homeUrl)}" target="_blank" style="text-decoration:none;">
                <span style="font-family:${FONT_DISPLAY}; font-size:22px; font-weight:700; color:${AMBER}; letter-spacing:3px;">${escapeHtml(brand)}</span>
              </a>
              ${tagline ? `<div style="margin-top:6px; font-family:${FONT_BODY}; font-size:12px; color:${TEXT_MUTED}; letter-spacing:0.5px;">${escapeHtml(tagline)}</div>` : ''}
            </td>
          </tr>
          <tr>
            <td bgcolor="${BG_CARD}" style="padding:32px 28px; border:1px solid ${BORDER}; border-radius:12px;">
              <h1 style="margin:0 0 16px; font-family:${FONT_DISPLAY}; font-size:22px; font-weight:700; color:${TEXT}; line-height:1.3;">
                ${escapeHtml(opts.heading)}
              </h1>
              <p style="margin:0 0 8px; font-family:${FONT_BODY}; font-size:15px; line-height:1.6; color:${TEXT};">
                ${escapeHtml(opts.intro)}
              </p>
              ${opts.cta ? button(opts.cta) : ''}
              ${(opts.sections ?? []).map(section).join('')}
              ${opts.closing ? `<p style="margin:24px 0 0; font-family:${FONT_BODY}; font-size:13px; line-height:1.6; color:${TEXT_MUTED};">${escapeHtml(opts.closing)}</p>` : ''}
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:24px 8px 8px;">
              <p style="margin:0; font-family:${FONT_BODY}; font-size:12px; line-height:1.6; color:${TEXT_MUTED};">
                ${opts.footerNote ? escapeHtml(opts.footerNote) + '<br>' : ''}
                <a href="${escapeHtml(homeUrl)}" target="_blank" style="color:${TEXT_MUTED}; text-decoration:underline;">preset-forge.com</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function renderEmailText(opts: RenderEmailOpts): string {
  const lines: string[] = [];
  lines.push(opts.heading);
  lines.push('');
  lines.push(opts.intro);
  if (opts.cta) {
    lines.push('');
    lines.push(`${opts.cta.label}: ${opts.cta.url}`);
  }
  for (const s of opts.sections ?? []) {
    lines.push('');
    lines.push(`— ${s.title}`);
    lines.push(s.body);
    if (s.cta) lines.push(`${s.cta.label}: ${s.cta.url}`);
  }
  if (opts.closing) {
    lines.push('');
    lines.push(opts.closing);
  }
  return lines.join('\n');
}
