import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const FIXTURE_PATH = path.join(process.cwd(), 'prst', '63-B American Idiot.prst');

test.describe('library share page SEO', () => {
  let token: string;
  let libraryUserId: string;
  let presetKey: string;

  test.beforeAll(async () => {
    let libraryUser = await prisma.user.findUnique({
      where: { username: 'factory-library' },
      select: { id: true },
    });
    if (!libraryUser) {
      libraryUser = await prisma.user.create({
        data: {
          email: 'factory-library@preset-forge.com',
          username: 'factory-library',
          passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$UNUSABLE$UNUSABLE-factory-library',
          emailVerified: true,
          suspended: false,
          role: 'USER',
        },
        select: { id: true },
      });
    }
    libraryUserId = libraryUser.id;

    const { uploadPreset } = await import('../../src/lib/storage');
    const buffer = fs.readFileSync(FIXTURE_PATH);
    presetKey = `preset-${libraryUserId}-e2e-seo-test.prst`;
    await uploadPreset(presetKey, buffer);

    token = `e2e-seo-${Date.now()}`;
    await prisma.preset.create({
      data: {
        userId: libraryUserId,
        presetKey,
        name: 'E2E Seo Fixture',
        description: 'Seeded for the library-share-seo e2e test.',
        tags: ['e2e'],
        shareToken: token,
        public: true,
        modules: [],
        effects: [],
        sourceUrl: 'https://example.com/e2e',
        sourceLabel: 'e2e fixture',
        contentHash: 'e2e-seo-' + Date.now(),
        ingestedAt: new Date(),
      },
    });
  });

  test.afterAll(async () => {
    await prisma.preset.deleteMany({ where: { shareToken: token } });
    const { deletePreset } = await import('../../src/lib/storage');
    await deletePreset(presetKey).catch(() => {});
    await prisma.$disconnect();
  });

  test('share page has SignalChainSection with an active chain', async ({ page }) => {
    await page.goto(`/en/share/${token}`);
    await expect(page.getByRole('heading', { name: 'Signal Chain', level: 2 })).toBeVisible();

    const ol = page.locator('ol').first();
    await expect(ol).toBeVisible();
    const listItems = ol.locator('li');
    expect(await listItems.count()).toBeGreaterThan(0);
  });

  test('JSON endpoint returns a valid PresetJson document', async ({ request }) => {
    const res = await request.get(`/api/share/${token}/json`);
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('application/json');

    const body = await res.json();
    expect(body.schemaVersion).toBe(1);
    expect(body.signalChain).toHaveLength(11);
    expect(body.raw).toBeDefined();
    expect(body.urls.download).toBe(`/api/share/${token}/download`);
  });

  test('attribution footer is rendered with nofollow', async ({ page }) => {
    await page.goto(`/en/share/${token}`);
    const attribution = page.locator('a[href="https://example.com/e2e"]');
    await expect(attribution).toBeVisible();
    await expect(attribution).toHaveAttribute('rel', /nofollow/);
  });
});
