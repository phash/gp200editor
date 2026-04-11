import type { IngestSource, PresetCandidate } from '../types';

const GITHUB_API = 'https://api.github.com';
const UA = 'PresetForge-Ingest/1.0 (+https://preset-forge.com)';

/**
 * Uses GitHub Code Search to find .prst files related to the GP-200.
 * Requires a GITHUB_TOKEN env var for the authenticated rate limit.
 * Stop condition: 100 hits or 5 minutes of wall clock, whichever comes first.
 */
export function githubSource(): IngestSource {
  return {
    id: 'github',
    description: 'GitHub Code Search for extension:prst + gp200',
    async *fetch(): AsyncIterable<PresetCandidate> {
      const token = process.env.GITHUB_TOKEN;
      if (!token) {
        console.warn('github: no GITHUB_TOKEN set, rate limit will be low');
      }
      const headers: Record<string, string> = {
        'User-Agent': UA,
        Accept: 'application/vnd.github+json',
      };
      if (token) headers.Authorization = `Bearer ${token}`;

      const deadline = Date.now() + 5 * 60 * 1000;
      let seen = 0;

      for (let page = 1; page <= 5 && seen < 100; page++) {
        if (Date.now() > deadline) break;
        const url = `${GITHUB_API}/search/code?q=extension:prst+gp200&per_page=20&page=${page}`;
        const res = await fetch(url, { headers });
        if (!res.ok) {
          console.warn(`github: search failed with HTTP ${res.status}`);
          break;
        }
        const data = (await res.json()) as {
          items?: Array<{
            html_url: string;
            repository: { full_name: string; default_branch: string };
            path: string;
          }>;
        };
        if (!data.items || data.items.length === 0) break;

        for (const item of data.items) {
          if (Date.now() > deadline || seen >= 100) break;
          const rawUrl = `https://raw.githubusercontent.com/${item.repository.full_name}/${item.repository.default_branch}/${item.path}`;
          try {
            const fileRes = await fetch(rawUrl, { headers: { 'User-Agent': UA } });
            if (!fileRes.ok) {
              console.warn(`github: ${rawUrl} -> HTTP ${fileRes.status}`);
              continue;
            }
            const buffer = Buffer.from(await fileRes.arrayBuffer());
            yield {
              buffer,
              sourceUrl: item.html_url,
              sourceLabel: `github.com/${item.repository.full_name}`,
              suggestedName: item.path.split('/').pop()?.replace(/\.prst$/i, ''),
            };
            seen++;
          } catch (err) {
            console.warn(`github: ${rawUrl} failed: ${err instanceof Error ? err.message : err}`);
          }
        }
      }
    },
  };
}
