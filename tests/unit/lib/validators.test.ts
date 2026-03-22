import { describe, it, expect } from 'vitest';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  patchProfileSchema,
} from '@/lib/validators';

describe('registerSchema', () => {
  it('accepts valid input', () => {
    const result = registerSchema.safeParse({ email: 'a@b.com', username: 'alice_01', password: 'secret12' });
    expect(result.success).toBe(true);
  });
  it('rejects invalid email', () => {
    expect(registerSchema.safeParse({ email: 'notanemail', username: 'alice', password: 'secret12' }).success).toBe(false);
  });
  it('rejects username shorter than 3 chars', () => {
    expect(registerSchema.safeParse({ email: 'a@b.com', username: 'ab', password: 'secret12' }).success).toBe(false);
  });
  it('rejects username with special chars', () => {
    expect(registerSchema.safeParse({ email: 'a@b.com', username: 'alice!', password: 'secret12' }).success).toBe(false);
  });
  it('rejects password shorter than 8 chars', () => {
    expect(registerSchema.safeParse({ email: 'a@b.com', username: 'alice', password: 'short' }).success).toBe(false);
  });
  it('rejects username longer than 30 chars', () => {
    expect(registerSchema.safeParse({ email: 'a@b.com', username: 'a'.repeat(31), password: 'secret12' }).success).toBe(false);
  });
});

describe('loginSchema', () => {
  it('accepts email login', () => {
    expect(loginSchema.safeParse({ login: 'a@b.com', password: 'x' }).success).toBe(true);
  });
  it('accepts username login', () => {
    expect(loginSchema.safeParse({ login: 'myuser', password: 'x' }).success).toBe(true);
  });
  it('rejects empty login', () => {
    expect(loginSchema.safeParse({ login: '', password: 'pass' }).success).toBe(false);
  });
  it('rejects empty password', () => {
    expect(loginSchema.safeParse({ login: 'a@b.com', password: '' }).success).toBe(false);
  });
});

describe('forgotPasswordSchema', () => {
  it('accepts valid email', () => {
    expect(forgotPasswordSchema.safeParse({ email: 'a@b.com' }).success).toBe(true);
  });
  it('rejects non-email', () => {
    expect(forgotPasswordSchema.safeParse({ email: 'notvalid' }).success).toBe(false);
  });
});

describe('resetPasswordSchema', () => {
  it('accepts valid input', () => {
    expect(resetPasswordSchema.safeParse({ token: 'abc', newPassword: 'newpass1' }).success).toBe(true);
  });
  it('rejects empty token', () => {
    expect(resetPasswordSchema.safeParse({ token: '', newPassword: 'newpass1' }).success).toBe(false);
  });
  it('rejects short password', () => {
    expect(resetPasswordSchema.safeParse({ token: 'abc', newPassword: 'short' }).success).toBe(false);
  });
});

describe('patchProfileSchema', () => {
  it('accepts all nullish', () => {
    expect(patchProfileSchema.safeParse({}).success).toBe(true);
  });
  it('accepts bio and website', () => {
    expect(patchProfileSchema.safeParse({ bio: 'Hello', website: 'https://example.com' }).success).toBe(true);
  });
  it('accepts null values (field clear)', () => {
    expect(patchProfileSchema.safeParse({ bio: null, website: null }).success).toBe(true);
  });
  it('rejects bio longer than 500 chars', () => {
    expect(patchProfileSchema.safeParse({ bio: 'x'.repeat(501) }).success).toBe(false);
  });
  it('accepts website without protocol (auto-prepends https://)', () => {
    const result = patchProfileSchema.safeParse({ website: 'www.phash.de' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.website).toBe('https://www.phash.de');
    }
  });
  it('rejects website longer than 200 chars', () => {
    expect(patchProfileSchema.safeParse({ website: 'x'.repeat(201) }).success).toBe(false);
  });
  it('preserves null for bio (does not coerce to undefined)', () => {
    const result = patchProfileSchema.safeParse({ bio: null });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.bio).toBeNull();
  });
});
