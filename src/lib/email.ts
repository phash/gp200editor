import nodemailer from 'nodemailer';
import { LOCALES, type Locale } from '@/i18n/locales';
import { renderEmailHtml, renderEmailText, type EmailSection } from './emailTemplate';
import de from '../../messages/de.json';
import en from '../../messages/en.json';
import es from '../../messages/es.json';
import fr from '../../messages/fr.json';
import it from '../../messages/it.json';
import pt from '../../messages/pt.json';

type EmailMessages = (typeof en)['email'];

const MESSAGES: Record<Locale, EmailMessages> = {
  de: (de as unknown as typeof en).email,
  en: en.email,
  es: (es as unknown as typeof en).email,
  fr: (fr as unknown as typeof en).email,
  it: (it as unknown as typeof en).email,
  pt: (pt as unknown as typeof en).email,
};

function normalizeLocale(locale: Locale | string | undefined | null): Locale {
  if (typeof locale === 'string' && (LOCALES as readonly string[]).includes(locale)) {
    return locale as Locale;
  }
  return 'en';
}

// Module-scope cached transporter. Caching across requests is important for
// the cron route's 200-user sequential batch — without it, every send would
// re-handshake SMTP. Timeouts ensure a hung mailserver can't wedge the loop.
type CachedTransporter = ReturnType<typeof nodemailer.createTransport>;
let _transporter: CachedTransporter | null = null;

function getTransporter(): CachedTransporter {
  if (_transporter) return _transporter;
  const host = process.env.MAIL_HOST ?? process.env.EMAIL_SMTP_HOST;
  const port = Number(process.env.MAIL_PORT ?? process.env.EMAIL_SMTP_PORT ?? 1025);
  const user = process.env.MAIL_USERNAME ?? process.env.EMAIL_SMTP_USER;
  const pass = process.env.MAIL_PASSWORD ?? process.env.EMAIL_SMTP_PASS;

  // Cast the pool-transporter to the non-pool Transporter shape we cache.
  // The two share the sendMail surface we use; the pool variant adds a
  // `pending` accessor that we don't need but TS picks up on.
  _transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: user ? { user, pass } : undefined,
    tls: { rejectUnauthorized: process.env.NODE_ENV === 'production' },
    pool: true,
    maxConnections: 3,
    connectionTimeout: 10_000,
    greetingTimeout: 5_000,
    socketTimeout: 15_000,
  }) as unknown as CachedTransporter;
  return _transporter;
}

function getFrom(): string {
  return process.env.EMAIL_FROM ?? `noreply@${process.env.MAIL_HOST ?? 'preset-forge.com'}`;
}

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.preset-forge.com';
}

export async function sendVerificationEmail(
  to: string,
  verifyUrl: string,
  locale: Locale | string = 'en',
): Promise<void> {
  const lc = normalizeLocale(locale);
  const m = MESSAGES[lc];
  const opts = {
    locale: lc,
    preheader: m.verify.preheader,
    heading: m.verify.heading,
    intro: m.verify.intro,
    cta: { label: m.verify.ctaLabel, url: verifyUrl },
    closing: m.verify.closing,
    brand: m.brand,
    tagline: m.tagline,
    footerNote: m.footerNote,
    homeUrl: `${appUrl()}/${lc}`,
  };
  await getTransporter().sendMail({
    from: getFrom(),
    to,
    subject: m.verify.subject,
    html: renderEmailHtml(opts),
    text: renderEmailText(opts),
  });
}

export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string,
  locale: Locale | string = 'en',
): Promise<void> {
  const lc = normalizeLocale(locale);
  const m = MESSAGES[lc];
  const opts = {
    locale: lc,
    preheader: m.reset.preheader,
    heading: m.reset.heading,
    intro: m.reset.intro,
    cta: { label: m.reset.ctaLabel, url: resetUrl },
    closing: m.reset.closing,
    brand: m.brand,
    tagline: m.tagline,
    footerNote: m.footerNote,
    homeUrl: `${appUrl()}/${lc}`,
  };
  await getTransporter().sendMail({
    from: getFrom(),
    to,
    subject: m.reset.subject,
    html: renderEmailHtml(opts),
    text: renderEmailText(opts),
  });
}

