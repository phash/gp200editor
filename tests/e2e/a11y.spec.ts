import { test, expect } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';

test.describe('A11y: Home Page', () => {
  test('hat keine kritischen Accessibility-Verstöße', async ({ page }) => {
    await page.goto('/de');
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    expect(results.violations).toHaveLength(0);
  });
});

test.describe('A11y: Editor Page', () => {
  test('hat keine kritischen Accessibility-Verstöße', async ({ page }) => {
    await page.goto('/de/editor');
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    expect(results.violations).toHaveLength(0);
  });
});
