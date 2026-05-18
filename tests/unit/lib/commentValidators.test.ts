import { describe, it, expect } from 'vitest';
import { commentBodySchema, adminDeleteReasonSchema } from '@/lib/commentValidators';

describe('commentBodySchema', () => {
  it('accepts 1..1000 chars after trim', () => {
    expect(commentBodySchema.parse('hi')).toBe('hi');
    expect(commentBodySchema.parse('  hi  ')).toBe('hi');
    expect(commentBodySchema.parse('x'.repeat(1000))).toHaveLength(1000);
  });
  it('rejects empty after trim', () => {
    expect(() => commentBodySchema.parse('   ')).toThrow();
  });
  it('rejects > 1000 chars', () => {
    expect(() => commentBodySchema.parse('x'.repeat(1001))).toThrow();
  });
});

describe('adminDeleteReasonSchema', () => {
  it('accepts 5..200 chars', () => {
    expect(adminDeleteReasonSchema.parse('spam from user')).toBe('spam from user');
  });
  it('rejects < 5 chars', () => {
    expect(() => adminDeleteReasonSchema.parse('hi')).toThrow();
  });
});
