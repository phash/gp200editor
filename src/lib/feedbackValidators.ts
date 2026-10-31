import { z } from 'zod';
import { LOCALES, type Locale } from '@/i18n/locales';

export const FEEDBACK_CATEGORIES = ['BUG', 'IDEA', 'GENERAL'] as const;
export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];

export const FEEDBACK_STATUSES = ['NEW', 'READ', 'DONE'] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

export const FEEDBACK_MIN = 10;
export const FEEDBACK_MAX = 2000;
export const USER_AGENT_MAX = 400;

// Only same-origin paths ("/editor", "/de/gallery") — never absolute URLs,
// so the admin view can't be fed external links.
const PAGE_PATH = /^\/[A-Za-z0-9\-._~/%?=&]{0,299}$/;

export const feedbackSchema = z.object({
  category: z.enum(FEEDBACK_CATEGORIES),
  message: z
    .string()
    .trim()
    .min(FEEDBACK_MIN, `Message must be at least ${FEEDBACK_MIN} characters`)
    .max(FEEDBACK_MAX, `Message exceeds ${FEEDBACK_MAX} character limit`),
  pagePath: z
    .string()
    .optional()
    .nullable()
    .transform((v) => (v && PAGE_PATH.test(v) && !v.startsWith('//') ? v : null)),
  locale: z
    .string()
    .optional()
    .transform((v): Locale => ((LOCALES as readonly string[]).includes(v ?? '') ? (v as Locale) : 'en')),
  // Honeypot — hidden in the form. Humans leave it empty.
  company_url: z.string().optional(),
});

export const feedbackStatusSchema = z.object({ status: z.enum(FEEDBACK_STATUSES) });
