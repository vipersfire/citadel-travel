import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID, randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
const requireApi = createRequire(new URL('../apps/api/package.json', import.meta.url));
const { authenticator } = requireApi('otplib');
let app: any,
  db: any,
  closeDb: any,
  directory: string,
  pkg: any,
  batch: any,
  booking: any,
  invoice: any,
  approval: any;
const cookies: Record<string, string> = {},
  password = randomBytes(24).toString('hex'),
  origin = 'http://localhost:4493';
const proof = {
  services: [{ id: 'Hotel sesuai penawaran', en: 'Hotel as offered' }],
  exclusions: [{ id: 'Visa', en: 'Visa' }],
  ticket_category: { id: 'Tribun utara', en: 'North stand' },
  seating_policy: { id: 'Sesuai alokasi', en: 'Subject to allocation' },
  change_terms: {
    id: 'Hubungi Citadel jika jadwal berubah',
    en: 'Contact Citadel if the schedule changes',
  },
  cancellation_terms: { id: 'Ketentuan pembatalan penawaran', en: 'Offer cancellation terms' },
};
const checks = Object.fromEntries(
  [
    'supplier_confirmation',
    'quotation_price',
    'ticket_source_category',
    'event_date_status',
    'services_exclusions',
    'terms_attached',
  ].map((k) => [k, { passed: true, note: 'TEST FIXTURE ONLY: ' + k }]),
);
async function call(path: string, method = 'GET', body?: any, actor = 'admin', expected = 200) {
  const r = await app.inject({
    url: path,
    method,
    headers: { origin, cookie: cookies[actor] || '', 'idempotency-key': randomUUID() },
    ...(body === undefined ? {} : { payload: body }),
  });
  const cookie = r.headers['set-cookie'];
  if (cookie) cookies[actor] = (Array.isArray(cookie) ? cookie[0] : cookie).split(';')[0];
  expect(r.statusCode, method + ' ' + path + ': ' + r.body).toBe(expected);
  return r.headers['content-type']?.includes('application/json') ? r.json() : r.body;
}
const offer = (extra: any = {}) => ({
  batch_id: batch.id,
  confirm_amount: '1000000',
  lines: [{ description: { id: 'Paket', en: 'Package' }, quantity: 1, unit_amount: 1000000 }],
  due_at: new Date(Date.now() + 86400000).toISOString(),
  offer_details: proof,
  readiness_checks: checks,
  ...extra,
});
beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'citadel-v2-'));
  Object.assign(process.env, {
    LOG_LEVEL: process.env.LOG_LEVEL || 'silent',
    APP_ENV: 'development',
    APP_ORIGIN: origin,
    DATABASE_URL: '',
    PGLITE_DIR: directory,
    LOCAL_FILES_DIR: join(directory, 'files'),
    LOCAL_MEDIA_DIR: join(directory, 'media'),
    PAYMENT_PROVIDER: 'development',
    EMAIL_PROVIDER: 'development',
    WHATSAPP_ENABLED: 'false',
    TURNSTILE_SECRET: '',
    SENTRY_DSN: '',
    SEED_ADMIN_EMAIL: 'admin@v2.invalid',
    SEED_ADMIN_PASSWORD: password,
    CLOUDFLARE_ZONE_ID: '',
    CLOUDFLARE_API_TOKEN: '',
    R2_ACCOUNT_ID: '',
    R2_ACCESS_KEY_ID: '',
    R2_SECRET_ACCESS_KEY: '',
  });
  ({ app } = await import('../apps/api/src/server'));
  ({ db, closeDb } = await import('../packages/db/src/index'));
  await app.ready();
  await call('/api/auth/sign-in', 'POST', { email: 'admin@v2.invalid', password });
  const enroll = await call('/api/admin/auth/totp/enroll', 'POST', {});
  await call('/api/admin/auth/totp/verify', 'POST', {
    code: authenticator.generate(enroll.secret),
  });
  const sign = await call(
    '/api/auth/sign-up',
    'POST',
    {
      full_name: 'V2 Member',
      email: 'member@v2.invalid',
      password,
      whatsapp_e164: '+628123456789',
      locale: 'en',
    },
    'member',
  );
  await call('/api/auth/verify-email', 'POST', { token: sign.development_token }, 'member');
  [pkg] = await db.query("SELECT * FROM packages WHERE code='OT'");
  [batch] = await db.query('SELECT * FROM batches WHERE package_id=$1 ORDER BY code LIMIT 1', [
    pkg.id,
  ]);
}, 60000);
afterAll(async () => {
  await app?.close();
  await closeDb?.();
  if (directory)
    await rm(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
});
describe.sequential('V2 plan compliance', () => {
  it('seeds exactly six draft sport products and hides every draft endpoint', async () => {
    const rows = await db.query('SELECT code,sport,readiness,status FROM packages');
    expect(rows).toHaveLength(6);
    expect(rows.every((p: any) => p.sport && p.status === 'draft' && p.readiness === 'draft')).toBe(
      true,
    );
    expect((await call('/api/public/catalog')).packages).toHaveLength(0);
    await call('/api/public/packages/old-trafford', 'GET', undefined, 'member', 404);
  });
  it('blocks readiness without evidence and protects publication claims', async () => {
    const res = await call(
      '/api/admin/packages/' + pkg.id + '/readiness',
      'POST',
      { readiness: 'ready_to_offer' },
      'admin',
      409,
    );
    expect(res.error.code).toBe('readiness_incomplete');
    await call(
      '/api/admin/data/pages',
      'POST',
      {
        slug: 'blocked-claim',
        title: { id: 'Mitra resmi', en: 'Official partner' },
        status: 'published',
      },
      'admin',
      422,
    );
    const page = await call('/api/admin/data/pages', 'POST', {
      slug: 'approved-claim',
      title: { id: 'Mitra resmi', en: 'Official partner' },
      status: 'published',
      claims_reason: 'TEST ONLY: signed supporting evidence',
    });
    const [audit] = await db.query(
      "SELECT after FROM audit_logs WHERE entity_id=$1 AND action='pages.create'",
      [page.id],
    );
    expect(audit.after.claims_reason).toContain('signed');
  });
  it('publishes interest-only without exposing dates or supplier proof', async () => {
    await call('/api/admin/data/packages/' + pkg.id, 'PATCH', {
      readiness: 'interest_only',
      status: 'published',
      sales_rights_note: 'PRIVATE SUPPLIER',
      quotation_ref: 'PRIVATE QUOTE',
      rights_reason: 'Staging placeholder only',
    });
    const catalog = await call('/api/public/catalog');
    expect(catalog.packages).toHaveLength(1);
    for (const path of [
      '/api/public/catalog',
      '/api/public/packages',
      '/api/public/packages/old-trafford',
      '/api/public/season',
    ]) {
      const data = await call(path);
      const content = JSON.stringify(data);
      expect(content).not.toContain('PRIVATE');
      expect(content).not.toContain('2027-03-13');
      expect(content).not.toContain('supplier_verified');
    }
    expect(
      catalog.events.every(
        (e: any) => e.starts_on === null && e.ends_on === null && e.date_status === 'tba',
      ),
    ).toBe(true);
  });
  it('accepts the four enquiry fields, preserves attribution and keeps clicks separate', async () => {
    const lead = await call(
      '/api/public/leads',
      'POST',
      {
        name: 'Interested fan',
        whatsapp_e164: '+628123456789',
        package_id: pkg.id,
        party_size: 2,
        locale: 'en',
        landing_path: '/en/trips/old-trafford',
        utm_source: 'fixture',
      },
      'guest',
    );
    const [row] = await db.query('SELECT * FROM leads WHERE id=$1', [lead.id]);
    expect(row.email).toBeNull();
    expect(row.interest_kind).toBe('concept');
    expect(row.utm_source).toBe('fixture');
    expect(row.party_size).toBe(2);
    await call(
      '/api/public/events',
      'POST',
      { events: [{ name: 'whatsapp_click', locale: 'en', path: '/en' }] },
      'guest',
    );
    expect((await db.query('SELECT id FROM leads')).length).toBe(1);
    await call('/api/public/events', 'POST', { events: [{ name: 'payment_valid' }] }, 'guest', 422);
    expect(
      (await db.query('SELECT anon_session_id FROM analytics_events')).every(
        (r: any) => r.anon_session_id === null,
      ),
    ).toBe(true);
  });
  it('requires qualification details, records first response and rejects fake team proof', async () => {
    const [lead] = await db.query('SELECT * FROM leads');
    await call('/api/admin/leads/' + lead.id + '/qualify', 'POST', {}, 'admin', 409);
    await call('/api/admin/data/leads/' + lead.id, 'PATCH', { status: 'contacted' });
    const [updated] = await db.query('SELECT * FROM leads WHERE id=$1', [lead.id]);
    expect(updated.first_response_at).toBeTruthy();
    await call('/api/admin/leads/' + lead.id + '/qualify', 'POST', {}, 'admin', 409);
    await call('/api/admin/data/leads/' + lead.id, 'PATCH', { preferred_period: 'Flexible' });
    await call('/api/admin/leads/' + lead.id + '/qualify', 'POST', {});
    await call(
      '/api/admin/data/team',
      'POST',
      { name: 'Test', role: { id: 'Test' }, status: 'published' },
      'admin',
      422,
    );
  });
  it('rejects requests for interest-only and allows ready products only with evidence', async () => {
    const t = await call(
      '/api/me/travelers',
      'POST',
      { given_names: 'Member', surname: 'Test' },
      'member',
    );
    const request = {
      package_id: pkg.id,
      travelers: [{ traveler_id: t.id }],
      room_preference: 'twin',
    };
    await call('/api/me/bookings', 'POST', request, 'member', 409);
    await call('/api/admin/data/events/' + batch.event_id, 'PATCH', { date_status: 'tba' });
    await call('/api/admin/data/packages/' + pkg.id, 'PATCH', {
      rights_reason: 'Staging placeholder only',
      supplier_verified_at: new Date().toISOString(),
      coverage_verified_at: new Date().toISOString(),
      sales_rights_note: 'TEST FIXTURE ONLY: supplier sales-rights proof',
      terms: { id: 'Terms' },
      proof_points: [
        { key: 'ticket', label: { id: 'Kategori' }, value: { id: 'Terverifikasi untuk fixture' } },
      ],
    });
    await call('/api/admin/packages/' + pkg.id + '/readiness', 'POST', {
      readiness: 'ready_to_offer',
    });
    booking = await call('/api/me/bookings', 'POST', request, 'member');
    await call('/api/admin/data/batches/' + batch.id, 'PATCH', {
      status: 'open',
      start_date: '2027-03-11',
      end_date: '2027-03-15',
      min_pax: 1,
    });
    await call('/api/admin/bookings/' + booking.code + '/status', 'POST', { status: 'reviewing' });
  });
  it('requires six evidence notes and member approval before creating a checkout', async () => {
    await call(
      '/api/admin/bookings/' + booking.code + '/offer',
      'POST',
      offer({ readiness_checks: {} }),
      'admin',
      409,
    );
    const draft = await call(
      '/api/admin/bookings/' + booking.code + '/offer',
      'POST',
      offer({ issue_now: false, readiness_checks: {} }),
    );
    expect(draft.status).toBe('draft');
    expect(draft.readiness_confirmed_at).toBeNull();
    const privateTrip = await call('/api/me/bookings/' + booking.code, 'GET', undefined, 'member');
    expect(privateTrip.invoices).toHaveLength(0);
    expect(
      Number(
        (await db.query('SELECT held FROM batch_seat_counts WHERE batch_id=$1', [batch.id]))[0]
          .held,
      ),
    ).toBe(0);
    await call(
      '/api/admin/invoices/' + draft.id + '/issue',
      'POST',
      { confirm_amount: '1000000' },
      'admin',
      409,
    );
    await call(
      '/api/admin/invoices/' + draft.id + '/readiness/supplier_confirmation',
      'POST',
      { passed: true, note: '   ' },
      'admin',
      422,
    );
    for (const [key, check] of Object.entries(checks))
      await call('/api/admin/invoices/' + draft.id + '/readiness/' + key, 'POST', check);
    invoice = await call('/api/admin/invoices/' + draft.id + '/issue', 'POST', {
      confirm_amount: '1000000',
    });
    expect(invoice.id).toBe(draft.id);

    expect(invoice.offer_snapshot.total).toBe(1000000);
    expect(invoice.offer_snapshot.event.date_status).toBe('tba');
    await call('/api/me/invoices/' + invoice.id + '/pay', 'POST', {}, 'member', 409);
    expect(await db.query('SELECT id FROM payment_attempts')).toHaveLength(0);
    approval = await call(
      '/api/me/invoices/' + invoice.id + '/approve',
      'POST',
      { locale: 'en', offer_version: 1 },
      'member',
    );
    expect(approval.snapshot.total).toBe(1000000);
    const again = await call(
      '/api/me/invoices/' + invoice.id + '/approve',
      'POST',
      { locale: 'en', offer_version: 1 },
      'member',
    );
    expect(again.id).toBe(approval.id);
    const a = await call('/api/me/invoices/' + invoice.id + '/pay', 'POST', {}, 'member');
    const b = await call('/api/me/invoices/' + invoice.id + '/pay', 'POST', {}, 'member');
    expect(a.url).toBe(b.url);
    const [attempt] = await db.query('SELECT * FROM payment_attempts');
    expect(attempt.approval_id).toBe(approval.id);
  });
  it('keeps approval evidence append-only and rejects attempts without approval at the database', async () => {
    await expect(
      db.query("UPDATE offer_approvals SET locale='id' WHERE id=$1", [approval.id]),
    ).rejects.toThrow('append-only');
    await expect(
      db.query('DELETE FROM offer_approvals WHERE id=$1', [approval.id]),
    ).rejects.toThrow('append-only');
    await expect(
      db.query(
        "INSERT INTO payment_attempts(invoice_id,attempt_no,reference_id,amount,expires_at) VALUES($1,99,'unapproved',1000000,now())",
        [invoice.id],
      ),
    ).rejects.toThrow('approval_required');
  });
  it('replaces approved offers with a new invoice and cancels the old local payment session', async () => {
    const { paymentProvider } = await import('../apps/api/src/payments');
    const { AppError } = await import('../apps/api/src/core');
    const cancel = vi
      .spyOn(paymentProvider, 'cancelCheckout')
      .mockRejectedValueOnce(new AppError('payment_provider', 'Fixture provider outage', 502))
      .mockResolvedValue(undefined);
    await db.query("UPDATE payment_attempts SET provider='xendit' WHERE invoice_id=$1", [
      invoice.id,
    ]);
    await call(
      '/api/admin/bookings/' + booking.code + '/offer',
      'POST',
      offer({ replaces_invoice_id: invoice.id }),
      'admin',
      502,
    );
    expect(
      (await db.query('SELECT status FROM invoices WHERE id=$1', [invoice.id]))[0].status,
    ).toBe('issued');
    const replacement = await call(
      '/api/admin/bookings/' + booking.code + '/offer',
      'POST',
      offer({ replaces_invoice_id: invoice.id }),
    );
    expect(cancel).toHaveBeenCalledTimes(2);
    cancel.mockRestore();
    expect(replacement.offer_version).toBe(2);
    const [old] = await db.query('SELECT * FROM invoices WHERE id=$1', [invoice.id]);
    expect(old.status).toBe('void');
    expect(old.superseded_by).toBe(replacement.id);
    expect(
      (await db.query('SELECT status FROM payment_attempts WHERE invoice_id=$1', [invoice.id]))[0]
        .status,
    ).toBe('canceled');
    expect(
      (await db.query('SELECT snapshot FROM offer_approvals WHERE id=$1', [approval.id]))[0]
        .snapshot.total,
    ).toBe(1000000);
    await call('/api/me/invoices/' + replacement.id + '/pay', 'POST', {}, 'member', 409);
    invoice = replacement;
  });
  it('verifies dates with a source and preserves the exact issued offer in the approval', async () => {
    await call(
      '/api/admin/events/' + batch.event_id + '/verify-date',
      'POST',
      { starts_on: '2027-03-13', ends_on: '2027-03-13' },
      'admin',
      422,
    );
    await call('/api/admin/events/' + batch.event_id + '/verify-date', 'POST', {
      starts_on: '2027-03-13',
      ends_on: '2027-03-13',
      source_url: 'https://fixture.invalid/official-date',
    });
    const events = await call('/api/public/season');
    expect(events.find((e: any) => e.id === batch.event_id).starts_on).toBe('2027-03-13');
    const a = await call(
      '/api/me/invoices/' + invoice.id + '/approve',
      'POST',
      { locale: 'en', offer_version: 2 },
      'member',
    );
    expect(a.snapshot.event.date_status).toBe('tba');
  });
  it('confirms payment independently of tickets and departure and never voids paid invoices', async () => {
    const checkout = await call('/api/me/invoices/' + invoice.id + '/pay', 'POST', {}, 'member');
    const ref = checkout.url.split('/').at(-1);
    await call('/api/dev/checkout/' + ref + '/complete', 'POST', {}, 'member');
    const trip = await call('/api/me/bookings/' + booking.code, 'GET', undefined, 'member');
    expect(trip.booking.status).toBe('confirmed');
    expect(trip.invoices.find((i: any) => i.id === invoice.id).status).toBe('paid');
    expect(trip.batch.ticket_allocation_status).toBe('not_requested');
    expect(trip.batch.departure_confirmed_at).toBeNull();
    await call(
      '/api/admin/invoices/' + invoice.id + '/void',
      'POST',
      { confirm_amount: '1000000', reason: 'Test' },
      'admin',
      409,
    );
  });
  it('supports external-app handover without requiring a PDF and hides supplier details', async () => {
    await call(
      '/api/admin/data/services',
      'POST',
      { batch_id: batch.id, type: 'event_ticket', delivery_method: 'external_app' },
      'admin',
      422,
    );
    let service = await call('/api/admin/data/services', 'POST', {
      batch_id: batch.id,
      type: 'event_ticket',
      delivery_method: 'external_app',
      external_app_name: 'Official ticket app',
      delivery_instructions: { id: 'Buka aplikasi', en: 'Open the app' },
      handover_target_on: '2027-03-10',
      details: { category: 'North stand' },
      supplier_ref: 'PRIVATE',
    });
    for (const state of ['requested', 'confirmed', 'issued'])
      service = await call('/api/admin/data/services/' + service.id, 'PATCH', { status: state });
    await call('/api/admin/batches/' + batch.id + '/publish', 'POST', { services: [service.id] });
    const trip = await call('/api/me/bookings/' + booking.code, 'GET', undefined, 'member');
    expect(trip.services[0].delivery_method).toBe('external_app');
    expect(JSON.stringify(trip.services)).not.toContain('PRIVATE');
    expect(trip.documents).toHaveLength(0);
    await call('/api/admin/data/services/' + service.id, 'PATCH', {
      handover_status: 'handed_over',
    });
    expect(
      (await db.query('SELECT handed_over_at FROM services WHERE id=$1', [service.id]))[0]
        .handed_over_at,
    ).toBeTruthy();
  });
  it('records departure confirmation only after the minimum-paid check or an audited reason', async () => {
    await call('/api/admin/data/batches/' + batch.id, 'PATCH', { status: 'closed', min_pax: 2 });
    await call(
      '/api/admin/data/batches/' + batch.id,
      'PATCH',
      { status: 'confirmed' },
      'admin',
      409,
    );
    const result = await call('/api/admin/data/batches/' + batch.id, 'PATCH', {
      status: 'confirmed',
      override_reason: 'TEST ONLY: supplier approved smaller departure',
    });
    expect(result.departure_confirmed_at).toBeTruthy();
    expect(result.ticket_allocation_status).toBe('not_requested');
  });
  it('keeps luxury wording out of public content even with an override reason', async () => {
    await call(
      '/api/admin/data/pages',
      'POST',
      {
        slug: 'forbidden-line',
        title: { id: 'Luxury trips' },
        status: 'published',
        claims_reason: 'A reason cannot override the sport-only catalog',
      },
      'admin',
      422,
    );
  });
  it('computes business-day response targets and purges analytics after thirteen months', async () => {
    const { leadResponseDue, v2Maintenance } = await import('../apps/api/src/v2');
    expect(leadResponseDue('2026-10-23T03:00:00Z').toISOString()).toBe('2026-10-26T03:00:00.000Z');
    await db.query(
      "INSERT INTO analytics_events(name,occurred_at) VALUES('whatsapp_click',now()-interval '14 months')",
    );
    await v2Maintenance('analytics');
    expect(
      await db.query(
        "SELECT id FROM analytics_events WHERE occurred_at<now()-interval '13 months'",
      ),
    ).toHaveLength(0);
  });
  it('preserves changed dates and their previous verified date without moving a departure', async () => {
    await call('/api/admin/events/' + batch.event_id + '/verify-date', 'POST', {
      starts_on: '2027-03-14',
      ends_on: '2027-03-14',
      source_url: 'https://fixture.invalid/changed-date',
    });
    const product = await call('/api/public/packages/old-trafford');
    const event = product.events.find((e: any) => e.id === batch.event_id);
    expect(event.date_status).toBe('changed');
    expect(event.starts_on).toBe('2027-03-14');
    expect(event.previous_starts_on).toBe('2027-03-13');
    expect(
      new Date(
        (await db.query('SELECT start_date FROM batches WHERE id=$1', [batch.id]))[0].start_date,
      )
        .toISOString()
        .slice(0, 10),
    ).toBe('2027-03-11');
  });
  it('exports a funnel without treating WhatsApp clicks as leads', async () => {
    const csv = await call('/api/admin/reports/funnel.csv');
    expect(csv).toContain('numerator,denominator');
    expect(csv).toContain('enquiries,0,');
    expect(csv).toContain('interest,1,');
    expect(csv).toContain('valid_payments,1,');
    expect(csv).not.toContain('whatsapp_click');
  });
});
