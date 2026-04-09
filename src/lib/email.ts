import nodemailer from 'nodemailer';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

function getTransporter() {
  const host = process.env.MAIL_HOST ?? process.env.EMAIL_SMTP_HOST;
  const port = Number(process.env.MAIL_PORT ?? process.env.EMAIL_SMTP_PORT ?? 1025);
  const user = process.env.MAIL_USERNAME ?? process.env.EMAIL_SMTP_USER;
  const pass = process.env.MAIL_PASSWORD ?? process.env.EMAIL_SMTP_PASS;

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: user ? { user, pass } : undefined,
    tls: { rejectUnauthorized: process.env.NODE_ENV === 'production' },
  });
}

function getFrom(): string {
  return process.env.EMAIL_FROM ?? `noreply@${process.env.MAIL_HOST ?? 'preset-forge.com'}`;
}

export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string,
): Promise<void> {
  await getTransporter().sendMail({
    from: getFrom(),
    to,
    subject: 'Reset your password — Preset Forge',
    html: `
      <p>Click the link below to reset your password. It expires in 1&nbsp;hour.</p>
      <p><a href="${escapeHtml(resetUrl)}">${escapeHtml(resetUrl)}</a></p>
      <p>If you did not request this, you can safely ignore this email.</p>
    `,
  });
}

export async function sendVerificationEmail(
  to: string,
  verifyUrl: string,
): Promise<void> {
  await getTransporter().sendMail({
    from: getFrom(),
    to,
    subject: 'Verify your email — Preset Forge',
    html: `
      <p>Welcome to Preset Forge! Please verify your email address by clicking the link below.</p>
      <p><a href="${escapeHtml(verifyUrl)}">${escapeHtml(verifyUrl)}</a></p>
      <p>This link expires in 24 hours.</p>
      <p>If you did not create an account, you can safely ignore this email.</p>
    `,
  });
}

export async function sendWarningEmail(
  to: string,
  reason: string,
  message?: string,
): Promise<void> {
  await getTransporter().sendMail({
    from: getFrom(),
    to,
    subject: 'Warning — Preset Forge',
    html: `
      <p>You have received a warning from the Preset Forge moderation team.</p>
      <p><strong>Reason:</strong> ${escapeHtml(reason)}</p>
      ${message ? `<p><strong>Details:</strong> ${escapeHtml(message)}</p>` : ''}
      <p>Please review your content and ensure it complies with our community guidelines.
      Continued violations may result in account suspension.</p>
    `,
  });
}
