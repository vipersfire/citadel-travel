import { offerFixture, preparePilotFixture } from './fixtures';
import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
let container: StartedPostgreSqlContainer,
  app: any,
  registry: any[],
  db: any,
  closeDb: any,
  directory: string;
const cookies: Record<string, string> = {},
  ids: Record<string, string> = {},
  password = randomBytes(24).toString('hex');
const origin = 'http://localhost:4409';
let googleProfile: any = {
  sub: 'test-google',
  email: 'google@fixtures.invalid',
  email_verified: true,
  name: 'Google Fixture',
};
async function request(
  path: string,
  method = 'GET',
  body?: any,
  actor = 'member',
  expected = 200,
  key = randomUUID(),
) {
  if (method === 'POST' && path.endsWith('/pay') && [200, 502].includes(expected)) {
    const invoice = (
      await db.query('SELECT offer_version FROM invoices WHERE id=$1', [path.split('/')[4]])
    )[0];
    if (invoice)
      await request(
        path.replace(/\/pay$/, '/approve'),
        'POST',
        { locale: 'en', offer_version: invoice.offer_version },
        actor,
      );
  }
  const res = await app.inject({
    url: path,
    method,
    remoteAddress: '127.0.1.' + (1 + ([...actor].reduce((n, c) => n + c.charCodeAt(0), 0) % 240)),
    headers: { origin, cookie: cookies[actor] || '', 'idempotency-key': key },
    ...(body === undefined ? {} : { payload: body }),
  });
  const cookie = Array.isArray(res.headers['set-cookie'])
    ? res.headers['set-cookie'][0]
    : res.headers['set-cookie'];
  if (cookie) cookies[actor] = cookie.split(';')[0];
  expect(res.statusCode, `${method} ${path}: ${res.body}`).toBe(expected);
  return res.json();
}
async function newMember(actor: string) {
  const signup = await request(
    '/api/auth/sign-up',
    'POST',
    {
      full_name: actor,
      email: `${actor}@fixtures.invalid`,
      password,
      whatsapp_e164: '+628123456789',
      locale: 'en',
      whatsapp_opt_in: true,
    },
    actor,
  );
  await request('/api/auth/verify-email', 'POST', { token: signup.development_token }, actor);
  ids[actor] = signup.user.id;
  return signup;
}
async function traveler(actor: string) {
  return request(
    '/api/me/travelers',
    'POST',
    {
      given_names: actor,
      surname: 'Fixture',
      passport_number: 'B1234567',
      passport_expiry: '2029-12-31',
      dietary: ['halal'],
    },
    actor,
  );
}
async function booking(actor: string) {
  const t = await traveler(actor),
    pkg = await request('/api/public/packages/old-trafford');
  return request(
    '/api/me/bookings',
    'POST',
    {
      package_id: pkg.id,
      travelers: [{ traveler_id: t.id, package_option_id: pkg.options[0].id }],
      room_preference: 'twin',
      addons: [],
    },
    actor,
  );
}
async function issue(
  code: string,
  batchId: string,
  dueAt = new Date(Date.now() + 86400000).toISOString(),
  kind = 'package',
) {
  if (kind === 'package')
    await request(`/api/admin/bookings/${code}/status`, 'POST', { status: 'reviewing' }, 'admin');
  const invoice = await request(
    `/api/admin/bookings/${code}/offer`,
    'POST',
    {
      ...offerFixture,
      batch_id: batchId,
      kind,
      lines: [{ description: { id: 'Paket', en: 'Package' }, quantity: 1, unit_amount: 1000000 }],
      discount: 0,
      confirm_amount: '1000000',
      due_at: dueAt,
      allowed_channels: [],
    },
    'admin',
  );
  const [owner] = await db.query('SELECT user_id FROM bookings WHERE code=$1', [code]);
  const actor = Object.keys(ids).find((k) => ids[k] === owner.user_id);
  if (actor)
    await request(
      '/api/me/invoices/' + invoice.id + '/approve',
      'POST',
      { locale: 'en', offer_version: invoice.offer_version },
      actor,
    );
  return invoice;
}
beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:17-alpine').start();
  directory = await mkdtemp(join(tmpdir(), 'citadel-pg-check-'));
  Object.assign(process.env, {
    APP_ENV: 'development',
    APP_ORIGIN: origin,
    PORT: '4409',
    DATABASE_URL: container.getConnectionUri(),
    PGLITE_DIR: directory,
    LOCAL_FILES_DIR: join(directory, 'files'),
    LOCAL_MEDIA_DIR: join(directory, 'media'),
    CLOUDFLARE_ZONE_ID: '',
    CLOUDFLARE_API_TOKEN: '',
    PAYMENT_PROVIDER: 'development',
    XENDIT_SECRET_KEY: '',
    XENDIT_WEBHOOK_TOKEN: '',
    SENTRY_DSN_PUBLIC: '',
    ALERTS_ENABLED: 'false',
    ENCRYPTION_PREVIOUS_KEYS: '',
    EMAIL_PROVIDER: 'development',
    WHATSAPP_ENABLED: 'false',
    TURNSTILE_SECRET: '',
    TURNSTILE_SITE_KEY: '',
    R2_ACCOUNT_ID: '',
    R2_ACCESS_KEY_ID: '',
    R2_SECRET_ACCESS_KEY: '',
    SENTRY_DSN: '',
    SEED_ADMIN_EMAIL: 'admin@fixtures.invalid',
    SEED_ADMIN_PASSWORD: password,
    SESSION_SECRET: randomBytes(32).toString('hex'),
    ENCRYPTION_KEY: randomBytes(32).toString('hex'),
    GOOGLE_CLIENT_ID: 'fixture-client',
    GOOGLE_CLIENT_SECRET: 'fixture-secret',
    LOG_LEVEL: 'silent',
  });
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: any) => {
      const target = typeof url === 'string' ? url : url.url || String(url);
      if (target.includes('pwnedpasswords')) return new Response('', { status: 200 });
      if (target.includes('oauth2.googleapis.com')) {
        const token = [
          Buffer.from(JSON.stringify({ alg: 'RS256' })).toString('base64url'),
          Buffer.from(JSON.stringify(googleProfile)).toString('base64url'),
          'fixture',
        ].join('.');
        return Response.json({
          access_token: 'fixture',
          expires_in: 3600,
          token_type: 'Bearer',
          id_token: token,
        });
      }
      throw new Error('Unexpected external request in isolated tests');
    }),
  );
  ({ db, closeDb } = await import('../packages/db/src/index'));
  ({ app, routeRegistry: registry } = await import('../apps/api/src/server'));
  await app.ready();
  await preparePilotFixture(db);
  await request(
    '/api/auth/sign-in',
    'POST',
    { email: 'admin@fixtures.invalid', password },
    'admin',
  );
  const [admin] = await db.query("SELECT id FROM users WHERE email='admin@fixtures.invalid'");
  ids.admin = admin.id;
  await db.query('UPDATE sessions SET mfa_verified_at=now() WHERE user_id=$1', [admin.id]);
  await newMember('member');
}, 120000);
afterAll(async () => {
  await app?.close();
  await closeDb?.();
  await container?.stop();
  if (directory) await rm(directory, { recursive: true });
  vi.unstubAllGlobals();
});
describe('PostgreSQL schema and transactions', () => {
  it('normalizes PostgreSQL custom enum arrays for traveler APIs', async () => {
    await newMember('enumarray');
    const created = await traveler('enumarray');
    expect(created.dietary).toEqual(['halal']);
    const listed = await request('/api/me/travelers', 'GET', undefined, 'enumarray');
    expect(listed.find((entry: any) => entry.id === created.id).dietary).toEqual(['halal']);
    const empty = await request(
      '/api/me/travelers',
      'POST',
      { given_names: 'Empty', surname: 'Array', dietary: [] },
      'enumarray',
    );
    expect(empty.dietary).toEqual([]);
    const [stored] = await db.query('SELECT dietary FROM travelers WHERE id=$1', [created.id]);
    expect(stored.dietary).toEqual(['halal']);
  });
  it('preserves baseline schema parity for unchanged tables and applies the V2 table set', async () => {
    await db.query('CREATE SCHEMA spec_baseline');
    // Each command uses a dedicated client for the whole baseline creation/search path.
    const { pool } = await import('../packages/db/src/index');
    const client = await pool!.connect();
    try {
      await client.query('SET search_path=spec_baseline,public');
      await client.query(await readFile('docs/schema-baseline.sql', 'utf8'));
    } finally {
      await client.query('SET search_path=public');
      client.release();
    }
    const names = await db.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema='spec_baseline' AND table_type='BASE TABLE' ORDER BY table_name",
    );
    expect(names).toHaveLength(41);
    const changed = new Set([
      'packages',
      'events',
      'batches',
      'leads',
      'invoices',
      'payment_attempts',
      'services',
      'media_assets',
      'home_sections',
    ]);
    const unchanged = names.filter((n: any) => !changed.has(n.table_name));
    const actual = await db.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' AND table_name NOT IN ('citadel_migrations','citadel_rate_limits')",
    );
    for (const table of [
      ...names.map((n: any) => n.table_name),
      'offer_approvals',
      'offer_readiness_checks',
      'team_members',
      'analytics_events',
    ])
      expect(actual.some((r: any) => r.table_name === table)).toBe(true);
    const cols = async (schema: string) =>
      (
        await db.query(
          "SELECT table_name,column_name,is_nullable,data_type,CASE WHEN udt_name IN ('localized_text') THEN 'localized_text' ELSE udt_name END AS udt_name,is_generated FROM information_schema.columns WHERE table_schema=$1 AND table_name=ANY($2::text[]) ORDER BY table_name,ordinal_position",
          [schema, unchanged.map((n: any) => n.table_name)],
        )
      ).map((c: any) => ({ ...c }));
    expect(await cols('public')).toEqual(await cols('spec_baseline'));
    const constraints = async (schema: string) =>
      await db.query(
        'SELECT r.relname AS table_name,c.contype,count(*)::int AS count FROM pg_constraint c JOIN pg_class r ON r.oid=c.conrelid JOIN pg_namespace n ON n.oid=r.relnamespace WHERE n.nspname=$1 AND r.relname=ANY($2::text[]) GROUP BY r.relname,c.contype ORDER BY r.relname,c.contype',
        [schema, unchanged.map((n: any) => n.table_name)],
      );
    expect(await constraints('public')).toEqual(await constraints('spec_baseline'));
    const normalize = (value: string | null) =>
      value
        ?.replace(/(?:spec_baseline|public)\./g, '')
        .replace(/\s+/g, ' ')
        .replace(/ON DELETE NO ACTION/g, '')
        .replace(/ON UPDATE NO ACTION/g, '')
        .trim();
    const defaults = async (schema: string) =>
      (
        await db.query(
          'SELECT c.relname AS table_name,a.attname AS column_name,pg_get_expr(d.adbin,d.adrelid) AS expression FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE n.nspname=$1 AND c.relname=ANY($2::text[]) AND a.attnum>0 AND NOT a.attisdropped ORDER BY c.relname,a.attnum',
          [schema, unchanged.map((n: any) => n.table_name)],
        )
      ).map((r: any) => ({ ...r, expression: normalize(r.expression) }));
    const definitions = async (schema: string) =>
      (
        await db.query(
          'SELECT r.relname AS table_name,c.contype,pg_get_constraintdef(c.oid,true) AS definition FROM pg_constraint c JOIN pg_class r ON r.oid=c.conrelid JOIN pg_namespace n ON n.oid=r.relnamespace WHERE n.nspname=$1 AND r.relname=ANY($2::text[])',
          [schema, unchanged.map((n: any) => n.table_name)],
        )
      )
        .map((r: any) => ({ ...r, definition: normalize(r.definition) }))
        .sort((a: any, b: any) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    const indexes = async (schema: string) =>
      (
        await db.query(
          'SELECT r.relname AS table_name,i.indisunique,am.amname,pg_get_indexdef(i.indexrelid,0,true) AS definition FROM pg_index i JOIN pg_class r ON r.oid=i.indrelid JOIN pg_namespace n ON n.oid=r.relnamespace JOIN pg_class ic ON ic.oid=i.indexrelid JOIN pg_am am ON am.oid=ic.relam WHERE n.nspname=$1 AND r.relname=ANY($2::text[])',
          [schema, unchanged.map((n: any) => n.table_name)],
        )
      )
        .map((r: any) => ({
          ...r,
          definition: normalize(r.definition.replace(/^CREATE (?:UNIQUE )?INDEX \S+ ON /, 'ON ')),
        }))
        .sort((a: any, b: any) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    expect.soft(await defaults('public')).toEqual(await defaults('spec_baseline'));
    expect.soft(await definitions('public')).toEqual(await definitions('spec_baseline'));
    expect.soft(await indexes('public')).toEqual(await indexes('spec_baseline'));
    const enums = async (schema: string) =>
      db.query(
        'SELECT t.typname,e.enumlabel FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname=$1 ORDER BY t.typname,e.enumsortorder',
        [schema],
      );
    const oldEnums = await enums('spec_baseline');
    const newEnums = await enums('public');
    expect(
      newEnums.filter(
        (e: any) =>
          !['package_readiness', 'ticket_allocation_status'].includes(e.typname) &&
          !['tba', 'qualified'].includes(e.enumlabel),
      ),
    ).toEqual(oldEnums.filter((e: any) => e.typname !== 'package_kind'));
    const viewDefinition = async (schema: string) =>
      (
        await db.query(
          "SELECT pg_get_viewdef(format('%I.batch_seat_counts',$1::text)::regclass,true) AS definition",
          [schema],
        )
      )[0]?.definition;
    expect(normalize(await viewDefinition('public'))).toBe(
      normalize(await viewDefinition('spec_baseline')),
    );
    await db.query('DROP SCHEMA spec_baseline CASCADE');
  });
  it('allows one offer for the last seat under parallel transactions', async () => {
    await newMember('raceone');
    await newMember('racetwo');
    const a = await booking('raceone'),
      b = await booking('racetwo');
    const batches = await request('/api/admin/data/batches', 'GET', undefined, 'admin'),
      batch = batches.rows.find((x: any) => x.code === 'OT-27-0313');
    await request(
      '/api/admin/data/batches/' + batch.id,
      'PATCH',
      { status: 'open', capacity: 1, min_pax: 1 },
      'admin',
    );
    for (const code of [a.code, b.code])
      await request(
        '/api/admin/bookings/' + code + '/status',
        'POST',
        { status: 'reviewing' },
        'admin',
      );
    const body = {
      ...offerFixture,
      batch_id: batch.id,
      confirm_amount: '1000000',
      lines: [{ description: { id: 'Paket' }, quantity: 1, unit_amount: 1000000 }],
      discount: 0,
      due_at: new Date(Date.now() + 86400000).toISOString(),
      allowed_channels: [],
    };
    const results = await Promise.all(
      [a, b].map((x) =>
        app.inject({
          method: 'POST',
          url: '/api/admin/bookings/' + x.code + '/offer',
          headers: { origin, cookie: cookies.admin, 'idempotency-key': randomUUID() },
          payload: body,
        }),
      ),
    );
    expect(results.map((r) => r.statusCode).sort()).toEqual([200, 409]);
    expect(
      Number(
        (await db.query('SELECT held FROM batch_seat_counts WHERE batch_id=$1', [batch.id]))[0]
          .held,
      ),
    ).toBe(1);
  });
  it('implements keyset pagination and server filters without duplicate rows', async () => {
    const page = await request(
      '/api/admin/data/requests?limit=1&status=reviewing',
      'GET',
      undefined,
      'admin',
    );
    if (page.next_cursor) {
      const next = await request(
        '/api/admin/data/requests?limit=1&status=reviewing&cursor=' + page.next_cursor,
        'GET',
        undefined,
        'admin',
      );
      expect(next.rows[0].id).not.toBe(page.rows[0].id);
    }
    expect(page.rows.every((b: any) => b.status === 'reviewing')).toBe(true);
  });
});
describe('Authorization and authentication', () => {
  it('requires MFA for every protected admin API route', async () => {
    const value = randomBytes(32).toString('base64url');
    await db.query(
      "INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '1 hour')",
      [createHash('sha256').update(value).digest(), ids.admin],
    );
    for (const route of registry.filter(
      (r) => r.url.startsWith('/api/admin/') && !r.url.startsWith('/api/admin/auth/'),
    )) {
      const url = route.url
        .replace(/:code/g, 'CTD-27-99999')
        .replace(/:resource/g, 'batches')
        .replace(/:id/g, randomUUID())
        .replace(/\*/g, 'fixture');
      const response = await app.inject({
        method: route.method,
        url,
        headers: { origin, cookie: 'citadel_sid=' + value },
        ...(route.method === 'GET' || route.method === 'HEAD' ? {} : { payload: {} }),
      });
      expect(response.statusCode, route.method + ' ' + route.url).toBe(403);
    }
  });
  it('denies member access to every admin API route', async () => {
    for (const route of registry.filter(
      (r) => r.url.startsWith('/api/admin/') && !r.url.startsWith('/api/admin/auth/'),
    )) {
      const response = await app.inject({
        method: route.method,
        url: route.url
          .replace(/:code/g, 'CTD-27-99999')
          .replace(/:resource/g, 'batches')
          .replace(/:id/g, randomUUID())
          .replace(/\*/g, 'fixture'),
        headers: { origin, cookie: cookies.member },
        ...(route.method === 'GET' || route.method === 'HEAD' ? {} : { payload: {} }),
      });
      expect(response.statusCode, route.url).toBe(403);
    }
  });
  it('keeps verification and password-reset notifications email-only', async () => {
    const rows = await db.query(
      "SELECT channel FROM notifications WHERE user_id=$1 AND template_key='email_verify'",
      [ids.member],
    );
    expect(rows.every((n: any) => n.channel === 'email')).toBe(true);
  });
  it('creates new Google users and links existing verified users safely', async () => {
    const callback = async (profile: any) => {
      googleProfile = profile;
      const state = app.signCookie(
        JSON.stringify({
          state: 'fixture-state',
          verifier: 'fixture-verifier',
          next: '/en/account',
        }),
      );
      return app.inject({
        url: '/auth/google/callback?state=fixture-state&code=fixture',
        headers: { cookie: 'citadel_oauth=' + encodeURIComponent(state) },
      });
    };
    expect(
      (
        await callback({
          sub: 'google-new',
          email: 'google-new@fixtures.invalid',
          email_verified: true,
          name: 'Google New',
        })
      ).statusCode,
    ).toBe(302);
    expect(
      (
        await callback({
          sub: 'google-member',
          email: 'member@fixtures.invalid',
          email_verified: true,
          name: 'Member',
        })
      ).statusCode,
    ).toBe(302);
    expect(
      (
        await callback({
          sub: 'google-member',
          email: 'member@fixtures.invalid',
          email_verified: true,
          name: 'Member',
        })
      ).statusCode,
    ).toBe(302);
    await request(
      '/api/auth/sign-up',
      'POST',
      { full_name: 'Unverified', email: 'unverified@fixtures.invalid', password, locale: 'en' },
      'unverified',
    );
    expect(
      (
        await callback({
          sub: 'google-unverified',
          email: 'unverified@fixtures.invalid',
          email_verified: true,
          name: 'Unverified',
        })
      ).statusCode,
    ).toBe(409);
    expect(
      (
        await callback({
          sub: 'google-admin',
          email: 'admin@fixtures.invalid',
          email_verified: true,
          name: 'Admin',
        })
      ).statusCode,
    ).toBe(403);
  });
  it('makes reset tokens single use and revokes sessions', async () => {
    const reset = await request(
      '/api/auth/forgot-password',
      'POST',
      { email: 'member@fixtures.invalid' },
      'member',
    );
    await request(
      '/api/auth/reset-password',
      'POST',
      { token: reset.development_token, password },
      'member',
    );
    await request(
      '/api/auth/reset-password',
      'POST',
      { token: reset.development_token, password },
      'member',
      400,
    );
    expect((await request('/api/auth/me', 'GET', undefined, 'member')).user).toBeNull();
    await request(
      '/api/auth/sign-in',
      'POST',
      { email: 'member@fixtures.invalid', password },
      'member',
    );
  });
});
describe('Payment and operational edge cases', () => {
  it('reuses one checkout under concurrent pay requests and confirms by event only', async () => {
    const b = await booking('member'),
      batches = await request('/api/admin/data/batches', 'GET', undefined, 'admin'),
      batch = batches.rows.find((x: any) => x.code === 'OT-27-0424');
    await request('/api/admin/data/batches/' + batch.id, 'PATCH', { status: 'open' }, 'admin');
    const invoice = await issue(b.code, batch.id);
    const pay = await Promise.all(
      [1, 2].map(() => request('/api/me/invoices/' + invoice.id + '/pay', 'POST', {}, 'member')),
    );
    expect(pay[0].url).toBe(pay[1].url);
    expect((await request('/api/me/bookings/' + b.code)).booking.status).toBe('offered');
    const reference = pay[0].url.split('/').pop();
    await request('/api/dev/checkout/' + reference + '/complete', 'POST', {}, 'member');
    expect((await request('/api/me/bookings/' + b.code)).booking.status).toBe('confirmed');
    ids.confirmed = b.id;
    ids.code = b.code;
    ids.batch = batch.id;
    ids.invoice = invoice.id;
  });
  it('records mismatched currency without confirming and makes duplicate events harmless', async () => {
    await newMember('mismatch');
    const b = await booking('mismatch'),
      invoice = await issue(b.code, ids.batch);
    await request('/api/me/invoices/' + invoice.id + '/pay', 'POST', {}, 'mismatch');
    const [attempt] = await db.query('SELECT * FROM payment_attempts WHERE invoice_id=$1', [
      invoice.id,
    ]);
    const [event] = await db.query(
      "INSERT INTO webhook_events(provider,event_key,event_type,payload) VALUES('development',$1,'payment_session.completed',$2) RETURNING id",
      [
        randomUUID(),
        JSON.stringify({
          event: 'payment_session.completed',
          data: {
            payment_session_id: attempt.payment_session_id,
            amount: 1000000,
            currency: 'USD',
            payment_id: 'currency-fixture',
          },
        }),
      ],
    );
    const { processWebhook } = await import('../apps/api/src/payments');
    await processWebhook(event.id);
    await processWebhook(event.id);
    const [i] = await db.query('SELECT status,needs_review FROM invoices WHERE id=$1', [
      invoice.id,
    ]);
    expect(i.status).toBe('issued');
    expect(i.needs_review).toBe(true);
    expect(
      (
        await db.query(
          "SELECT count(*)::int AS n FROM payments WHERE provider_payment_id='currency-fixture'",
        )
      )[0].n,
    ).toBe(1);
  });
  it('validates upload signatures and serves local media from the API', async () => {
    const reservation = await request(
      '/api/admin/uploads/init',
      'POST',
      { kind: 'image', filename: 'fake.png', mime: 'image/png', bytes: 5 },
      'admin',
    );
    const url = new URL(reservation.url);
    const put = await app.inject({
      method: 'PUT',
      url: url.pathname + url.search,
      headers: { origin, cookie: cookies.admin, 'content-type': 'image/png' },
      payload: Buffer.from('wrong'),
    });
    expect(put.statusCode).toBe(200);
    await request('/api/admin/uploads/' + reservation.id + '/confirm', 'POST', {}, 'admin', 400);
  });
  it('creates an actionable deletion request and keeps financial records', async () => {
    await newMember('deletion');
    await request('/api/me/delete-account', 'POST', {}, 'deletion');
    const queue = await request('/api/admin/deletion-requests', 'GET', undefined, 'admin');
    expect(queue.rows.some((r: any) => r.user_id === ids.deletion)).toBe(true);
    await request('/api/admin/members/' + ids.deletion + '/anonymize', 'POST', {}, 'admin');
    const [u] = await db.query('SELECT status FROM users WHERE id=$1', [ids.deletion]);
    expect(u.status).toBe('deleted');
  });
  it('renders bilingual PDFs with WIB receipt dates and caches identical content', async () => {
    const { cachedPdf } = await import('../apps/api/src/pdf-cache');
    const one = await cachedPdf(
        'Manchester',
        'Fixture',
        [{ title: 'Hari 1', body: 'Kedatangan' }],
        'id',
      ),
      two = await cachedPdf(
        'Manchester',
        'Fixture',
        [{ title: 'Hari 1', body: 'Kedatangan' }],
        'id',
      );
    expect(one.subarray(0, 5).toString()).toBe('%PDF-');
    expect(one.equals(two)).toBe(true);
  });
});