export async function sendWarningEmail(
  to: string,
  reason: string,
  message?: string,
  locale: Locale | string = 'en',
): Promise<void> {
  const lc = normalizeLocale(locale);
  const m = MESSAGES[lc];
  const sections: EmailSection[] = [
    { title: m.warning.reasonLabel, body: reason },
  ];
  if (message) sections.push({ title: m.warning.detailsLabel, body: message });
  const opts = {
    locale: lc,
    preheader: m.warning.preheader,
    heading: m.warning.heading,
    intro: m.warning.intro,
    sections,
    closing: m.warning.closing,
    brand: m.brand,
    tagline: m.tagline,
    footerNote: m.footerNote,
    homeUrl: `${appUrl()}/${lc}`,
  };
  await getTransporter().sendMail({
    from: getFrom(),
    to,
    subject: m.warning.subject,
    html: renderEmailHtml(opts),
    text: renderEmailText(opts),
  });
}

export async function sendWelcomeEmail(
  to: string,
  username: string,
  locale: Locale | string = 'en',
): Promise<void> {
  const lc = normalizeLocale(locale);
  const m = MESSAGES[lc];
  const base = `${appUrl()}/${lc}`;
  const sections: EmailSection[] = [
    {
      title: m.welcome.stepUpload.title,
      body: m.welcome.stepUpload.body,
      cta: { label: m.welcome.stepUpload.ctaLabel, url: `${base}/presets` },
    },
    {
      title: m.welcome.stepEditor.title,
      body: m.welcome.stepEditor.body,
      cta: { label: m.welcome.stepEditor.ctaLabel, url: `${base}/editor` },
    },
    {
      title: m.welcome.stepGallery.title,
      body: m.welcome.stepGallery.body,
      cta: { label: m.welcome.stepGallery.ctaLabel, url: `${base}/gallery` },
    },
    {
      title: m.welcome.stepProfile.title,
      body: m.welcome.stepProfile.body,
      cta: { label: m.welcome.stepProfile.ctaLabel, url: `${base}/profile` },
    },
  ];
  const heading = m.welcome.heading.replace('{username}', username);
  const opts = {
    locale: lc,
    preheader: m.welcome.preheader,
    heading,
    intro: m.welcome.intro,
    sections,
    closing: m.welcome.closing,
    brand: m.brand,
    tagline: m.tagline,
    footerNote: m.footerNote,
    homeUrl: base,
  };
  await getTransporter().sendMail({
    from: getFrom(),
    to,
    subject: m.welcome.subject,
    html: renderEmailHtml(opts),
    text: renderEmailText(opts),
  });
}

export async function sendVerifyReminderEmail(
  to: string,
  verifyUrl: string,
  locale: Locale | string = 'en',
  day: 2 | 7,
): Promise<void> {
  if (day !== 2 && day !== 7) {
    throw new Error(`sendVerifyReminderEmail: unsupported day ${day}`);
  }
  const lc = normalizeLocale(locale);
  const m = MESSAGES[lc];
  const r = day === 2 ? m.verifyReminderD2 : m.verifyReminderD7;
  const opts = {
    locale: lc,
    preheader: r.preheader,
    heading: r.heading,
    intro: r.intro,
    cta: { label: r.ctaLabel, url: verifyUrl },
    closing: r.closing,
    brand: m.brand,
    tagline: m.tagline,
    footerNote: m.footerNote,
    homeUrl: `${appUrl()}/${lc}`,
  };
  await getTransporter().sendMail({
    from: getFrom(),
    to,
    subject: r.subject,
    html: renderEmailHtml(opts),
    text: renderEmailText(opts),
  });
}
