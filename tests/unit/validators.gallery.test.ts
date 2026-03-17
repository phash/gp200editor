import { describe, it, expect } from 'vitest';
import { galleryQuerySchema } from '@/lib/validators';

describe('galleryQuerySchema', () => {
  it('accepts empty query', () => {
    expect(galleryQuerySchema.safeParse({}).success).toBe(true);
  });

  it('accepts valid params', () => {
    const result = galleryQuerySchema.safeParse({
      q: 'rock',
      modules: 'DST,AMP',
      sort: 'popular',
      page: '2',
      limit: '12',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.modules).toEqual(['DST', 'AMP']);
      expect(result.data.page).toBe(2);
    }
  });

  it('defaults sort to newest', () => {
    const result = galleryQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sort).toBe('newest');
      expect(result.data.page).toBe(1);
      expect(result.data.limit).toBe(20);
    }
  });

  it('rejects invalid sort', () => {
    expect(galleryQuerySchema.safeParse({ sort: 'random' }).success).toBe(false);
  });

  it('clamps limit to max 50', () => {
    const result = galleryQuerySchema.safeParse({ limit: '100' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.limit).toBe(50);
  });
});