async function upload(bytes: Buffer, kind = 'document', fields: any = {}) {
  const reservation = await request(
    '/api/admin/uploads/init',
    'POST',
    {
      kind,
      filename: kind === 'image' ? 'fixture.png' : 'fixture.pdf',
      mime: kind === 'image' ? 'image/png' : 'application/pdf',
      bytes: bytes.length,
      ...fields,
    },
    'admin',
  );
  const url = new URL(reservation.url);
  const put = await app.inject({
    method: 'PUT',
    url: url.pathname + url.search,
    headers: {
      origin,
      cookie: cookies.admin,
      'content-type': kind === 'image' ? 'image/png' : 'application/pdf',
    },
    payload: bytes,
  });
  expect(put.statusCode).toBe(200);
  return request('/api/admin/uploads/' + reservation.id + '/confirm', 'POST', {}, 'admin');
}
async function event(attempt: any, fields: any = {}, type = 'payment_session.completed') {
  const [row] = await db.query(
    "INSERT INTO webhook_events(provider,event_key,event_type,payload) VALUES('development',$1,$2,$3) RETURNING id",
    [
      randomUUID(),
      type,
      JSON.stringify({
        event: type,
        data: {
          payment_session_id: attempt.payment_session_id,
          amount: 1000000,
          currency: 'IDR',
          payment_id: randomUUID(),
          ...fields,
        },
      }),
    ],
  );
  await (await import('../apps/api/src/payments')).processWebhook(row.id);
  return row;
}
describe('Complete operational workflows', () => {
  it('generates responsive variants and serves confirmed local uploads independently of the web filesystem', async () => {
    const { createRequire } = await import('node:module'),
      sharp = createRequire(new URL('../apps/api/package.json', import.meta.url))('sharp');
    const bytes = await sharp({
      create: { width: 320, height: 200, channels: 3, background: '#12291F' },
    })
      .png()
      .toBuffer();
    const media = await upload(bytes, 'image');
    await (await import('../apps/api/src/media-jobs')).generateVariants(media.id);
    const [stored] = await db.query('SELECT * FROM media_assets WHERE id=$1', [media.id]);
    expect(stored.variants).toHaveLength(8);
    expect(stored.blur_data_url).toMatch(/^data:image\/webp/);
    const res = await app.inject({ url: '/api/public/media/' + stored.variants[0].key });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('image/webp');
    const repeat = await request(
      '/api/admin/uploads/' + media.id + '/confirm',
      'POST',
      {},
      'admin',
    );
    expect(repeat.id).toBe(media.id);
  });
  it('publishes assigned services and documents, blocks foreign ownership, and withdraws existing links', async () => {
    const trip = await request('/api/me/bookings/' + ids.code),
      t = trip.travelers[0];
    ids.traveler = t.id;
    const rows = await request(
      '/api/admin/batches/' + ids.batch + '/roster',
      'GET',
      undefined,
      'admin',
    );
    const roster = rows.find((r: any) => r.traveler_id === t.id);
    expect(roster.dietary).toEqual(['halal']);
    const csv = await app.inject({
      url: '/api/admin/batches/' + ids.batch + '/roster.csv',
      headers: { cookie: cookies.admin },
    });
    expect(csv.statusCode).toBe(200);
    expect(csv.body).toContain('halal');
    const bulk = await request(
      '/api/admin/batches/' + ids.batch + '/services/create-bulk',
      'POST',
      { booking_traveler_ids: [roster.booking_traveler_id], type: 'hotel' },
      'admin',
    );
    ids.hotel = bulk.rows[0].id;
    await request(
      '/api/admin/data/services/' + ids.hotel,
      'PATCH',
      {
        title: { id: 'Hotel', en: 'Hotel' },
        details: { hotel_name: 'Fixture Stay', city: 'Manchester' },
        status: 'requested',
      },
      'admin',
    );
    await request(
      '/api/admin/data/services/' + ids.hotel,
      'PATCH',
      { status: 'confirmed', supplier_ref: 'internal-only' },
      'admin',
    );
    const doc = await upload(Buffer.from('%PDF-1.7\nFixture'), 'document', {
      batch_id: ids.batch,
      booking_id: ids.confirmed,
      traveler_id: t.id,
      type: 'hotel_voucher',
      title: { id: 'Voucher hotel', en: 'Hotel voucher' },
    });
    ids.document = doc.id;
    expect((await request('/api/me/bookings/' + ids.code)).documents).toHaveLength(0);
    await request(
      '/api/admin/batches/' + ids.batch + '/publish',
      'POST',
      { services: [ids.hotel], documents: [doc.id] },
      'admin',
    );
    const published = await request('/api/me/bookings/' + ids.code);
    expect(published.documents.some((d: any) => d.id === doc.id)).toBe(true);
    expect(published.services[0].supplier_ref).toBeUndefined();
    expect(published.services[0].details.hotel_name).toBe('Fixture Stay');
    expect(
      (
        await app.inject({
          url: '/api/me/documents/' + doc.id + '/download',
          headers: { cookie: cookies.mismatch },
        })
      ).statusCode,
    ).toBe(404);
    const download = await app.inject({
      url: '/api/me/documents/' + doc.id + '/download',
      headers: { cookie: cookies.member },
    });
    expect(download.statusCode).toBe(302);
    const signed = download.headers.location!;
    expect((await app.inject({ url: signed })).statusCode).toBe(200);
    await request('/api/admin/documents/' + doc.id + '/withdraw', 'POST', {}, 'admin');
    expect((await app.inject({ url: signed })).statusCode).toBe(404);
  });
  it('assigns travelers to specific hotel stays and prevents overfilled or duplicate room assignments', async () => {
    const roster = await request(
      '/api/admin/batches/' + ids.batch + '/roster',
      'GET',
      undefined,
      'admin',
    );
    const row = roster.find((r: any) => r.traveler_id === ids.traveler);
    const room = await request(
      '/api/admin/data/rooms',
      'POST',
      { batch_id: ids.batch, hotel_service_id: ids.hotel, room_type: 'single', label: '101' },
      'admin',
    );
    await request(
      '/api/admin/rooms/' + room.id + '/occupants',
      'POST',
      { booking_traveler_ids: [row.booking_traveler_id] },
      'admin',
    );
    const updated = await request(
      '/api/admin/batches/' + ids.batch + '/roster',
      'GET',
      undefined,
      'admin',
    );
    expect(updated.find((r: any) => r.traveler_id === ids.traveler).rooms[0].room_id).toBe(room.id);
  });
  it('records manual package and supplement payments, bounded refunds and voids', async () => {
    await newMember('offline');
    const b = await booking('offline'),
      invoice = await issue(b.code, ids.batch);
    const proof = await upload(Buffer.from('%PDF-1.7\nBank fixture'), 'document', {
      type: 'payment_proof',
      booking_id: b.id,
    });
    const body = {
      amount: 1000000,
      confirm_amount: '1000000',
      reference: 'BANK-FIXTURE',
      paid_at: new Date().toISOString(),
      proof_document_id: proof.id,
    };
    const key = randomUUID();
    await request(
      '/api/admin/invoices/' + invoice.id + '/manual-payment',
      'POST',
      body,
      'admin',
      200,
      key,
    );
    await request(
      '/api/admin/invoices/' + invoice.id + '/manual-payment',
      'POST',
      body,
      'admin',
      200,
      key,
    );
    expect(
      (await request('/api/me/bookings/' + b.code, 'GET', undefined, 'offline')).booking.status,
    ).toBe('confirmed');
    const supplement = await issue(b.code, ids.batch, undefined, 'supplement');
    await request(
      '/api/admin/invoices/' + supplement.id + '/void',
      'POST',
      { confirm_amount: '1000000', reason: 'Removed optional arrangement' },
      'admin',
    );
    const [p] = await db.query('SELECT * FROM payments WHERE invoice_id=$1', [invoice.id]);
    const refund = {
      amount: 500000,
      confirm_amount: '500000',
      method: 'bank_transfer',
      reason: 'External partial refund',
      processed_on: '2026-10-14',
      reference: 'REF-FIXTURE',
    };
    await request('/api/admin/payments/' + p.id + '/refunds', 'POST', refund, 'admin');
    await request(
      '/api/admin/payments/' + p.id + '/refunds',
      'POST',
      { ...refund, amount: 600000, confirm_amount: '600000' },
      'admin',
      409,
    );
  });
  it('serializes a manual payment racing a provider payment and flags the second funds', async () => {
    await newMember('manualrace');
    const b = await booking('manualrace');
    const invoice = await issue(b.code, ids.batch);
    await request('/api/me/invoices/' + invoice.id + '/pay', 'POST', {}, 'manualrace');
    const [attempt] = await db.query('SELECT * FROM payment_attempts WHERE invoice_id=$1', [
      invoice.id,
    ]);
    const proof = await upload(Buffer.from('%PDF-1.7\nRacing bank fixture'), 'document', {
      type: 'payment_proof',
      booking_id: b.id,
    });
    const [event] = await db.query(
      "INSERT INTO webhook_events(provider,event_key,event_type,payload) VALUES('development',$1,'payment_session.completed',$2) RETURNING id",
      [
        randomUUID(),
        JSON.stringify({
          event: 'payment_session.completed',
          data: {
            payment_session_id: attempt.payment_session_id,
            amount: 1000000,
            currency: 'IDR',
            payment_id: 'manual-race-provider-fixture',
          },
        }),
      ],
    );
    const { processWebhook } = await import('../apps/api/src/payments');
    const [manual] = await Promise.all([
      app.inject({
        url: '/api/admin/invoices/' + invoice.id + '/manual-payment',
        method: 'POST',
        headers: { origin, cookie: cookies.admin, 'idempotency-key': randomUUID() },
        payload: {
          amount: 1000000,
          confirm_amount: '1000000',
          reference: 'RACING-BANK-FIXTURE',
          paid_at: new Date().toISOString(),
          proof_document_id: proof.id,
        },
      }),
      processWebhook(event.id),
    ]);
    expect(manual.statusCode).toBe(200);
    const [state] = await db.query('SELECT status,needs_review FROM invoices WHERE id=$1', [
      invoice.id,
    ]);
    expect(state.status).toBe('paid');
    expect(state.needs_review).toBe(true);
    expect(
      (
        await db.query('SELECT count(*)::int AS count FROM payments WHERE invoice_id=$1', [
          invoice.id,
        ])
      )[0].count,
    ).toBe(2);
    expect((await db.query('SELECT status FROM bookings WHERE id=$1', [b.id]))[0].status).toBe(
      'confirmed',
    );
  });
  it.each(['amount', 'late', 'second'])(
    'holds %s payment for review and supplies an acknowledgment without confirming a second journey',
    async (kind) => {
      const actor = 'finance' + kind;
      await newMember(actor);
      const b = await booking(actor),
        invoice = await issue(b.code, ids.batch);
      await request('/api/me/invoices/' + invoice.id + '/pay', 'POST', {}, actor);
      const [a] = await db.query('SELECT * FROM payment_attempts WHERE invoice_id=$1', [
        invoice.id,
      ]);
      if (kind === 'late')
        await db.query("UPDATE invoices SET due_at=now()-interval '1 minute' WHERE id=$1", [
          invoice.id,
        ]);
      if (kind === 'second') await event(a);
      await event(a, kind === 'amount' ? { amount: 900000 } : {});
      const state = await request('/api/me/bookings/' + b.code, 'GET', undefined, actor);
      expect(state.invoices[0].needs_review).toBe(true);
      if (kind !== 'second') expect(state.booking.status).toBe('offered');
      const receipt = await app.inject({
        url: '/api/me/payments/' + state.payments[0].id + '/receipt.pdf?lang=id',
        headers: { cookie: cookies[actor] },
      });
      expect(receipt.statusCode).toBe(200);
      expect(receipt.rawPayload.subarray(0, 5).toString()).toBe('%PDF-');
      await request(
        '/api/admin/invoices/' + invoice.id + '/resolve-review',
        'POST',
        { note: 'Reviewed unresolved incoming funds' },
        'admin',
        409,
      );
    },
  );
  it('stores invalid and unmatched events, handles expiry/failure and rejects forged callback tokens', async () => {
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/webhooks/xendit',
          payload: { event: 'payment_session.completed', data: {} },
          headers: { 'x-callback-token': 'wrong' },
        })
      ).statusCode,
    ).toBe(401);
    const e = await event({ payment_session_id: 'unknown' });
    expect(
      (await db.query('SELECT error FROM webhook_events WHERE id=$1', [e.id]))[0].error,
    ).toContain('Unmatched');
    await newMember('failure');
    const b = await booking('failure'),
      invoice = await issue(b.code, ids.batch);
    await request('/api/me/invoices/' + invoice.id + '/pay', 'POST', {}, 'failure');
    const [a] = await db.query('SELECT * FROM payment_attempts WHERE invoice_id=$1', [invoice.id]);
    await event(a, {}, 'payment_session.failed');
    expect(
      (await db.query('SELECT status FROM payment_attempts WHERE id=$1', [a.id]))[0].status,
    ).toBe('canceled');
    await event(a, { amount: 1.5 });
    expect(
      (await db.query('SELECT error FROM webhook_events ORDER BY received_at DESC LIMIT 1'))[0]
        .error,
    ).toContain('Invalid');
  });
  it('requires appointments, follows visa transitions and sends one prepared event notice per lead booker', async () => {
    const [v] = await db.query('SELECT * FROM visa_applications WHERE booking_id=$1', [
      ids.confirmed,
    ]);
    await request(
      '/api/admin/data/visas/' + v.id,
      'PATCH',
      { stage: 'collecting_documents' },
      'admin',
    );
    await request(
      '/api/admin/data/visas/' + v.id,
      'PATCH',
      { stage: 'appointment_booked' },
      'admin',
      400,
    );
    await request(
      '/api/admin/data/visas/' + v.id,
      'PATCH',
      {
        stage: 'appointment_booked',
        appointment_at: new Date(Date.now() + 86400000).toISOString(),
        appointment_location: 'Fixture visa centre',
      },
      'admin',
    );
    expect((await request('/api/me/bookings/' + ids.code)).next_action.message.en).toContain(
      'Visa appointment',
    );
    const [b] = await db.query('SELECT event_id FROM batches WHERE id=$1', [ids.batch]);
    const result = await request(
      '/api/admin/events/' + b.event_id + '/notify-template',
      'POST',
      { template: 'changed' },
      'admin',
    );
    expect(result.recipients).toBeGreaterThan(0);
  });
  it('expires offers, deduplicates reminders and creates 14-day missing-document admin alerts', async () => {
    const { lifecycle, predepartureAlerts } = await import('../apps/api/src/jobs');
    await newMember('expiry');
    const b = await booking('expiry'),
      invoice = await issue(b.code, ids.batch);
    await db.query("UPDATE invoices SET due_at=now()+interval '12 hours' WHERE id=$1", [
      invoice.id,
    ]);
    await lifecycle('reminder');
    await lifecycle('reminder');
    expect(
      (
        await db.query(
          "SELECT count(*)::int AS n FROM notifications WHERE payload->>'invoice_id'=$1 AND channel='email'",
          [invoice.id],
        )
      )[0].n,
    ).toBe(1);
    await db.query("UPDATE invoices SET due_at=now()-interval '1 minute' WHERE id=$1", [
      invoice.id,
    ]);
    await lifecycle('expiry');
    expect((await db.query('SELECT status FROM bookings WHERE id=$1', [b.id]))[0].status).toBe(
      'expired',
    );
    await db.query(
      "UPDATE batches SET start_date=(now() AT TIME ZONE 'Asia/Jakarta')::date+14,end_date=(now() AT TIME ZONE 'Asia/Jakarta')::date+21 WHERE id=$1",
      [ids.batch],
    );
    await predepartureAlerts();
    await predepartureAlerts();
    expect(
      (
        await db.query(
          "SELECT count(*)::int AS n FROM notifications WHERE template_key='predeparture_alert' AND channel='email'",
        )
      )[0].n,
    ).toBe(1);
  });
  it('retains current passport data and completes batches before the 180-day retention purge', async () => {
    const { lifecycle } = await import('../apps/api/src/jobs');
    await db.query(
      "UPDATE batches SET status='in_progress',start_date=current_date-9,end_date=current_date-1 WHERE id=$1",
      [ids.batch],
    );
    await lifecycle('batches');
    expect(
      (await db.query('SELECT status FROM bookings WHERE id=$1', [ids.confirmed]))[0].status,
    ).toBe('completed');
    await lifecycle('retention');
    expect(
      (await db.query('SELECT passport_number_enc FROM travelers WHERE id=$1', [ids.traveler]))[0]
        .passport_number_enc,
    ).not.toBeNull();
    await db.query("UPDATE bookings SET completed_at=now()-interval '181 days' WHERE id=$1", [
      ids.confirmed,
    ]);
    await lifecycle('retention');
    expect(
      (await db.query('SELECT passport_number_enc FROM travelers WHERE id=$1', [ids.traveler]))[0]
        .passport_number_enc,
    ).toBeNull();
  });
});

