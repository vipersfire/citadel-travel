import { chromium } from '@playwright/test';
import { gzipSync } from 'node:zlib';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { previewReady } from './preview-ready';
const base = process.env.CITADEL_PREVIEW_URL || 'http://localhost:3330';
await previewReady(base);
const browser = await chromium.launch(
    process.platform === 'darwin'
      ? { executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' }
      : {},
  ),
  reports: any[] = [];
try {
  for (const path of ['/en', '/en/trips/old-trafford']) {
    const context = await browser.newContext({
        viewport: { width: 360, height: 800 },
        deviceScaleFactor: 2,
        isMobile: true,
      }),
      page = await context.newPage(),
      scripts = new Map<string, number>(),
      pending: Promise<void>[] = [];
    await page.addInitScript(() => {
      (window as any).__interactions = [];
      new PerformanceObserver((list) => {
        for (const e of list.getEntries())
          if ((e as any).interactionId) (window as any).__interactions.push(e.duration);
      }).observe({ type: 'event', buffered: true, durationThreshold: 16 } as PerformanceObserverInit & {durationThreshold:number});
    });
    page.on('response', (r) => {
      if (r.request().resourceType() === 'script')
        pending.push(
          r.body().then((body) => {
            scripts.set(r.url(), gzipSync(body).length);
          }),
        );
    });
    await page.goto(base + path);
    await page.waitForFunction(() => document.documentElement.dataset.citadelReady === 'true');
    await Promise.all(pending);
    const javascriptGzip = [...scripts.values()].reduce((n, v) => n + v, 0);
    assert(javascriptGzip < 170 * 1024, 'Public first-load JS exceeds 170 KB: ' + javascriptGzip);
    const session = await context.newCDPSession(page);
    await session.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    const accordion = page.locator('summary').first();
    if (await accordion.count()) {
      await accordion.click();
      await accordion.click();
    } else {
      await page.getByRole('button',{name:'Toggle navigation'}).click();await page.getByRole('button',{name:'Toggle navigation'}).click();
    }
    await page.waitForTimeout(150);
    const eventDurations = await page.evaluate(() => (window as any).__interactions);
    const worstInteraction = Math.max(16, ...eventDurations);
    assert(worstInteraction < 200, 'Lab interaction latency exceeds 200 ms: '+worstInteraction+' ms on '+path);
    reports.push({
      path,
      javascriptGzip,
      worstInteraction,
      eventDurations,
      note: 'Lab interactions at CPU slowdown 4. Field INP requires representative real-user traffic.',
    });
    await context.close();
  }
  const reduced = await browser.newContext({ reducedMotion: 'reduce' }),
    page = await reduced.newPage();
  await page.goto(base + '/en');
  await page.waitForFunction(() => document.documentElement.dataset.citadelReady === 'true');
  await page.waitForTimeout(2000);
  assert.equal(
    await page.locator('video').getAttribute('src'),
    null,
    'Reduced motion must not load video',
  );
  await reduced.close();
  const saveData = await browser.newContext();
  await saveData.addInitScript(() => {
    const connection = new EventTarget();
    Object.defineProperty(connection, 'saveData', { value: true });
    Object.defineProperty(navigator, 'connection', { value: connection });
  });
  const saved = await saveData.newPage();
  await saved.goto(base + '/en');
  await saved.waitForFunction(() => document.documentElement.dataset.citadelReady === 'true');
  await saved.waitForTimeout(2000);
  assert.equal(
    await saved.locator('video').getAttribute('src'),
    null,
    'Save-Data must not load video',
  );
  await saveData.close();
  await mkdir('.data/checks', { recursive: true });
  await writeFile('.data/checks/performance.json', JSON.stringify(reports, null, 2));
  console.log('Passed first-load JS, lab interaction, reduced-motion and Save-Data checks.');
} finally {
  await browser.close();
}
