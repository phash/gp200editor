import { describe, it, expect } from 'vitest';
import { ratePresetSchema } from '@/lib/validators';

describe('ratePresetSchema', () => {
  it('accepts score 1–5', () => {
    for (const score of [1, 2, 3, 4, 5]) {
      expect(ratePresetSchema.safeParse({ score }).success).toBe(true);
    }
  });

  it('rejects score 0', () => {
    expect(ratePresetSchema.safeParse({ score: 0 }).success).toBe(false);
  });

  it('rejects score 6', () => {
    expect(ratePresetSchema.safeParse({ score: 6 }).success).toBe(false);
  });

  it('rejects non-integer', () => {
    expect(ratePresetSchema.safeParse({ score: 3.5 }).success).toBe(false);
  });

  it('rejects missing score', () => {
    expect(ratePresetSchema.safeParse({}).success).toBe(false);
  });
});
