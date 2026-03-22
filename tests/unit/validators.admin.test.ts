import { describe, it, expect } from 'vitest';
import {
  adminPatchUserSchema,
  adminWarnUserSchema,
  adminPatchPresetSchema,
  adminUsersQuerySchema,
  adminPresetsQuerySchema,
  adminErrorsQuerySchema,
} from '@/lib/validators.admin';

describe('adminPatchUserSchema', () => {
  it('accepts suspend action', () => {
    expect(adminPatchUserSchema.safeParse({ suspended: true }).success).toBe(true);
  });
  it('accepts role change', () => {
    expect(adminPatchUserSchema.safeParse({ role: 'ADMIN' }).success).toBe(true);
  });
  it('rejects invalid role', () => {
    expect(adminPatchUserSchema.safeParse({ role: 'SUPERADMIN' }).success).toBe(false);
  });
  it('accepts username edit', () => {
    expect(adminPatchUserSchema.safeParse({ username: 'newname' }).success).toBe(true);
  });
  it('rejects empty username', () => {
    expect(adminPatchUserSchema.safeParse({ username: '' }).success).toBe(false);
  });
});

describe('adminWarnUserSchema', () => {
  it('accepts valid warning', () => {
    const result = adminWarnUserSchema.safeParse({ reason: 'Unangemessener Inhalt', message: 'Please remove the preset.' });
    expect(result.success).toBe(true);
  });
  it('requires reason', () => {
    expect(adminWarnUserSchema.safeParse({ message: 'test' }).success).toBe(false);
  });
  it('allows empty message', () => {
    expect(adminWarnUserSchema.safeParse({ reason: 'Spam' }).success).toBe(true);
  });
});

describe('adminPatchPresetSchema', () => {
  it('accepts flagged toggle', () => {
    expect(adminPatchPresetSchema.safeParse({ flagged: true }).success).toBe(true);
  });
  it('accepts public toggle', () => {
    expect(adminPatchPresetSchema.safeParse({ public: false }).success).toBe(true);
  });
  it('accepts name edit', () => {
    expect(adminPatchPresetSchema.safeParse({ name: 'New Name' }).success).toBe(true);
  });
  it('rejects name longer than 32 chars', () => {
    expect(adminPatchPresetSchema.safeParse({ name: 'x'.repeat(33) }).success).toBe(false);
  });
});

describe('adminUsersQuerySchema', () => {
  it('accepts empty query (defaults)', () => {
    expect(adminUsersQuerySchema.safeParse({}).success).toBe(true);
  });
  it('accepts search query', () => {
    expect(adminUsersQuerySchema.safeParse({ q: 'john' }).success).toBe(true);
  });
});

describe('adminPresetsQuerySchema', () => {
  it('accepts flagged filter', () => {
    expect(adminPresetsQuerySchema.safeParse({ flagged: 'true' }).success).toBe(true);
  });
});

describe('adminErrorsQuerySchema', () => {
  it('accepts level filter', () => {
    expect(adminErrorsQuerySchema.safeParse({ level: 'error' }).success).toBe(true);
  });
  it('rejects invalid level', () => {
    expect(adminErrorsQuerySchema.safeParse({ level: 'debug' }).success).toBe(false);
  });
});
