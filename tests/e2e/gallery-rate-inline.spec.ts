import { test, expect } from '@playwright/test';

test.describe('Gallery inline rating (RateableGuitarRating)', () => {
  /**
   * Anonymous users cannot rate presets. When they click a guitar icon in the
   * gallery card, the RateableGuitarRating component shows a tooltip with the
   * i18n text gallery.rate.signInTooltip = "Sign in to rate".
   *
   * The GuitarRating component renders each guitar as a <button> element when
   * `onRate` is provided. In the gallery, `canRate` is false for anonymous
   * visitors, but the GuitarRating buttons are still rendered (clicking them
   * triggers the tooltip path in RateableGuitarRating.handleRate).
   *
   * If the gallery has no presets, the test self-skips gracefully.
   */
  test('anon user sees "Sign in to rate" tooltip on guitar click', async ({ page }) => {
    await page.goto('/en/gallery', { waitUntil: 'domcontentloaded' });

    // Gallery preset cards are rendered as grid children.
    // The GuitarRating component renders buttons with aria-label "filled guitar"
    // or "empty guitar" (from GuitarRating.tsx). In gallery cards, onRate is
    // always provided (pointing to RateableGuitarRating.handleRate), so buttons
    // are rendered regardless of canRate.
    const guitarButtons = page.locator(
      'button[aria-label="filled guitar"], button[aria-label="empty guitar"]',
    );
    const count = await guitarButtons.count();

    if (count === 0) {
      // No presets with ratings in the gallery — the GuitarRating component
      // is only rendered when ratingCount > 0 in GalleryClient.
      // Self-skip: this is not a failure; a seeded DB will exercise this path.
      test.skip(true, 'No rated presets in gallery — skipping inline-rating tooltip test');
      return;
    }

    await guitarButtons.first().click();

    // After clicking, the tooltip <span role="tooltip"> should appear with text
    // matching gallery.rate.signInTooltip = "Sign in to rate"
    await expect(
      page.locator('[role="tooltip"]', { hasText: /Sign in to rate/i }),
    ).toBeVisible({ timeout: 3000 });
  });
});
