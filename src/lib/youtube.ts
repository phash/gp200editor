export function extractYouTubeId(url: string): string | null {
  if (!url) return null;

  const normalized = url.includes('://') ? url : `https://${url}`;

  try {
    const parsed = new URL(normalized);

    // youtu.be/VIDEO_ID
    if (parsed.hostname === 'youtu.be') {
      const id = parsed.pathname.slice(1);
      return id || null;
    }

    // youtube.com/watch?v=VIDEO_ID  (also music.youtube.com)
    if (parsed.hostname.includes('youtube.com')) {
      const v = parsed.searchParams.get('v');
      if (v) return v;

      // youtube.com/embed/VIDEO_ID
      const embedMatch = parsed.pathname.match(/^\/embed\/([^/]+)/);
      if (embedMatch) return embedMatch[1];
    }
  } catch {
    return null;
  }

  return null;
}
