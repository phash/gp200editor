import { test, expect } from '@playwright/test';

test.describe('Featured Preset Block on Homepage', () => {
  /**
   * The FeaturedPresetBlock renders only when pickFeaturedPreset() returns a result.
   * In a fresh test DB there may be no featured preset, so both presence and absence
   * are valid outcomes. What we assert unconditionally:
   *   - The homepage responds with a non-5xx status
   *   - No JS runtime errors on the page
   *
   * If the featured block IS present (amber-bordered section with the "★ Featured" title),
   * we additionally verify that the "Open preset →" CTA link renders.
   */
  test('homepage loads without errors and featured block renders cleanly when present', async ({ page }) => {
    const jsErrors: string[] = [];
    page.on('pageerror', (err) => jsErrors.push(err.message));

    const response = await page.goto('/en', { waitUntil: 'domcontentloaded', timeout: 15000 });
    expect(response?.status()).toBeLessThan(500);

    // i18n key home.featured.title = "Featured · Top Rated · 30 Days"
    // The FeaturedPresetBlock renders:  ★ {t('title')}
    const featuredTitle = page.getByText(/Featured.*Top Rated.*30 Days/i).first();
    const isFeaturedVisible = await featuredTitle.isVisible().catch(() => false);

    if (isFeaturedVisible) {
      // When a featured preset exists, the "Open preset →" link must be present.
      // i18n key home.featured.openPreset = "Open preset →"
      await expect(
        page.getByRole('link', { name: /Open preset/i }),
      ).toBeVisible({ timeout: 5000 });

      // The link must point to a /share/<token> URL
      const href = await page.getByRole('link', { name: /Open preset/i }).getAttribute('href');
      expect(href).toMatch(/\/share\//);
    }
    // If not visible, the component correctly returned null — that is fine.

    expect(jsErrors).toEqual([]);
  });
});
