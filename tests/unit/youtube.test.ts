import { describe, it, expect } from 'vitest';
import { extractYouTubeId } from '@/lib/youtube';

describe('extractYouTubeId', () => {
  it('extracts from watch URL', () => {
    expect(extractYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('extracts from short URL', () => {
    expect(extractYouTubeId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('extracts from embed URL', () => {
    expect(extractYouTubeId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('extracts with extra params', () => {
    expect(extractYouTubeId('https://youtube.com/watch?v=abc123&t=42')).toBe('abc123');
  });

  it('returns null for invalid URL', () => {
    expect(extractYouTubeId('https://example.com')).toBeNull();
    expect(extractYouTubeId('')).toBeNull();
    expect(extractYouTubeId('not a url')).toBeNull();
  });

  it('handles URL without protocol', () => {
    expect(extractYouTubeId('youtube.com/watch?v=abc123')).toBe('abc123');
  });

  it('handles music.youtube.com URLs', () => {
    expect(extractYouTubeId('https://music.youtube.com/watch?v=abc123')).toBe('abc123');
  });

  it('handles URL with timestamp', () => {
    expect(extractYouTubeId('https://youtu.be/abc123?t=120')).toBe('abc123');
  });

  it('handles URL with playlist param', () => {
    expect(extractYouTubeId('https://youtube.com/watch?v=abc123&list=PLxyz')).toBe('abc123');
  });
});
