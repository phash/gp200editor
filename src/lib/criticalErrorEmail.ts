import nodemailer from 'nodemailer';

// Plain-text critical-error mail to ADMIN_EMAIL. Intentionally bypasses the
// localized template stack used for user-facing mail: this goes to one person
// (the operator), needs to be parseable at 3am, and must not block on i18n.
//
// Shares SMTP config with src/lib/email.ts but uses its own transporter so the
// admin-alert path stays independent of any nodemailer pool issues in the user
// mail path.

type CachedTransporter = ReturnType<typeof nodemailer.createTransport>;
let _transporter: CachedTransporter | null = null;

function getTransporter(): CachedTransporter {
  if (_transporter) return _transporter;
  const host = process.env.MAIL_HOST ?? process.env.EMAIL_SMTP_HOST;
  const port = Number(process.env.MAIL_PORT ?? process.env.EMAIL_SMTP_PORT ?? 1025);
  const user = process.env.MAIL_USERNAME ?? process.env.EMAIL_SMTP_USER;
  const pass = process.env.MAIL_PASSWORD ?? process.env.EMAIL_SMTP_PASS;

  _transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: user ? { user, pass } : undefined,
    tls: { rejectUnauthorized: process.env.NODE_ENV === 'production' },
    connectionTimeout: 10_000,
    greetingTimeout: 5_000,
    socketTimeout: 15_000,
  }) as unknown as CachedTransporter;
  return _transporter;
}

function from(): string {
  return process.env.EMAIL_FROM ?? `noreply@${process.env.MAIL_HOST ?? 'preset-forge.com'}`;
}

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.preset-forge.com';
}

export interface CriticalErrorPayload {
  id: string;
  fingerprint: string;
  severity: string;
  category: string;
  message: string;
  stack?: string;
  route?: string;
  method?: string;
  count: number;
}

const STACK_MAX = 1500;

export async function sendCriticalErrorEmail(p: CriticalErrorPayload): Promise<void> {
  const to = process.env.ADMIN_EMAIL;
  if (!to) {
    // No recipient configured → silent no-op. The logger still records the
    // error to the DB; we just can't alert anyone via mail in this deployment.
    return;
  }

  const shortFp = p.fingerprint.slice(0, 8);
  const stack = (p.stack ?? '').slice(0, STACK_MAX);
  const occurrence = p.count === 1 ? 'first occurrence' : `${p.count}-th occurrence`;
  const link = `${appUrl()}/admin?tab=errors&fingerprint=${p.fingerprint}`;

  const subject = `[Preset Forge ${p.severity.toUpperCase()}] ${p.category}: ${p.message.slice(0, 80)}`;
  const text = [
    `Severity: ${p.severity}`,
    `Category: ${p.category}`,
    `Fingerprint: ${shortFp} (${occurrence})`,
    p.route ? `Route: ${p.method ?? ''} ${p.route}`.trim() : null,
    '',
    'Message:',
    p.message,
    '',
    stack ? 'Stack (truncated):' : null,
    stack || null,
    '',
    `Admin link: ${link}`,
  ]
    .filter((line) => line !== null)
    .join('\n');

  await getTransporter().sendMail({ from: from(), to, subject, text });
}
