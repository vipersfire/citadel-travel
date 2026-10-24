import { previewReady } from './preview-ready.js';
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
const base = process.env.CITADEL_PREVIEW_URL || 'http://localhost:3000';
const screenshotDirectory = resolve(import.meta.dirname, '../.data/design-review');
await mkdir(screenshotDirectory, { recursive: true });
await previewReady(base);
const browser = await chromium.launch({
  ...(process.platform === 'darwin'
    ? { executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' }
    : {}),
});
const page = await browser.newPage();
const errors: string[] = [];
page.on('pageerror', (e) => errors.push(e.message));
const waitForVisualStable = async () =>
  page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      document.documentElement
        .getAnimations({ subtree: true })
        .map((animation) => animation.finished),
    );
  });
try {
  for (const width of [320, 375, 768, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of [
      '/id',
      '/en',
      '/en/sport',
      '/id/sport/football',
      '/en/sport/running',
      '/en/beyond-the-event',
      '/en/trips/old-trafford',
      '/en/sign-in',
      '/en/enquire',
      '/id/enquire',
      '/en/about',
      '/en/how-it-works',
      '/en/contact',
      '/admin/sign-in',
    ]) {
      const r = await page.goto(base + path);
      assert.equal(r?.status(), 200, path);
      await page.locator('h1').waitFor();
      await page.waitForFunction(() => document.documentElement.dataset.citadelReady === 'true');
      await page.evaluate(() => document.fonts.ready);
      assert(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        `Horizontal overflow at ${width}px: ${path}`,
      );
      assert(await page.locator('h1').innerText(), `Missing heading: ${path}`);
      if (path !== '/admin/sign-in') {
        const brand = await page.locator('.site-header .brand-lockup').boundingBox();
        const actions = await page.locator('.header-actions').boundingBox();
        assert(
          brand && actions && brand.x + brand.width <= actions.x - 4,
          `Header collision at ${width}px: ${path}`,
        );
      }
    }
    if (width < 1200) {
      await page.goto(base + '/en');
      await page.waitForFunction(() => document.documentElement.dataset.citadelReady === 'true');
      const toggle = page.locator('.mobile-menu');
      assert.equal(await toggle.getAttribute('aria-label'), 'Open navigation');
      await toggle.click();
      await page.locator('#primary-navigation').waitFor({ state: 'visible' });
      assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
      await page.keyboard.press('Escape');
      await page.locator('#primary-navigation').waitFor({ state: 'hidden' });
      assert(
        await toggle.evaluate((element) => element === document.activeElement),
        'Escape must return focus to the navigation toggle.',
      );
      await toggle.click();
      await page
        .getByRole('navigation', { name: 'Main navigation', exact: true })
        .getByRole('link', { name: 'Sports', exact: true })
        .click();
      await page.waitForURL('**/en/sport');
      assert.equal(await page.locator('.mobile-menu').getAttribute('aria-expanded'), 'false');
    }
    if (width <= 760) {
      await page.goto(base + '/en');
      await page.waitForFunction(() => document.documentElement.dataset.citadelReady === 'true');
      await waitForVisualStable();
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      const footer = await page.locator('.site-footer').boundingBox();
      const bar = await page.locator('.mobile-home-actions').boundingBox();
      assert(
        footer && bar && footer.y + footer.height <= bar.y + 1,
        'The fixed action bar must not cover the footer.',
      );
    }
    if (width === 375) {
      await page.goto(base + '/en');
      await page.waitForFunction(() => document.documentElement.dataset.citadelReady === 'true');
      await waitForVisualStable();
      await page.screenshot({
        path: resolve(screenshotDirectory, 'v2-home-375.png'),
        fullPage: true,
      });
      await page.goto(base + '/en/trips/old-trafford');
      await page.waitForFunction(() => document.documentElement.dataset.citadelReady === 'true');
      await waitForVisualStable();
      await page.screenshot({
        path: resolve(screenshotDirectory, 'v2-package-375.png'),
        fullPage: true,
      });
    }
    if (width === 1280) {
      await page.goto(base + '/en');
      await page.waitForFunction(() => document.documentElement.dataset.citadelReady === 'true');
      await waitForVisualStable();
      await page.screenshot({
        path: resolve(screenshotDirectory, 'v2-home-1280.png'),
        fullPage: true,
      });
      await page.goto(base + '/en/trips/old-trafford');
      await page.waitForFunction(() => document.documentElement.dataset.citadelReady === 'true');
      await waitForVisualStable();
      await page.screenshot({
        path: resolve(screenshotDirectory, 'v2-package-1280.png'),
        fullPage: true,
      });
    }
  }
  await page.setViewportSize({ width: 812, height: 375 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(base + '/en');
  await page.waitForFunction(() => document.documentElement.dataset.citadelReady === 'true');
  await page.locator('.mobile-menu').click();
  assert(
    await page.getByRole('navigation', { name: 'Main navigation', exact: true }).isVisible(),
    'Navigation must work in landscape.',
  );
  await page.keyboard.press('Escape');
  assert(
    await page
      .locator('video')
      .evaluateAll((videos) => videos.every((video) => (video as HTMLVideoElement).paused)),
    'Reduced motion must suppress autoplay.',
  );
  await page.goto(base + '/en/trips/old-trafford');
  await page.getByRole('link', { name: 'Ganti ke Bahasa Indonesia' }).click();
  await page.waitForURL('**/id/trips/old-trafford');
  await page.waitForFunction(() => document.documentElement.lang === 'id');
  assert(page.url().endsWith('/id/trips/old-trafford'));
  assert.equal(await page.locator('html').getAttribute('lang'), 'id');
  assert.equal(errors.length, 0, errors.join('\n'));
  console.log(
    'Passed: public/auth/admin-sign-in pages at 320, 375, 768, 1024, 1280 and 1440px; header spacing, mobile navigation, footer clearance and locale switching.',
  );
} finally {
  await browser.close();
}
