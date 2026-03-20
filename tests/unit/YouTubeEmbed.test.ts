import { describe, it, expect } from 'vitest';
import { extractYouTubeId } from '@/lib/youtube';

describe('YouTubeEmbed URL handling', () => {
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
