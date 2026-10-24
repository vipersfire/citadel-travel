import { chromium } from '@playwright/test';
import { createServer, request as httpRequest } from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import AxeBuilder from '@axe-core/playwright';
const requireApi = createRequire(new URL('../apps/api/package.json', import.meta.url));
const { authenticator } = requireApi('otplib');
const directory = await mkdtemp(resolve(tmpdir(), 'citadel-browser-')),
  origin = 'http://localhost:3320',
  password = randomBytes(24).toString('hex');
const env = {
  ...process.env,
  APP_ENV: 'development',
  APP_ORIGIN: origin,
  PORT: '4420',
  TRUST_PROXY: 'loopback,uniquelocal',
  DATABASE_URL: '',
  PGLITE_DIR: directory,
  LOCAL_FILES_DIR: resolve(directory, 'files'),
  LOCAL_MEDIA_DIR: resolve(directory, 'media'),
  SESSION_SECRET: randomBytes(32).toString('hex'),
  ENCRYPTION_KEY: randomBytes(32).toString('hex'),
  ENCRYPTION_PREVIOUS_KEYS: '',
  SENTRY_DSN_PUBLIC: '',
  SEED_ADMIN_EMAIL: 'ops@browser.local',
  SEED_ADMIN_PASSWORD: password,
  CLOUDFLARE_ZONE_ID: '',
  CLOUDFLARE_API_TOKEN: '',
  PAYMENT_PROVIDER: 'development',
  EMAIL_PROVIDER: 'development',
  WHATSAPP_ENABLED: 'false',
  TURNSTILE_SECRET: '',
  TURNSTILE_SITE_KEY: '',
  R2_ACCOUNT_ID: '',
  R2_ACCESS_KEY_ID: '',
  R2_SECRET_ACCESS_KEY: '',
  SENTRY_DSN: '',
  GOOGLE_CLIENT_ID: '',
  GOOGLE_CLIENT_SECRET: '',
  ALERTS_ENABLED: 'false',
  API_INTERNAL_URL: 'http://127.0.0.1:4420',
};
const fixtures = spawnSync(
  process.execPath,
  ['--import', 'tsx', 'scripts/seed-check-fixtures.ts'],
  {
    cwd: resolve(import.meta.dirname, '..'),
    env: { ...env, CITADEL_CHECK_FIXTURES: 'true' },
    encoding: 'utf8',
  },
);
assert.equal(fixtures.status, 0, fixtures.stderr);
const apiProcess = spawn(process.execPath, ['--import', 'tsx', 'apps/api/src/server.ts'], {
  cwd: resolve(import.meta.dirname, '..'),
  env,
  stdio: 'pipe',
});
const webProcess = spawn(
  process.execPath,
  ['node_modules/@react-router/serve/bin.js', 'build/server/index.js'],
  {
    cwd: resolve(import.meta.dirname, '../apps/web'),
    env: { ...env, PORT: '3321', NODE_ENV: 'production' },
    stdio: 'pipe',
  },
);
const gateway = createServer((req, res) => {
  const api = /^\/(api|auth)(\/|$)/.test(req.url || '');
  const upstream = httpRequest(
    {
      hostname: '127.0.0.1',
      port: api ? 4420 : 3321,
      path: req.url,
      method: req.method,
      headers: req.headers,
    },
    (response) => {
      res.writeHead(response.statusCode || 502, response.headers);
      response.pipe(res);
    },
  );
  upstream.on('error', () => {
    res.writeHead(503);
    res.end('Starting isolated check');
  });
  req.pipe(upstream);
});
gateway.listen(3320, '127.0.0.1');
let logs = '';
for (const process of [apiProcess, webProcess]) {
  process.stdout?.on('data', (c) => (logs += c));
  process.stderr?.on('data', (c) => (logs += c));
}
const browser = await chromium.launch(
  process.platform === 'darwin'
    ? { executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' }
    : {},
);
const member = await browser.newContext({
    extraHTTPHeaders: { 'X-Forwarded-For': '203.0.113.10' },
  }),
  admin = await browser.newContext({ extraHTTPHeaders: { 'X-Forwarded-For': '203.0.113.20' } });
member.setDefaultTimeout(15000);
admin.setDefaultTimeout(15000);
const page = await member.newPage(),
  ops = await admin.newPage();
page.on('pageerror', (e) => console.error('Member page error:', e.message));
ops.on('pageerror', (e) => console.error('Admin page error:', e.message));
try {
  let ready = false;
  for (let i = 0; i < 150; i++) {
    try {
      if ((await fetch(origin + '/api/healthz')).ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  assert(ready, 'Could not start isolated browser environment.');
  await page.goto(origin + '/en/sign-up');
  await page.waitForFunction(() => document.documentElement.dataset.citadelReady === 'true');
  await page.waitForFunction(() => document.documentElement.dataset.citadelReady === 'true');
  assert.deepEqual(
    (await new AxeBuilder({ page }).analyze()).violations,
    [],
    'Sign-up accessibility',
  );
  await page.getByLabel('Full name').fill('Browser Member');
  await page.getByLabel('Email', { exact: true }).fill('member@browser.local');
  await page.getByLabel(/^Password/).fill(password);
  await page.getByLabel('WhatsApp', { exact: true }).fill('+628123456789');
  const signupResponse = page.waitForResponse((r) => r.url().endsWith('/api/auth/sign-up'));
  await page.getByRole('button', { name: 'Create account' }).click();
  const signupResult = await (await signupResponse).json();
  assert(
    signupResult.development_token,
    'Signup returned no development verification link: ' + JSON.stringify(signupResult.error || {}),
  );
  await page.getByRole('link', { name: 'Open email link' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('link', { name: /^Continue/ }).click();
  await page.waitForURL('**/en/account');
  await page.goto(origin + '/en/account/travelers');
  await page.waitForFunction(() => document.documentElement.dataset.citadelReady === 'true');
  await page.getByRole('button', { name: 'Add traveler' }).click();
  await page.getByLabel('Given names on passport').fill('Rina');
  await page.getByLabel('Surname on passport').fill('Hartono');
  await page.getByLabel('Passport number').fill('B1234567');
  await page.getByLabel('Passport expiry').fill('2028-12-31');
  await page.getByRole('button', { name: 'Save traveler' }).click();
  await page.getByRole('heading', { name: 'Rina Hartono' }).waitFor();
  await page.goto(origin + '/en/trips/old-trafford');
  await page.waitForFunction(() => document.documentElement.dataset.citadelReady === 'true');
  await page.getByRole('link', { name: 'Request this journey' }).first().click();
  await page.waitForURL('**/en/account/request/old-trafford');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('checkbox', { name: /Rina Hartono/ }).check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Send request' }).click();
  await page.waitForURL(/\/en\/account\/trips\/CTD-/);
  console.log('Browser: request submitted');
  const code = page.url().split('/').pop()!;
  await ops.goto(origin + '/admin/sign-in');
  await ops.waitForFunction(() => document.documentElement.dataset.citadelReady === 'true');
  await ops.getByLabel('Email', { exact: true }).fill('ops@browser.local');
  await ops.getByLabel(/^Password/).fill(password);
  await ops.getByRole('button', { name: 'Sign in' }).click();
  await ops.getByRole('button', { name: 'Set up authenticator' }).click();
  const secret = await ops.locator('.secret-key').innerText();
  await ops.getByLabel('Authenticator or recovery code').fill(authenticator.generate(secret));
  await ops.getByRole('button', { name: 'Verify code' }).click();
  await ops.getByRole('button', { name: 'I’ve saved these codes' }).click();
  await ops.waitForURL('**/admin');
  console.log('Browser: admin MFA verified');
  const adminRequest = admin.request;
  const apiCall = async (path: string, body?: any, method = 'POST') => {
    const r = await adminRequest.fetch(origin + path, {
      method,
      headers: { Origin: origin, 'Idempotency-Key': randomBytes(16).toString('hex') },
      data: body,
    });
    assert(r.ok(), await r.text());
    return r.json();
  };
  const batches = await apiCall('/api/admin/data/batches', undefined, 'GET');
  const batch = batches.rows.find((b: any) => b.code === 'OT-27-0313');
  await apiCall('/api/admin/data/batches/' + batch.id, { status: 'open' }, 'PATCH');
  await ops.goto(origin + '/admin/requests/' + code);
  await ops.waitForFunction(() => document.documentElement.dataset.citadelReady === 'true');
  await ops.getByRole('button', { name: 'Review request' }).click();
  await ops.getByLabel('Departure batch').selectOption(batch.id);
  await ops.getByLabel('Unit amount (IDR)').fill('10000000');
  await ops.getByLabel('Type the total after discount to confirm').fill('10000000');
  for (const checkbox of await ops.locator('input[name^="check_"][type=checkbox]').all())
    await checkbox.check();
  for (const note of await ops.locator('input[name^="check_note_"]').all())
    await note.fill('TEST FIXTURE ONLY: written evidence');
  for (const field of [
    'services',
    'exclusions',
    'ticket_category',
    'seating_policy',
    'change_terms',
    'cancellation_terms',
  ]) {
    await ops.locator(`textarea[name="${field}_id"]`).fill('Fixture ' + field);
    await ops.locator(`textarea[name="${field}_en"]`).fill('Fixture ' + field);
  }
  await ops.getByRole('button', { name: 'Issue offer & hold seats' }).click();
  await ops.getByRole('heading', { name: 'Invoices', exact: true }).waitFor();
  await page.goto(origin + '/en/account/trips/' + code + '/payments');
  await page.waitForFunction(() => document.documentElement.dataset.citadelReady === 'true');
  await page.getByRole('button', { name: 'Approve offer', exact: true }).click();
  await page.getByRole('button', { name: /^Pay Rp/ }).click();
  await page.getByRole('button', { name: 'Simulate successful payment' }).waitFor();
  await page.waitForFunction(() => document.documentElement.dataset.citadelReady === 'true');
  await page.getByRole('button', { name: 'Simulate successful payment' }).click();
  await page.waitForURL(/\/(id|en)\/account\/trips\/CTD-.*\/payments/);
  await page
    .locator('.trip-pass .chip')
    .filter({ hasText: /Dikonfirmasi|Confirmed/ })
    .waitFor();
  assert.equal((await member.request.get(origin + '/api/me/bookings/' + code)).status(), 200);
  console.log('Browser: payment confirmed');
  await page.setViewportSize({ width: 360, height: 900 });
  for (const suffix of ['', '/itinerary', '/documents', '/travelers', '/payments']) {
    await page.goto(origin + '/en/account/trips/' + code + suffix);
    await page.waitForFunction(() => document.documentElement.dataset.citadelReady === 'true');
    await page.waitForFunction(() => document.documentElement.dataset.citadelReady === 'true');
    assert(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      'Member trip overflow: ' + suffix,
    );
  }
  const reportDir = resolve(import.meta.dirname, '../.data/checks/private');
  await mkdir(reportDir, { recursive: true });
  const audits: any[] = [];
  for (const lang of ['en', 'id'])
    for (const tab of ['', '/itinerary', '/documents', '/travelers', '/payments']) {
      await page.goto(`${origin}/${lang}/account/trips/${code}${tab}`);
      await page.waitForFunction(() => document.documentElement.dataset.citadelReady === 'true');
      const results = await new AxeBuilder({ page }).analyze();
      audits.push({ route: lang + tab, violations: results.violations });
      console.log('Private axe: ' + lang + tab);
      assert.deepEqual(results.violations, [], 'Private accessibility ' + lang + tab);
    }
  await ops.goto(origin + '/admin/batches/' + batch.id);
  await ops.waitForFunction(() => document.documentElement.dataset.citadelReady === 'true');
  await ops.getByRole('button', { name: 'Operations', exact: true }).click();
  console.log('Browser: operations board opened');
  await ops
    .getByRole('checkbox', { name: 'Select Rina Hartono', exact: true })
    .focus({ timeout: 15000 });
  console.log('Browser: traveler checkbox focused');
  await ops.keyboard.press('ArrowRight');
  console.log('Browser: arrow moved');
  assert.equal(await ops.locator(':focus').getAttribute('aria-label'), 'Rina flight details');
  await ops.keyboard.press('Enter');
  console.log('Browser: cell activated');
  await ops.getByRole('dialog').waitFor();
  await ops.keyboard.press('Escape');
  const adminAxe = await new AxeBuilder({ page: ops }).analyze();
  audits.push({ route: 'admin/operations', violations: adminAxe.violations });
  assert.deepEqual(adminAxe.violations, [], 'Operations accessibility');
  await page.screenshot({ path: resolve(reportDir, 'member-mobile.png'), fullPage: true });
  await ops.screenshot({ path: resolve(reportDir, 'admin-operations.png'), fullPage: true });
  await writeFile(resolve(reportDir, 'accessibility.json'), JSON.stringify(audits, null, 2));
  const performanceContext = await browser.newContext({
      storageState: await member.storageState(),
      viewport: { width: 360, height: 800 },
      isMobile: true,
      deviceScaleFactor: 2,
      extraHTTPHeaders: { 'X-Forwarded-For': '203.0.113.10' },
    }),
    coldPage = await performanceContext.newPage();
  const cdp = await performanceContext.newCDPSession(coldPage);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 150,
    downloadThroughput: 200000,
    uploadThroughput: 100000,
  });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const started = performance.now();
  await coldPage.goto(origin + '/en/account/trips/' + code, { waitUntil: 'commit' });
  await coldPage.waitForFunction(() => document.documentElement.dataset.citadelReady === 'true');
  const interactive = performance.now() - started;
  await performanceContext.close();
  await writeFile(
    resolve(reportDir, 'performance.json'),
    JSON.stringify(
      { interactive, profile: 'Cold mobile context, CPU 4x, 150 ms latency, 1.6 Mbps download' },
      null,
      2,
    ),
  );
  assert(interactive < 3000, 'Member interactive budget: ' + Math.round(interactive) + ' ms');
  console.log(
    'Passed browser lifecycle: signup → verify → traveler → request → admin MFA → offer → simulated payment → confirmed trip.',
  );
} catch (e) {
  console.error(logs.slice(-10000));
  await page.screenshot({ path: '/tmp/citadel-browser-member-failure.png' });
  await ops.screenshot({ path: '/tmp/citadel-browser-admin-failure.png' });
  throw e;
} finally {
  gateway.close();
  await browser.close();
  for (const child of [webProcess, apiProcess]) child.kill('SIGTERM');
  await Promise.all(
    [webProcess, apiProcess].map(
      (child) =>
        new Promise<void>((resolve) => {
          if (child.exitCode !== null) return resolve();
          child.once('exit', () => resolve());
          setTimeout(() => {
            child.kill('SIGKILL');
            resolve();
          }, 5000).unref();
        }),
    ),
  );
  await rm(directory, { recursive: true, force: true });
}
