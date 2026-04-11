import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';
import type { Locale } from './locales';

// Hoist the English messages import to module scope so we don't re-await
// the same JSON on every request. Node's module cache would serve it
// immediately on repeat calls, but the promise plumbing per request is
// still pointless overhead. Resolved once at first use.
const enMessagesPromise = import('../../messages/en.json').then((m) => m.default);

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = (await requestLocale) as Locale | undefined;
  if (!locale || !(routing.locales as readonly string[]).includes(locale)) {
    locale = routing.defaultLocale;
  }

  // Load the requested locale. Always keep en as a fallback source so a
  // missing key in a newly added language falls back to English instead of
  // showing the raw dot-path to end users. In dev we warn so we spot the gap
  // during development; in prod the warning is silenced.
  const messages = (await import(`../../messages/${locale}.json`)).default;
  const enMessages = await enMessagesPromise;

  return {
    locale,
    messages,
    onError(error) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`[i18n] ${error.code}: ${error.message}`);
      }
    },
    getMessageFallback({ namespace, key }) {
      // Walk the nested en messages using the dot-path that next-intl gives
      // us. Returns the string when found, or the dot-path as a last resort.
      // Use hasOwnProperty.call so a key like "__proto__" or "constructor"
      // can't step into Object.prototype methods.
      const path = namespace ? `${namespace}.${key}` : key;
      const segments = path.split('.');
      let node: unknown = enMessages;
      for (const seg of segments) {
        if (
          node &&
          typeof node === 'object' &&
          Object.prototype.hasOwnProperty.call(node, seg)
        ) {
          node = (node as Record<string, unknown>)[seg];
        } else {
          return path; // ultimate fallback — key is visible so bugs surface
        }
      }
      return typeof node === 'string' ? node : path;
    },
  };
});
