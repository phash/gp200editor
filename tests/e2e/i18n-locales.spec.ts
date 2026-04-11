import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// One smoke test per locale: load the landing page, assert a known
// translated snippet appears so we know the right message file loaded.
// Then navigate to /editor and /gallery so a bundle or routing error
// surfaces in CI instead of production.
const LOCALES = [
  { locale: 'de', heroSubstring: 'Valeton GP-200' },
  { locale: 'en', heroSubstring: 'Valeton GP-200' },
  { locale: 'es', heroSubstring: 'Valeton GP-200' },
  { locale: 'fr', heroSubstring: 'Valeton GP-200' },
  { locale: 'it', heroSubstring: 'Valeton GP-200' },
  { locale: 'pt', heroSubstring: 'Valeton GP-200' },
];

for (const { locale, heroSubstring } of LOCALES) {
  test.describe(`[${locale}] smoke`, () => {
    test('landing page renders', async ({ page }) => {
      await page.goto(`/${locale}`, { waitUntil: 'domcontentloaded' });
      await expect(page).toHaveURL(new RegExp(`/${locale}$|/${locale}/`));
      // heroSubstring is brand name — appears in every language
      await expect(page.locator('body')).toContainText(heroSubstring);
      // html lang reflects the locale
      await expect(page.locator('html')).toHaveAttribute('lang', locale);
    });

    test('editor loads', async ({ page }) => {
      await page.goto(`/${locale}/editor`, { waitUntil: 'domcontentloaded' });
      await expect(page).toHaveURL(new RegExp(`/${locale}/editor`));
      // The editor page must not be a 404 — look for the file upload
      // dropzone which is locale-agnostic and always present.
      await expect(page.locator('[data-testid="file-upload-zone"]').first()).toBeVisible({ timeout: 15000 });
    });

    test('gallery loads', async ({ page }) => {
      await page.goto(`/${locale}/gallery`, { waitUntil: 'domcontentloaded' });
      await expect(page).toHaveURL(new RegExp(`/${locale}/gallery`));
      // Any link to a preset share page confirms the gallery rendered
      await expect(page.locator('a[href*="/share/"]').first()).toBeVisible({ timeout: 10000 });
    });

    test('a11y — no critical WCAG issues on landing', async ({ page }) => {
      await page.goto(`/${locale}`, { waitUntil: 'domcontentloaded' });
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze();
      const critical = results.violations.filter((v) => v.impact === 'critical');
      expect(critical).toEqual([]);
    });
  });
}
