import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LOCALES } from '@/i18n/locales';
import enMessages from '../../messages/en.json';

// Mock nodemailer BEFORE importing the module under test
const sendMail = vi.fn().mockResolvedValue({});
vi.mock('nodemailer', () => ({
  default: {
    createTransport: () => ({ sendMail }),
  },
}));

import { sendVerifyReminderEmail } from '@/lib/email';

describe('sendVerifyReminderEmail', () => {
  beforeEach(() => {
    sendMail.mockClear();
  });

  for (const day of [2, 7] as const) {
    for (const locale of LOCALES) {
      it(`day=${day} renders for ${locale} with verify URL and locale-specific subject`, async () => {
        await sendVerifyReminderEmail(
          'test@example.com',
          'https://preset-forge.com/en/auth/verify-email?token=abc',
          locale,
          day,
        );
        expect(sendMail).toHaveBeenCalledTimes(1);
        const call = sendMail.mock.calls[0]![0];
        expect(call.to).toBe('test@example.com');
        expect(call.subject).toBeTruthy();
        expect(call.subject.length).toBeGreaterThan(5);
        expect(call.html).toContain('https://preset-forge.com/en/auth/verify-email?token=abc');
        expect(call.html).toContain('PRESET FORGE');
        expect(call.text).toBeTruthy();
        expect(call.text).toContain('https://preset-forge.com/en/auth/verify-email?token=abc');
      });
    }
  }

  it('D2 and D7 produce different subjects for the same locale', async () => {
    await sendVerifyReminderEmail('a@b.de', 'https://x', 'en', 2);
    const subjectD2 = sendMail.mock.calls[0]![0].subject;
    sendMail.mockClear();
    await sendVerifyReminderEmail('a@b.de', 'https://x', 'en', 7);
    const subjectD7 = sendMail.mock.calls[0]![0].subject;
    expect(subjectD2).not.toBe(subjectD7);
  });

  it('throws on invalid day', async () => {
    await expect(
      // @ts-expect-error testing runtime guard
      sendVerifyReminderEmail('a@b.de', 'https://x', 'en', 3),
    ).rejects.toThrow(/day/);
  });

  it('falls back to en for unsupported locale', async () => {
    await sendVerifyReminderEmail('a@b.de', 'https://x', 'zh-CN', 2);
    const call = sendMail.mock.calls[0]![0];
    // English D2 subject should be used
    expect(call.subject).toBe(enMessages.email.verifyReminderD2.subject);
  });
});