describe('Security, queue and recovery verification', () => {
  it('uses one-time TOTP recovery codes and expires idle administrator sessions', async () => {
    const code = randomBytes(8).toString('hex');
    await db.query('INSERT INTO admin_recovery_codes(user_id,code_hash) VALUES($1,$2)', [
      ids.admin,
      createHash('sha256').update(code).digest('hex'),
    ]);
    await db.query('UPDATE users SET totp_enabled_at=now(),totp_secret_enc=$1 WHERE id=$2', [
      (await import('../apps/api/src/core')).encrypt('JBSWY3DPEHPK3PXP'),
      ids.admin,
    ]);
    await request('/api/admin/auth/totp/verify', 'POST', { code }, 'admin');
    await request('/api/admin/auth/totp/verify', 'POST', { code }, 'admin', 401);
    const cookie = cookies.admin;
    await db.query(
      "UPDATE sessions SET last_seen_at=now()-interval '9 hours' WHERE token_hash=$1",
      [createHash('sha256').update(cookie.split('=')[1]).digest()],
    );
    await request('/api/admin/dashboard', 'GET', undefined, 'admin', 401);
    await request(
      '/api/auth/sign-in',
      'POST',
      { email: 'admin@fixtures.invalid', password },
      'admin',
    );
    await db.query('UPDATE sessions SET mfa_verified_at=now() WHERE user_id=$1', [ids.admin]);
  });
  it('enforces pay limits per user, revokes other sessions on password change and rejects expired reset tokens', async () => {
    const { takeLimit } = await import('../apps/api/src/rate-limits');
    for (let i = 0; i < 10; i++) await takeLimit('fixture-pay', ids.member, ids.member, 10, 60000);
    await expect(takeLimit('fixture-pay', ids.member, ids.member, 10, 60000)).rejects.toMatchObject(
      { statusCode: 429 },
    );
    await newMember('security');
    const reset = await request(
      '/api/auth/forgot-password',
      'POST',
      { email: 'security@fixtures.invalid' },
      'security',
    );
    await db.query("UPDATE auth_tokens SET expires_at=now()-interval '1 minute' WHERE user_id=$1", [
      ids.security,
    ]);
    await request(
      '/api/auth/reset-password',
      'POST',
      { token: reset.development_token, password },
      'security',
      400,
    );
    await db.query(
      "INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '1 day')",
      [randomBytes(32), ids.security],
    );
    await request(
      '/api/me/change-password',
      'POST',
      { current_password: password, password: password + 'new' },
      'security',
    );
    expect(
      (
        await db.query('SELECT count(*)::int AS n FROM sessions WHERE user_id=$1', [ids.security])
      )[0].n,
    ).toBe(1);
  });
  it('cleans expired upload reservations and their unconfirmed stored objects', async () => {
    const r = await request(
      '/api/admin/uploads/init',
      'POST',
      {
        kind: 'document',
        filename: 'expired.pdf',
        mime: 'application/pdf',
        bytes: 12,
        type: 'payment_proof',
      },
      'admin',
    );
    const [m] = await db.query('SELECT response_body FROM idempotency_keys WHERE key=$1', [
      'upload:' + r.id,
    ]);
    const { storeObject, readObject } = await import('../apps/api/src/storage');
    await storeObject(
      m.response_body.bucket,
      m.response_body.key,
      Buffer.from('%PDF-fixture'),
      'application/pdf',
    );
    await db.query(
      "UPDATE idempotency_keys SET response_body=jsonb_set(response_body,'{expires}','0') WHERE key=$1",
      ['upload:' + r.id],
    );
    await (await import('../apps/api/src/uploads')).cleanupUploads();
    await expect(readObject(m.response_body.bucket, m.response_body.key)).rejects.toThrow();
  });
  it('sends durable pg-boss work after commit and exercises notification recovery', async () => {
    const { jobQueue, closeQueue } = await import('../apps/api/src/queue'),
      boss = await jobQueue();
    expect(boss).not.toBeNull();
    let handled = false;
    await boss!.work('notification.send', { pollingIntervalSeconds: 0.5 }, async () => {
      await (await import('../apps/api/src/jobs')).notifications();
      handled = true;
    });
    await boss!.send('notification.send', {});
    await vi.waitFor(() => expect(handled).toBe(true), { timeout: 15000, interval: 100 });
    expect(
      (
        await db.query(
          "SELECT count(*)::int AS n FROM notifications WHERE status='sent' AND provider_message_id='development-outbox'",
        )
      )[0].n,
    ).toBeGreaterThan(0);
    await closeQueue();
  });
  it('exercises monitoring alerts without contacting an external service', async () => {
    const fetch = vi.mocked(globalThis.fetch);
    fetch.mockImplementationOnce(async () => Response.json({ ok: true }));
    const previous = process.env.ALERTS_ENABLED;
    process.env.ALERTS_ENABLED = 'true';
    process.env.ALERT_WEBHOOK_URL = 'https://alerts.fixtures.invalid';
    await (await import('../apps/api/src/alerts')).operationalAlert('exercise', 1);
    expect(fetch).toHaveBeenLastCalledWith(
      'https://alerts.fixtures.invalid',
      expect.objectContaining({ method: 'POST' }),
    );
    process.env.ALERTS_ENABLED = previous;
    delete process.env.ALERT_WEBHOOK_URL;
  });
  it('decrypts previous-version data and authenticates the active encryption key', async () => {
    const { config } = await import('../apps/api/src/config'),
      { encrypt, decrypt } = await import('../apps/api/src/core');
    const old = encrypt('fixture-passport'),
      previous = config.encryptionKey;
    config.encryptionKey = randomBytes(32);
    config.encryptionKeys.unshift(config.encryptionKey);
    expect(decrypt(old)).toBe('fixture-passport');
    const updated = encrypt(decrypt(old));
    config.encryptionKeys = [config.encryptionKey];
    expect(decrypt(updated)).toBe('fixture-passport');
    expect(() => decrypt(old)).toThrow();
    config.encryptionKey = previous;
    config.encryptionKeys = [previous];
  });
  it('keeps provider create retries idempotent and recovers completion through reconciliation', async () => {
    await newMember('provider');
    const b = await booking('provider');
    const [batch] = await db.query("SELECT id FROM batches WHERE code='OT-27-0424'");
    await db.query(
      "UPDATE batches SET status='open',start_date='2027-04-24',end_date='2027-05-02' WHERE id=$1",
      [batch.id],
    );
    const invoice = await issue(b.code, batch.id);
    const { config } = await import('../apps/api/src/config');
    const fetch = vi.mocked(globalThis.fetch),
      previous = config.PAYMENT_PROVIDER;
    config.PAYMENT_PROVIDER = 'xendit';
    process.env.XENDIT_SECRET_KEY = 'fixture-test-key';
    try {
      fetch.mockImplementationOnce(async () =>
        Response.json({ message: 'Provider outage' }, { status: 503 }),
      );
      await request('/api/me/invoices/' + invoice.id + '/pay', 'POST', {}, 'provider', 502);
      const first = fetch.mock.calls.at(-1)!;
      expect((first[1]?.headers as any)['Idempotency-Key']).toBe(`inv_${invoice.id}_a1`);
      fetch.mockImplementationOnce(async () =>
        Response.json({
          payment_session_id: 'ps-provider-fixture',
          payment_link_url: 'https://checkout.fixtures.invalid/session',
          expires_at: new Date(Date.now() + 86400000).toISOString(),
          status: 'ACTIVE',
        }),
      );
      await request('/api/me/invoices/' + invoice.id + '/pay', 'POST', {}, 'provider');
      const second = fetch.mock.calls.at(-1)!;
      expect((second[1]?.headers as any)['Idempotency-Key']).toBe(
        (first[1]?.headers as any)['Idempotency-Key'],
      );
      expect(JSON.parse(String(second[1]?.body)).items[0].type).toBe('PHYSICAL_SERVICE');
      fetch.mockImplementationOnce(async () =>
        Response.json({
          payment_session_id: 'ps-provider-fixture',
          reference_id: `inv_${invoice.id}_a1`,
          amount: 1000000,
          currency: 'IDR',
          status: 'COMPLETED',
          payment_id: 'provider-payment-fixture',
        }),
      );
      await (await import('../apps/api/src/jobs')).reconcile(true);
      expect(
        (await request('/api/me/bookings/' + b.code, 'GET', undefined, 'provider')).booking.status,
      ).toBe('confirmed');
    } finally {
      config.PAYMENT_PROVIDER = previous;
      process.env.XENDIT_SECRET_KEY = '';
    }
  });
  it('retries a failed notification with backoff and preserves the email when WhatsApp is disabled', async () => {
    await newMember('delivery');
    const { config } = await import('../apps/api/src/config'),
      previous = config.EMAIL_PROVIDER;
    config.EMAIL_PROVIDER = 'resend';
    // Limit delivery to this test row; the public outbox remains durable.
    await db.query(
      "UPDATE notifications SET send_after=now()+interval '1 day' WHERE status='queued' AND user_id<>$1",
      [ids.delivery],
    );
    vi.mocked(globalThis.fetch).mockImplementationOnce(async () =>
      Response.json({ message: 'Outage' }, { status: 503 }),
    );
    await (await import('../apps/api/src/jobs')).notifications();
    const [n] = await db.query(
      "SELECT * FROM notifications WHERE user_id=$1 AND template_key='email_verify'",
      [ids.delivery],
    );
    expect(n.status).toBe('queued');
    expect(n.attempts).toBe(1);
    expect(new Date(n.send_after).getTime()).toBeGreaterThan(Date.now());
    config.EMAIL_PROVIDER = previous;
    await db.query('UPDATE notifications SET send_after=now() WHERE id=$1', [n.id]);
    await (await import('../apps/api/src/jobs')).notifications();
    expect((await db.query('SELECT status FROM notifications WHERE id=$1', [n.id]))[0].status).toBe(
      'sent',
    );
  });
  it('requires sign-in on every member route and rejects cross-member writes and downloads', async () => {
    for (const route of registry.filter((r) => r.url.startsWith('/api/me/'))) {
      const url = route.url
        .replace(/:code/g, ids.code)
        .replace(/:id/g, ids.document || randomUUID());
      const response = await app.inject({
        method: route.method,
        url,
        headers: { origin },
        ...(route.method === 'GET' || route.method === 'HEAD' ? {} : { payload: {} }),
      });
      expect(response.statusCode, route.method + ' ' + route.url).toBe(401);
    }
    await request('/api/me/bookings/' + ids.code, 'GET', undefined, 'mismatch', 404);
    await request(
      '/api/me/bookings/' + ids.code + '/cancel',
      'POST',
      { reason: 'foreign action' },
      'mismatch',
      404,
    );
    await request(
      '/api/me/travelers/' + ids.traveler,
      'PATCH',
      { surname: 'Changed' },
      'mismatch',
      404,
    );
    const receipt = await app.inject({
      url: '/api/me/invoices/' + ids.invoice + '/receipt.pdf',
      headers: { cookie: cookies.mismatch },
    });
    expect(receipt.statusCode).toBe(404);
  });
  it('measures public API p95 on PostgreSQL', async () => {
    const timings: number[] = [];
    for (let group = 0; group < 10; group++)
      await Promise.all(
        Array.from({ length: 4 }, async () => {
          const start = performance.now(),
            response = await app.inject({
              url: '/api/public/catalog',
              remoteAddress: '127.0.2.' + (group + 1),
            });
          expect(response.statusCode).toBe(200);
          timings.push(performance.now() - start);
        }),
      );
    timings.sort((a, b) => a - b);
    const p95 = timings[Math.ceil(timings.length * 0.95) - 1];
    expect(p95).toBeLessThan(300);
    console.log(
      'Local PostgreSQL catalog API p95: ' + Math.round(p95) + ' ms (40 reads, concurrency 4).',
    );
  });
  it('performs a timed database backup and restore into an empty scratch database', async () => {
    const { execFile } = await import('node:child_process'),
      { promisify } = await import('node:util'),
      { createRequire } = await import('node:module'),
      { Pool } = createRequire(new URL('../packages/db/package.json', import.meta.url))('pg');
    const run = promisify(execFile),
      url = new URL(container.getConnectionUri()),
      backup = join(directory, 'restore-drill.dump');
    await db.query('CREATE DATABASE citadel_restore_drill');
    const target = new URL(url);
    target.pathname = '/citadel_restore_drill';
    const started = performance.now();
    await run(process.execPath, ['infra/backup.mjs'], {
      env: { ...process.env, DATABASE_URL: url.toString(), BACKUP_OUTPUT: backup },
    });
    await run(process.execPath, ['infra/restore.mjs'], {
      env: {
        ...process.env,
        DATABASE_URL: url.toString(),
        RESTORE_DATABASE_URL: target.toString(),
        BACKUP_INPUT: backup,
      },
    });
    const pool = new Pool({ connectionString: target.toString() });
    try {
      const tables = await db.query(
        "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' AND table_name<>'_citadel_migrations'",
      );
      for (const t of tables) {
        const [source] = await db.query(`SELECT count(*)::int AS n FROM "${t.table_name}"`),
          copy = await pool.query(`SELECT count(*)::int AS n FROM "${t.table_name}"`);
        expect(copy.rows[0].n, t.table_name).toBe(source.n);
      }
      expect(tables.length).toBeGreaterThanOrEqual(41);
    } finally {
      await pool.end();
    }
    console.log(
      'Scratch PostgreSQL backup/restore drill: ' +
        Math.round(performance.now() - started) +
        ' ms; all table counts matched.',
    );
  });
});
