import { offerFixture } from '../tests/fixtures.js';
import { spawn } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const requireApi = createRequire(new URL('../apps/api/package.json', import.meta.url));
const { authenticator } = requireApi('otplib');
const directory = await mkdtemp(resolve(tmpdir(), 'citadel-check-'));
const port = 4410,
  origin = `http://localhost:${port}`,
  password = randomBytes(24).toString('hex');
const child = spawn(process.execPath, ['--import', 'tsx', 'apps/api/src/server.ts'], {
  cwd: resolve(import.meta.dirname, '..'),
  env: {
    ...process.env,
    APP_ENV: 'development',
    APP_ORIGIN: origin,
    PORT: String(port),
    DATABASE_URL: '',
    PGLITE_DIR: directory,
    LOCAL_FILES_DIR: resolve(directory, 'documents'),
    SEED_ADMIN_EMAIL: 'ops@check.local',
    SEED_ADMIN_PASSWORD: password,
    CLOUDFLARE_ZONE_ID: '',
    CLOUDFLARE_API_TOKEN: '',
    PAYMENT_PROVIDER: 'development',
    EMAIL_PROVIDER: 'development',
    WHATSAPP_ENABLED: 'false',
    TURNSTILE_SECRET: '',
    R2_ACCOUNT_ID: '',
    R2_ACCESS_KEY_ID: '',
    R2_SECRET_ACCESS_KEY: '',
    SENTRY_DSN: '',
    DEV_JOB_INTERVAL_MS: '1000',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let logs = '';
child.stdout.on('data', (chunk) => {
  logs += chunk;
});
child.stderr.on('data', (chunk) => {
  logs += chunk;
});
const jars: Record<string, string> = {};
async function request(
  path: string,
  method = 'GET',
  body?: unknown,
  actor = 'member',
  expected = 200,
  key?: string,
) {
  if (method !== 'GET' && body === undefined) body = {};
  const form = body instanceof FormData;
  const r = await fetch(origin + path, {
    method,
    headers: {
      Origin: origin,
      ...(form ? {} : { 'Content-Type': 'application/json' }),
      Cookie: jars[actor] || '',
      'Idempotency-Key': key || randomUUID(),
    },
    body: body === undefined ? undefined : form ? (body as FormData) : JSON.stringify(body),
  });
  const cookie = r.headers.getSetCookie()[0];
  if (cookie) jars[actor] = cookie.split(';')[0];
  const text = await r.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  assert.equal(r.status, expected, `${method} ${path}: ${text}`);
  return data;
}
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(origin + '/healthz')).ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  assert(ready, 'API failed to start: ' + logs);
  const catalog = await request('/api/public/catalog');
  assert.equal(catalog.packages.length, 0);
  assert(catalog.events.every((e: any) => e.date_status === 'provisional'));
  await request('/api/auth/sign-in', 'POST', { email: 'ops@check.local', password }, 'admin');
  await request('/api/admin/dashboard', 'GET', undefined, 'admin', 403);
  const enroll = await request('/api/admin/auth/totp/enroll', 'POST', {}, 'admin');
  const verified = await request(
    '/api/admin/auth/totp/verify',
    'POST',
    { code: authenticator.generate(enroll.secret) },
    'admin',
  );
  assert.equal(verified.recovery_codes.length, 10);
  const seedPackages = (await request('/api/admin/data/packages', 'GET', undefined, 'admin')).rows;
  const seedBatches = (await request('/api/admin/data/batches', 'GET', undefined, 'admin')).rows;
  for (const batch of seedBatches)
    await request(
      '/api/admin/data/events/' + batch.event_id,
      'PATCH',
      { date_status: 'tba' },
      'admin',
    );
  for (const p of seedPackages)
    await request(
      '/api/admin/data/packages/' + p.id,
      'PATCH',
      {
        status: 'published',
        readiness: 'ready_to_offer',
        supplier_verified_at: new Date().toISOString(),
        coverage_verified_at: new Date().toISOString(),
        sales_rights_note: 'TEST FIXTURE ONLY',
        terms: { id: 'Fixture terms' },
        proof_points: [{ key: 'ticket', label: { id: 'Fixture' }, value: { id: 'Fixture' } }],
        rights_reason: 'Test fixture placeholder only',
      },
      'admin',
    );
  const signup = await request('/api/auth/sign-up', 'POST', {
    full_name: 'Check Member',
    email: 'member@check.local',
    password,
    whatsapp_e164: '+628123456789',
    locale: 'en',
    whatsapp_opt_in: false,
  });
  assert(signup.development_token);
  const pkg = await request('/api/public/packages/old-trafford');
  const traveler = await request('/api/me/travelers', 'POST', {
    given_names: 'Rina',
    surname: 'Hartono',
    passport_number: 'A1234567',
    passport_expiry: '2028-12-31',
    dietary: ['halal'],
  });
  assert.equal(traveler.passport_masked, '•••••567');
  assert(!JSON.stringify(traveler).includes('A1234567'));
  const bookingBody = {
    package_id: pkg.id,
    travelers: [{ traveler_id: traveler.id, package_option_id: pkg.options[0].id }],
    room_preference: 'twin',
    addons: [],
    member_notes: 'Seats together',
  };
  await request('/api/me/bookings', 'POST', bookingBody, 'member', 403);
  await request('/api/auth/verify-email', 'POST', { token: signup.development_token });
  await request(
    '/api/auth/verify-email',
    'POST',
    { token: signup.development_token },
    'member',
    400,
  );
  const booking = await request('/api/me/bookings', 'POST', bookingBody);
  const batches = await request('/api/admin/data/batches', 'GET', undefined, 'admin');
  const batch = batches.rows.find((b: any) => b.package_id === pkg.id);
  await request(
    '/api/admin/data/batches/' + batch.id,
    'PATCH',
    { status: 'open', capacity: 1, min_pax: 1, start_date: '2027-03-11', end_date: '2027-03-15' },
    'admin',
  );
  await request(
    '/api/admin/bookings/' + booking.code + '/status',
    'POST',
    { status: 'reviewing' },
    'admin',
  );
  const offerBody = {
    ...offerFixture,
    batch_id: batch.id,
    lines: [
      {
        description: { id: 'Paket perjalanan', en: 'Journey package' },
        quantity: 1,
        unit_amount: 10000000,
      },
    ],
    discount: 100000,
    confirm_amount: '9900000',
    due_at: new Date(Date.now() + 86400000).toISOString(),
    allowed_channels: [],
  };
  const issueKey = randomUUID();
  const offer = await request(
    '/api/admin/bookings/' + booking.code + '/offer',
    'POST',
    offerBody,
    'admin',
    200,
    issueKey,
  );
  const again = await request(
    '/api/admin/bookings/' + booking.code + '/offer',
    'POST',
    offerBody,
    'admin',
    200,
    issueKey,
  );
  assert.equal(again.id, offer.id);
  assert.equal(Number(offer.total), 9900000);
  await request('/api/me/invoices/' + offer.id + '/approve', 'POST', {
    locale: 'en',
    offer_version: offer.offer_version,
  });
  const checkout = await request('/api/me/invoices/' + offer.id + '/pay', 'POST');
  const checkout2 = await request('/api/me/invoices/' + offer.id + '/pay', 'POST');
  assert.equal(checkout.url, checkout2.url);
  assert.equal((await request('/api/me/bookings/' + booking.code)).booking.status, 'offered');
  await request(
    '/api/webhooks/xendit',
    'POST',
    { event: 'payment_session.completed' },
    'member',
    401,
  );
  const ref = checkout.url.split('/').pop();
  await request('/api/dev/checkout/' + ref + '/complete', 'POST', {});
  assert.equal((await request('/api/me/bookings/' + booking.code)).booking.status, 'confirmed');
  await request(
    '/api/me/travelers/' + traveler.id,
    'PATCH',
    { given_names: 'Changed' },
    'member',
    409,
  );
  const memberList = await request('/api/me/bookings');
  assert(memberList.every((row: any) => !('internal_notes' in row)));
  const second = await request('/api/me/bookings', 'POST', bookingBody);
  await request(
    '/api/admin/bookings/' + second.code + '/status',
    'POST',
    { status: 'reviewing' },
    'admin',
  );
  await request('/api/admin/bookings/' + second.code + '/offer', 'POST', offerBody, 'admin', 409);
  const batch2 = batches.rows.find((row: any) => row.package_id === pkg.id && row.id !== batch.id);
  await request(
    '/api/admin/data/batches/' + batch2.id,
    'PATCH',
    { status: 'open', start_date: '2027-04-22', end_date: '2027-04-26' },
    'admin',
  );
  await request(
    '/api/admin/bookings/' + second.code + '/offer',
    'POST',
    { ...offerBody, batch_id: batch2.id, due_at: new Date(Date.now() + 1500).toISOString() },
    'admin',
  );
  await new Promise((r) => setTimeout(r, 3500));
  assert.equal((await request('/api/me/bookings/' + second.code)).booking.status, 'expired');
  const seats = (await request('/api/admin/data/batches', 'GET', undefined, 'admin')).rows.find(
    (row: any) => row.id === batch2.id,
  );
  assert.equal(Number(seats.held), 0);
  const form = new FormData();
  form.set('batch_id', batch.id);
  form.set('booking_id', booking.id);
  form.set('traveler_id', traveler.id);
  form.set('type', 'event_ticket');
  form.set('title', 'Match ticket');
  form.set('file', new Blob(['%PDF-1.4\n%%EOF'], { type: 'application/pdf' }), 'ticket.pdf');
  const document = await request('/api/admin/documents/upload', 'POST', form, 'admin');
  assert.equal((await request('/api/me/bookings/' + booking.code)).documents.length, 0);
  await request('/api/me/documents/' + document.id + '/download', 'GET', undefined, 'member', 404);
  await request(
    '/api/admin/batches/' + batch.id + '/publish',
    'POST',
    { documents: [document.id] },
    'admin',
  );
  assert.equal((await request('/api/me/bookings/' + booking.code)).documents.length, 1);
  const download = await fetch(origin + '/api/me/documents/' + document.id + '/download', {
    headers: { Cookie: jars.member },
    redirect: 'manual',
  });
  assert.equal(download.status, 302);
  const privateUrl = download.headers.get('location')!;
  assert.equal((await fetch(origin + privateUrl)).status, 200);
  assert.equal((await fetch(origin + privateUrl.replace(/expires=\d+/, 'expires=1'))).status, 403);
  await request(
    '/api/auth/sign-up',
    'POST',
    { full_name: 'Other Member', email: 'other@check.local', password, locale: 'id' },
    'other',
  );
  await request('/api/me/bookings/' + booking.code, 'GET', undefined, 'other', 404);
  await request('/api/me/documents/' + document.id + '/download', 'GET', undefined, 'other', 404);
  const forbidden = await fetch(origin + '/api/auth/sign-out', {
    method: 'POST',
    headers: { Origin: 'https://other.example', Cookie: jars.member },
  });
  assert.equal(forbidden.status, 403);
  const audit = await request('/api/admin/data/audit', 'GET', undefined, 'admin');
  assert(audit.rows.length > 0);
  assert(!JSON.stringify(audit).includes('A1234567'));
  console.log(
    'Passed: catalog, verification, MFA, ownership, encrypted passport responses, offer idempotency, capacity, expiry releases seats, checkout reuse, payment confirmation, traveler lock, private/published documents, signed URL expiry, CSRF, audit.',
  );
} catch (error) {
  await new Promise((r) => setTimeout(r, 300));
  for (const line of logs.split('\n')) {
    try {
      const item = JSON.parse(line);
      if (item.level >= 50) console.error(item.error_message || item.msg);
    } catch {}
  }
  throw error;
} finally {
  child.kill('SIGTERM');
  await new Promise<void>((resolve) => {
    if (child.exitCode !== null) return resolve();
    child.once('exit', () => resolve());
    setTimeout(() => {
      child.kill('SIGKILL');
      resolve();
    }, 5000).unref();
  });
  await rm(directory, { recursive: true, force: true });
}
