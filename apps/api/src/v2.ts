import { purgePublicCache } from './cache.js';
import { idempotent } from './payments.js';
import { config } from './config.js';
import type { Connection, Row } from '@citadel/db';
import { db, transaction } from '@citadel/db';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  publicEvent,
  publicPackage,
  canonicalJson,
  readinessKeys,
  readinessCheckSchema,
  clientAnalyticsSchema,
  offerDetailsSchema,
} from '@citadel/contracts';
import { authenticate } from './auth.js';
import { fail, audit, sha, notify, transition } from './core.js';
export { publicEvent, publicPackage };
export async function analytics(tx: Connection, name: string, fields: Row = {}) {
  await tx.query(
    'INSERT INTO analytics_events(name,anon_session_id,user_id,package_id,lead_id,booking_id,locale,path,utm) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',
    [
      name,
      fields.anon_session_id || null,
      fields.user_id || null,
      fields.package_id || null,
      fields.lead_id || null,
      fields.booking_id || null,
      fields.locale || null,
      fields.path || null,
      JSON.stringify(fields.utm || {}),
    ],
  );
}
export function anonSession(req: FastifyRequest) {
  const value =
    req.cookies.citadel_analytics_consent === 'accepted' ? req.cookies.citadel_anon : undefined;
  return z.uuid().safeParse(value).success ? value : null;
}
export async function requireApproval(tx: Connection, invoice: Row) {
  const [a] = await tx.query(
    'SELECT * FROM offer_approvals WHERE invoice_id=$1 AND offer_version=$2',
    [invoice.id, invoice.offer_version],
  );
  if (
    !a ||
    Number(a.snapshot.total) !== Number(invoice.total) ||
    sha(canonicalJson(a.snapshot)).toString('hex') !== a.snapshot_sha256
  )
    fail('approval_required', 'Review and approve this offer before paying.', 409);
  return a;
}
export async function offerSnapshot(tx: Connection, inv: Row, locale: string) {
  const [booking] = await tx.query('SELECT * FROM bookings WHERE id=$1', [inv.booking_id]);
  const [pkg] = await tx.query('SELECT title FROM packages WHERE id=$1', [booking.package_id]);
  const [event] = await tx.query(
    'SELECT e.* FROM events e JOIN batches b ON b.event_id=e.id WHERE b.id=$1',
    [booking.batch_id],
  );
  const lines = await tx.query(
    'SELECT description,quantity,unit_amount,amount FROM invoice_lines WHERE invoice_id=$1 ORDER BY sort_order,id',
    [inv.id],
  );
  const details = offerDetailsSchema.parse(inv.offer_details);
  const terms = { change: details.change_terms, cancellation: details.cancellation_terms };
  return {
    offer_version: inv.offer_version,
    invoice_number: inv.number,
    currency: inv.currency,
    lines: lines.map((l) => ({
      ...l,
      unit_amount: Number(l.unit_amount),
      amount: Number(l.amount),
    })),
    subtotal: Number(inv.subtotal),
    discount: Number(inv.discount),
    total: Number(inv.total),
    due_at: new Date(inv.due_at).toISOString(),
    package_title: pkg.title,
    ...details,
    event: event ? publicEvent(event) : null,
    terms,
    terms_version: sha(canonicalJson(terms)).toString('hex'),
    locale,
  };
}
export async function checkPackageReadiness(tx: Connection, p: Row) {
  const missing = [];
  if (!p.supplier_verified_at) missing.push('supplier_verification');
  if (!p.coverage_verified_at) missing.push('service_coverage');
  if (!p.sales_rights_note?.trim()) missing.push('sales_rights');
  if (!p.terms?.id?.trim()) missing.push('terms');
  if (!p.proof_points?.length) missing.push('proof_points');
  if (
    !(
      await tx.query(
        "SELECT e.id FROM events e JOIN batches b ON b.event_id=e.id WHERE b.package_id=$1 AND (e.date_verified_at IS NOT NULL OR e.date_status='tba')",
        [p.id],
      )
    ).length
  )
    missing.push('verified_event_or_explicit_tba');
  if (missing.length)
    fail(
      'readiness_incomplete',
      'Complete the package verification before offering this trip.',
      409,
      { missing },
    );
}
export async function claimsGuard(tx: Connection, value: unknown, reason?: string) {
  const [setting] = await tx.query("SELECT value FROM site_settings WHERE key='claims_terms'");
  const words: string[] = [
    ...new Set([
      ...(Array.isArray(setting?.value) ? setting.value : []),
      'first',
      'pertama',
      'official partner',
      'mitra resmi',
      'vip',
      '24 jam',
      '24 hours',
      '24/7',
    ]),
  ];
  const content = JSON.stringify(value).toLowerCase();
  if (/\bluxury\b/.test(content))
    fail(
      'blocked_claim',
      'The catalog is sport-only. Remove luxury product language from public copy.',
      422,
    );
  const blocked = words.filter((term) =>
    new RegExp(
      '(^|[^a-z0-9])' + term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?=$|[^a-z0-9])',
      'i',
    ).test(content),
  );
  if (blocked.length && !reason?.trim())
    fail(
      'blocked_claim',
      'Provide supporting evidence and a reason for the blocked public claim.',
      422,
      { blocked },
    );
  return blocked;
}
export async function recordReadiness(
  tx: Connection,
  invoiceId: string,
  checks: Row,
  userId: string,
) {
  for (const key of readinessKeys) {
    const c = checks[key];
    if (!c?.passed || !c.note?.trim())
      fail('readiness_incomplete', 'All six readiness checks require a pass and a note.', 409, {
        missing: readinessKeys.filter((k) => !checks[k]?.passed || !checks[k]?.note?.trim()),
      });
    await tx.query(
      'INSERT INTO offer_readiness_checks(invoice_id,check_key,passed_at,passed_by,note) VALUES($1,$2,now(),$3,$4) ON CONFLICT(invoice_id,check_key) DO UPDATE SET passed_at=now(),passed_by=excluded.passed_by,note=excluded.note',
      [invoiceId, key, userId, c.note.trim()],
    );
  }
}
export async function v2Routes(app: FastifyInstance) {
  app.addHook('onResponse', async (req, reply) => {
    if (
      reply.statusCode < 300 &&
      req.method === 'POST' &&
      /^\/api\/admin\/(events\/[^/]+\/verify-date|packages\/[^/]+\/readiness)$/.test(req.url)
    )
      void purgePublicCache();
  });
  app.post('/api/admin/invoices/:id/issue', async (req) => {
    const u = await authenticate(req, true);
    const body = z.object({ confirm_amount: z.string() }).strict().parse(req.body);
    return idempotent(req, async (tx) => {
      const [inv] = await tx.query('SELECT * FROM invoices WHERE id=$1 FOR UPDATE', [
        (req.params as any).id,
      ]);
      if (!inv) fail('not_found', 'Invoice not found.', 404);
      if (inv.status !== 'draft')
        fail('invalid_transition', 'Only draft offers can be issued.', 409);
      if (new Date(inv.due_at).getTime() <= Date.now())
        fail('invalid_deadline', 'Choose a future payment deadline.');
      const [booking] = await tx.query('SELECT * FROM bookings WHERE id=$1 FOR UPDATE', [
        inv.booking_id,
      ]);
      if (inv.kind === 'package') transition('booking', booking.status, 'offered');
      else if (booking.status !== 'confirmed')
        fail('invalid_transition', 'Supplements require a confirmed booking.', 409);
      const [batch] = await tx.query('SELECT * FROM batches WHERE id=$1 FOR UPDATE', [
        booking.batch_id,
      ]);
      if (!batch || !['open', 'closed', 'confirmed'].includes(batch.status))
        fail('invalid_batch', 'Assign an available departure before issuing.', 409);
      const travelers = await tx.query(
        'SELECT traveler_id FROM booking_travelers WHERE booking_id=$1 AND removed_at IS NULL',
        [booking.id],
      );
      const [seats] = await tx.query('SELECT remaining FROM batch_seat_counts WHERE batch_id=$1', [
        batch.id,
      ]);
      if (inv.kind === 'package' && Number(seats.remaining) < travelers.length)
        fail('capacity', 'The departure does not have enough seats.', 409);
      if (
        (
          await tx.query(
            "SELECT bt.id FROM booking_travelers bt JOIN bookings b ON b.id=bt.booking_id WHERE b.batch_id=$1 AND b.id<>$2 AND b.status IN ('offered','confirmed') AND bt.removed_at IS NULL AND bt.traveler_id=ANY($3::uuid[])",
            [batch.id, booking.id, travelers.map((t) => t.traveler_id)],
          )
        ).length
      )
        fail(
          'duplicate_traveler',
          'A traveler already has an active booking in this departure.',
          409,
        );
      const lines = await tx.query('SELECT * FROM invoice_lines WHERE invoice_id=$1', [inv.id]);
      const subtotal = lines.reduce((n, l) => n + Number(l.quantity) * Number(l.unit_amount), 0);
      if (
        !lines.length ||
        subtotal !== Number(inv.subtotal) ||
        subtotal - Number(inv.discount) !== Number(inv.total) ||
        body.confirm_amount !== String(inv.total)
      )
        fail('confirmation_required', 'Type the exact server-calculated invoice total.');
      offerDetailsSchema.parse(inv.offer_details);
      const checks = await tx.query('SELECT * FROM offer_readiness_checks WHERE invoice_id=$1', [
        inv.id,
      ]);
      const missing = readinessKeys.filter(
        (k) =>
          !checks.some((c) => c.check_key === k && c.passed_at && c.passed_by && c.note?.trim()),
      );
      if (missing.length)
        fail('readiness_incomplete', 'Complete all six readiness checks with notes.', 409, {
          missing,
        });
      const [seq] = await tx.query("SELECT nextval('invoice_number_seq') as n");
      const number = `INV-${new Date().getFullYear()}-${String(seq.n).padStart(6, '0')}`;
      const [issued] = await tx.query(
        "UPDATE invoices SET number=$1,status='issued',issued_at=now(),issued_by=$2,readiness_confirmed_at=now(),readiness_confirmed_by=$2,updated_at=now() WHERE id=$3 RETURNING *",
        [number, u.id, inv.id],
      );
      if (inv.kind === 'package')
        await tx.query(
          "UPDATE bookings SET status='offered',offered_at=now(),updated_at=now() WHERE id=$1",
          [booking.id],
        );
      issued.offer_snapshot = await offerSnapshot(tx, issued, 'id');
      await tx.query('UPDATE invoices SET offer_snapshot=$1 WHERE id=$2', [
        JSON.stringify(issued.offer_snapshot),
        issued.id,
      ]);
      await analytics(tx, 'offer_issued', {
        user_id: booking.user_id,
        package_id: booking.package_id,
        booking_id: booking.id,
      });
      await audit(tx, req, 'invoice.issue', 'invoice', inv.id, inv, issued);
      const [member] = await tx.query('SELECT locale FROM users WHERE id=$1', [booking.user_id]);
      await notify(tx, booking.user_id, 'offer_ready', booking.id, {
        message: number,
        url: `${config.APP_ORIGIN}/${member.locale}/account/trips/${booking.code}/payments`,
      });
      return issued;
    });
  });

  app.get('/api/admin/services/overdue', async (req) => {
    await authenticate(req, true);
    return { rows: await overdueHandovers() };
  });
  app.get('/api/admin/leads/overdue', async (req) => {
    await authenticate(req, true);
    return { rows: await overdueLeads() };
  });
  app.patch('/api/admin/services/:id/handover', async (req) => {
    await authenticate(req, true);
    const b = z
      .object({
        handover_target_on: z.iso.date().nullable().optional(),
        handover_status: z.enum(['planned', 'handed_over', 'not_applicable']).optional(),
      })
      .strict()
      .parse(req.body);
    return transaction(async (tx) => {
      const [old] = await tx.query('SELECT * FROM services WHERE id=$1 FOR UPDATE', [
        (req.params as any).id,
      ]);
      if (!old) fail('not_found', 'Service not found.', 404);
      if (b.handover_status && b.handover_status !== old.handover_status)
        transition('service_handover', old.handover_status, b.handover_status);
      const [updated] = await tx.query(
        "UPDATE services SET handover_target_on=$1,handover_status=$2,handed_over_at=CASE WHEN $2='handed_over' THEN coalesce(handed_over_at,now()) ELSE handed_over_at END,updated_at=now() WHERE id=$3 RETURNING *",
        [
          'handover_target_on' in b ? b.handover_target_on : old.handover_target_on,
          b.handover_status || old.handover_status,
          old.id,
        ],
      );
      await audit(tx, req, 'service.handover', 'services', old.id, old, updated);
      if (
        b.handover_status === 'handed_over' &&
        old.handover_status !== 'handed_over' &&
        updated.published_at
      ) {
        for (const booking of await tx.query(
          "SELECT DISTINCT ON(user_id) id,user_id FROM bookings WHERE batch_id=$1 AND ($2::uuid IS NULL OR id=$2) AND status='confirmed' ORDER BY user_id,requested_at",
          [old.batch_id, old.booking_id],
        ))
          await notify(tx, booking.user_id, 'trip_updated', booking.id, {
            message: {
              id: 'Layanan perjalanan telah diserahkan.',
              en: 'Your travel service has been handed over.',
            },
          });
      }
      return updated;
    });
  });
  app.post(
    '/api/public/events',
    { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
    async (req) => {
      const body = clientAnalyticsSchema.parse(req.body);
      await transaction(async (tx) => {
        for (const event of body.events) {
          if (
            event.package_id &&
            !(
              await tx.query(
                "SELECT id FROM packages WHERE id=$1 AND status='published' AND readiness<>'draft'",
                [event.package_id],
              )
            ).length
          )
            continue;
          await analytics(tx, event.name, { ...event, anon_session_id: anonSession(req) });
        }
      });
      return { ok: true };
    },
  );
  app.get('/api/public/season', async () =>
    (
      await db.query(
        "SELECT DISTINCT e.*,p.id as package_id,p.slug,p.title as package_title,p.readiness FROM events e JOIN batches b ON b.event_id=e.id JOIN packages p ON p.id=b.package_id WHERE p.status='published' AND p.readiness<>'draft' ORDER BY e.starts_on NULLS LAST",
      )
    )
      .map(publicEvent)
      .sort((a: any, b: any) => (a.starts_on || '9999').localeCompare(b.starts_on || '9999')),
  );
  app.get('/api/me/invoices/:id/approval', async (req) => {
    const u = await authenticate(req);
    if (!u.email_verified_at) fail('email_unverified', 'Verify your email first.', 403);
    const [i] = await db.query('SELECT id FROM invoices WHERE id=$1 AND user_id=$2', [
      (req.params as any).id,
      u.id,
    ]);
    if (!i) fail('not_found', 'Invoice not found.', 404);
    const [approval] = await db.query(
      'SELECT id,invoice_id,offer_version,snapshot,snapshot_sha256,terms_version,locale,approved_at FROM offer_approvals WHERE invoice_id=$1',
      [i.id],
    );
    return { approval: approval || null };
  });
  app.post('/api/me/invoices/:id/approve', async (req) => {
    const u = await authenticate(req);
    if (!u.email_verified_at) fail('email_unverified', 'Verify your email first.', 403);
    const body = z
      .object({ locale: z.enum(['id', 'en']), offer_version: z.number().int().positive() })
      .strict()
      .parse(req.body);
    return transaction(async (tx) => {
      const [inv] = await tx.query('SELECT * FROM invoices WHERE id=$1 AND user_id=$2 FOR UPDATE', [
        (req.params as any).id,
        u.id,
      ]);
      if (!inv) fail('not_found', 'Invoice not found.', 404);
      if (
        inv.status !== 'issued' ||
        new Date(inv.due_at).getTime() <= Date.now() ||
        !inv.readiness_confirmed_at ||
        body.offer_version !== inv.offer_version
      )
        fail('invoice_not_payable', 'This offer has expired or was replaced.', 409);
      const [existing] = await tx.query(
        'SELECT id,invoice_id,offer_version,snapshot,snapshot_sha256,terms_version,locale,approved_at FROM offer_approvals WHERE invoice_id=$1',
        [inv.id],
      );
      if (existing) return existing;
      if (!inv.offer_snapshot)
        fail(
          'readiness_incomplete',
          'This offer needs to be reissued with its complete review details.',
          409,
        );
      const snapshot = { ...inv.offer_snapshot, locale: body.locale };
      const [approval] = await tx.query(
        'INSERT INTO offer_approvals(invoice_id,booking_id,user_id,offer_version,snapshot,snapshot_sha256,terms_version,locale,ip,user_agent) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id,invoice_id,offer_version,snapshot,snapshot_sha256,terms_version,locale,approved_at',
        [
          inv.id,
          inv.booking_id,
          u.id,
          inv.offer_version,
          JSON.stringify(snapshot),
          sha(canonicalJson(snapshot)).toString('hex'),
          snapshot.terms_version,
          body.locale,
          req.ip,
          req.headers['user-agent'] || null,
        ],
      );
      await analytics(tx, 'offer_approved', {
        user_id: u.id,
        booking_id: inv.booking_id,
        locale: body.locale,
      });
      return approval;
    });
  });
  app.post('/api/admin/invoices/:id/readiness/:key', async (req) => {
    const u = await authenticate(req, true);
    const key = z.enum(readinessKeys).parse((req.params as any).key);
    const body = readinessCheckSchema.parse(req.body);
    return transaction(async (tx) => {
      const [inv] = await tx.query(
        "SELECT * FROM invoices WHERE id=$1 AND status='draft' FOR UPDATE",
        [(req.params as any).id],
      );
      if (!inv) fail('invalid_transition', 'Only draft offers can change readiness.', 409);
      const [check] = await tx.query(
        'INSERT INTO offer_readiness_checks(invoice_id,check_key,passed_at,passed_by,note) VALUES($1,$2,$3,$4,$5) ON CONFLICT(invoice_id,check_key) DO UPDATE SET passed_at=excluded.passed_at,passed_by=excluded.passed_by,note=excluded.note RETURNING *',
        [inv.id, key, body.passed ? new Date() : null, u.id, body.note],
      );
      await audit(tx, req, 'offer.readiness', 'invoice', inv.id, null, check);
      return check;
    });
  });
  app.post('/api/admin/events/:id/verify-date', async (req) => {
    const u = await authenticate(req, true);
    const body = z
      .object({
        starts_on: z.iso.date(),
        ends_on: z.iso.date(),
        source_url: z.url(),
        note: z.string().max(4000).optional(),
      })
      .strict()
      .parse(req.body);
    if (body.ends_on < body.starts_on)
      fail('invalid_date', 'End date must follow start date.', 422);
    return transaction(async (tx) => {
      const [old] = await tx.query('SELECT * FROM events WHERE id=$1 FOR UPDATE', [
        (req.params as any).id,
      ]);
      if (!old) fail('not_found', 'Event not found.', 404);
      const [e] = await tx.query(
        'UPDATE events SET starts_on=$1,ends_on=$2,source_url=$3,date_source_note=$4,date_verified_at=now(),date_verified_by=$5,date_status=$7,updated_at=now() WHERE id=$6 RETURNING *',
        [
          body.starts_on,
          body.ends_on,
          body.source_url,
          body.note || null,
          u.id,
          old.id,
          old.date_status === 'changed' ||
          (old.date_verified_at &&
            new Date(old.starts_on).toISOString().slice(0, 10) !== body.starts_on)
            ? 'changed'
            : 'confirmed',
        ],
      );
      await audit(tx, req, 'events.verify_date', 'events', old.id, old, e);
      return e;
    });
  });
  app.post('/api/admin/packages/:id/readiness', async (req) => {
    await authenticate(req, true);
    const body = z
      .object({ readiness: z.enum(['draft', 'interest_only', 'ready_to_offer']) })
      .strict()
      .parse(req.body);
    return transaction(async (tx) => {
      const [p] = await tx.query('SELECT * FROM packages WHERE id=$1 FOR UPDATE', [
        (req.params as any).id,
      ]);
      if (!p) fail('not_found', 'Package not found.', 404);
      if (body.readiness === 'ready_to_offer') await checkPackageReadiness(tx, p);
      const [updated] = await tx.query(
        "UPDATE packages SET readiness=$1::package_readiness,status=CASE WHEN $1::text='draft' THEN 'draft'::publish_status ELSE status END,updated_at=now() WHERE id=$2 RETURNING *",
        [body.readiness, p.id],
      );
      await audit(tx, req, 'package.readiness', 'packages', p.id, p, updated);
      return updated;
    });
  });
  app.post('/api/admin/leads/:id/qualify', async (req) => {
    const u = await authenticate(req, true);
    return transaction(async (tx) => {
      const [lead] = await tx.query('SELECT * FROM leads WHERE id=$1 FOR UPDATE', [
        (req.params as any).id,
      ]);
      if (!lead) fail('not_found', 'Lead not found.', 404);
      if (lead.status !== 'contacted')
        fail('invalid_transition', 'Contact the lead before qualifying.', 409);
      if (
        !(lead.package_id || lead.sport || lead.concept_label) ||
        !lead.party_size ||
        !lead.preferred_period?.trim() ||
        !(lead.whatsapp_e164 || lead.email)
      )
        fail(
          'qualification_incomplete',
          'Record event interest, party size, date range and an actionable contact.',
          409,
        );
      const [updated] = await tx.query(
        "UPDATE leads SET status='qualified',qualified_at=now(),qualified_by=$1,updated_at=now() WHERE id=$2 RETURNING *",
        [u.id, lead.id],
      );
      await audit(tx, req, 'lead.qualify', 'leads', lead.id, lead, updated);
      return updated;
    });
  });
  app.get('/api/admin/reports/funnel.csv', async (req, reply) => {
    await authenticate(req, true);
    const rows = await db.query(
      'SELECT name,count(*)::int as n FROM analytics_events GROUP BY name',
    );
    const count = (name: string) => rows.find((r) => r.name === name)?.n || 0;
    const [qualified] = await db.query(
      'SELECT count(*)::int as n FROM leads WHERE qualified_at IS NOT NULL',
    );
    const [timing] = await db.query(
      'SELECT avg(extract(epoch from(first_response_at-created_at))) as response_seconds FROM leads WHERE first_response_at IS NOT NULL',
    );
    const [offerTime] = await db.query(
      'SELECT avg(extract(epoch from(offered_at-requested_at))) as offer_seconds FROM bookings WHERE offered_at IS NOT NULL',
    );
    const stages = [
      ['product_views', count('product_view'), null],
      ['enquiries', count('enquiry_submitted'), count('product_view')],
      ['interest', count('interest_submitted'), count('product_view')],
      ['qualified_leads', qualified.n, count('enquiry_submitted') + count('interest_submitted')],
      ['offers_issued', count('offer_issued'), qualified.n],
      ['offers_approved', count('offer_approved'), count('offer_issued')],
      ['valid_payments', count('payment_valid'), count('offer_approved')],
    ];
    reply
      .type('text/csv; charset=utf-8')
      .header('Content-Disposition', 'attachment; filename="funnel.csv"');
    return (
      '\uFEFFstage,numerator,denominator,first_response_seconds,offer_issue_seconds\r\n' +
      stages
        .map((r) => [...r, timing.response_seconds || '', offerTime.offer_seconds || ''].join(','))
        .join('\r\n')
    );
  });
}

// One business day: preserve WIB wall time, skipping Saturday and Sunday.
export function leadResponseDue(created: string | Date) {
  const d = new Date(created);
  do {
    d.setUTCDate(d.getUTCDate() + 1);
  } while ([0, 6].includes(new Date(d.getTime() + 7 * 3600000).getUTCDay()));
  return d;
}
export async function overdueHandovers() {
  return db.query(
    "SELECT id,batch_id,booking_id,type,title,handover_target_on FROM services WHERE handover_status='planned' AND handover_target_on<(now() AT TIME ZONE 'Asia/Jakarta')::date ORDER BY handover_target_on",
  );
}
export async function overdueLeads(): Promise<Row[]> {
  return (
    await db.query(
      "SELECT id,name,created_at FROM leads WHERE first_response_at IS NULL AND status IN ('new','contacted','qualified') ORDER BY created_at",
    )
  )
    .filter((l) => leadResponseDue(l.created_at).getTime() < Date.now())
    .map((l) => ({ ...l, response_due_at: leadResponseDue(l.created_at).toISOString() }));
}
export async function v2Maintenance(kind = 'all') {
  if (kind === 'all' || kind === 'analytics')
    await db.query("DELETE FROM analytics_events WHERE occurred_at<now()-interval '13 months'");
  // The dashboard reads current overdue lists. This job also writes one alert per
  // affected service/lead rather than sending the same alert every hour.
  const records = [
    ...(kind === 'all' || kind === 'handover' ? await overdueHandovers() : []).map((r) => ({
      id: r.id,
      kind: 'handover',
      message: 'Overdue service handover: ' + r.type,
    })),
    ...(kind === 'all' || kind === 'leads' ? await overdueLeads() : []).map((r) => ({
      id: r.id,
      kind: 'lead_response',
      message: 'Enquiry awaits a first human response: ' + r.name,
    })),
  ];
  if (records.length)
    await transaction(async (tx) => {
      for (const r of records)
        for (const admin of await tx.query(
          "SELECT id FROM users WHERE role='admin' AND status='active'",
        )) {
          const alert = r.kind + ':' + r.id;
          const [existing] = await tx.query(
            "SELECT id FROM notifications WHERE user_id=$1 AND payload->>'alert_id'=$2",
            [admin.id, alert],
          );
          if (!existing)
            await notify(tx, admin.id, 'batch_message', null, {
              alert_id: alert,
              message: r.message,
            });
        }
    });
}
