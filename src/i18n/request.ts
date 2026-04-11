import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';

type Locale = (typeof routing.locales)[number];

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = (await requestLocale) as Locale | undefined;
  if (!locale || !routing.locales.includes(locale)) {
    locale = routing.defaultLocale;
  }

  // Load the requested locale and always keep en as a fallback source so a
  // missing key in a newly added language falls back to English instead of
  // showing the raw dot-path to end users. In dev we warn so we spot the gap
  // during development; in prod the warning is silenced.
  const messages = (await import(`../../messages/${locale}.json`)).default;
  const enMessages = (await import(`../../messages/en.json`)).default;

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
      const path = namespace ? `${namespace}.${key}` : key;
      const segments = path.split('.');
      let node: unknown = enMessages;
      for (const seg of segments) {
        if (node && typeof node === 'object' && seg in (node as Record<string, unknown>)) {
          node = (node as Record<string, unknown>)[seg];
        } else {
          return path; // ultimate fallback — key is visible so bugs surface
        }
      }
      return typeof node === 'string' ? node : path;
    },
  };
});
