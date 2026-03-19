import { describe, it, expect } from 'vitest';
import { uploadPresetSchema, patchPresetSchema } from '@/lib/validators';

describe('uploadPresetSchema', () => {
  it('accepts empty object (all fields optional)', () => {
    expect(uploadPresetSchema.safeParse({}).success).toBe(true);
  });

  it('accepts valid description and tags', () => {
    const result = uploadPresetSchema.safeParse({
      description: 'Great preset for rock',
      tags: ['rock', 'distortion', 'high gain'],
    });
    expect(result.success).toBe(true);
  });

  it('rejects description longer than 500 chars', () => {
    const result = uploadPresetSchema.safeParse({ description: 'x'.repeat(501) });
    expect(result.success).toBe(false);
  });

  it('rejects more than 10 tags', () => {
    const result = uploadPresetSchema.safeParse({
      tags: Array.from({ length: 11 }, (_, i) => `tag${i}`),
    });
    expect(result.success).toBe(false);
  });

  it('rejects tag longer than 30 chars', () => {
    const result = uploadPresetSchema.safeParse({
      tags: ['a'.repeat(31)],
    });
    expect(result.success).toBe(false);
  });

  it('rejects tag with invalid characters', () => {
    const result = uploadPresetSchema.safeParse({
      tags: ['invalid!tag'],
    });
    expect(result.success).toBe(false);
  });

  it('accepts tags with letters, numbers, spaces and hyphens', () => {
    const result = uploadPresetSchema.safeParse({
      tags: ['Hi-Gain', 'rock 80s', 'distortion2'],
    });
    expect(result.success).toBe(true);
  });

  it('accepts author, style and publish fields', () => {
    const result = uploadPresetSchema.safeParse({
      author: 'Manuel R',
      style: 'Rock',
      publish: true,
    });
    expect(result.success).toBe(true);
  });

  it('rejects author longer than 50 chars', () => {
    const result = uploadPresetSchema.safeParse({ author: 'x'.repeat(51) });
    expect(result.success).toBe(false);
  });

  it('rejects style longer than 50 chars', () => {
    const result = uploadPresetSchema.safeParse({ style: 'x'.repeat(51) });
    expect(result.success).toBe(false);
  });
});

describe('patchPresetSchema', () => {
  it('accepts empty object (all fields optional)', () => {
    expect(patchPresetSchema.safeParse({}).success).toBe(true);
  });

  it('accepts valid name, description and tags', () => {
    const result = patchPresetSchema.safeParse({
      name: 'My Preset',
      description: 'Updated description',
      tags: ['blues'],
    });
    expect(result.success).toBe(true);
  });

  it('rejects name with 0 chars', () => {
    const result = patchPresetSchema.safeParse({ name: '' });
    expect(result.success).toBe(false);
  });

  it('rejects name longer than 32 chars', () => {
    const result = patchPresetSchema.safeParse({ name: 'x'.repeat(33) });
    expect(result.success).toBe(false);
  });

  it('accepts null description (clears the field)', () => {
    const result = patchPresetSchema.safeParse({ description: null });
    expect(result.success).toBe(true);
  });

  it('rejects description longer than 500 chars', () => {
    const result = patchPresetSchema.safeParse({ description: 'x'.repeat(501) });
    expect(result.success).toBe(false);
  });

  it('rejects more than 10 tags', () => {
    const result = patchPresetSchema.safeParse({
      tags: Array.from({ length: 11 }, (_, i) => `tag${i}`),
    });
    expect(result.success).toBe(false);
  });

  it('rejects tag longer than 30 chars', () => {
    const result = patchPresetSchema.safeParse({
      tags: ['a'.repeat(31)],
    });
    expect(result.success).toBe(false);
  });

  it('rejects tag with invalid characters', () => {
    const result = patchPresetSchema.safeParse({
      tags: ['invalid!tag'],
    });
    expect(result.success).toBe(false);
  });

  it('accepts tags with letters, numbers, spaces and hyphens', () => {
    const result = patchPresetSchema.safeParse({
      tags: ['Hi-Gain', 'rock 80s', 'distortion2'],
    });
    expect(result.success).toBe(true);
  });

  it('rejects null tags (use undefined/omit to leave tags unchanged)', () => {
    const result = patchPresetSchema.safeParse({ tags: null });
    expect(result.success).toBe(false);
  });
});
