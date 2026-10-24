import { previewReady } from './preview-ready.js';
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const base = process.env.CITADEL_PREVIEW_URL || 'http://localhost:3000';
await previewReady(base);
const browser = await chromium.launch(
  process.platform === 'darwin'
    ? { executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' }
    : {},
);
const context = await browser.newContext();
const page = await context.newPage(),
  findings: any[] = [];
try {
  for (const width of [360, 1280])
    for (const path of [
      '/id',
      '/en',
      '/en/trips/old-trafford',
      '/en/sign-up',
      '/en/enquire',
      '/admin/sign-in',
      '/dev/ui',
    ]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(base + path);
      await page.waitForFunction(() => document.documentElement.dataset.citadelReady === 'true');
      const result = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze();
      findings.push({
        width,
        path,
        violations: result.violations.map((v) => ({
          id: v.id,
          impact: v.impact,
          description: v.description,
          nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })),
        })),
      });
    }
  await mkdir('.data/checks', { recursive: true });
  await writeFile('.data/checks/accessibility.json', JSON.stringify(findings, null, 2));
  const failures = findings.flatMap((r) =>
    r.violations
      .filter((v: any) => ['serious', 'critical'].includes(v.impact))
      .map((v: any) => `${r.path} ${r.width}px: ${v.id} ${JSON.stringify(v.nodes)}`),
  );
  assert.equal(failures.length, 0, failures.join('\n'));
  console.log('Passed axe checks on public, account-entry and UI-gallery pages at 360/1280px.');
} finally {
  await browser.close();
}
