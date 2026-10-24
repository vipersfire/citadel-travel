import {
  publicPackage,
  publicEvent,
  anonSession,
  analytics,
  recordReadiness,
  overdueHandovers,
  overdueLeads,
  offerSnapshot,
} from './v2.js';
import { inputSchemas } from '@citadel/contracts/requests';
import type { FastifyInstance } from 'fastify';
import { db, transaction, type Row } from '@citadel/db';
import { z } from 'zod';
import {
  travelerSchema,
  requestSchema,
  offerSchema,
  memberService,
  memberBooking,
  memberInvoice,
  profileSchema,
  publicPageSchema,
} from '@citadel/contracts';
import { authenticate, botCheck } from './auth.js';
import {
  audit,
  fail,
  notify,
  ownedBooking,
  publicTraveler,
  publicUser,
  encrypt,
  decrypt,
  transition,
} from './core.js';
import { cancelInvoiceAttempts, idempotent } from './payments.js';
import { config } from './config.js';
import { roster, nextAction } from './workspaces.js';
import { publicMediaUrl } from './storage.js';
import { wake } from './queue.js';
import { warmPublishedPdf } from './pdf-cache.js';
const json = (v: any) => (v === undefined ? null : JSON.stringify(v));
async function packageVideo(id: string, mobile = false) {
  const [video] = await db.query("SELECT * FROM media_assets WHERE id=$1 AND kind='video'", [id]);
  if (!video) return null;
  return publicMediaUrl(
    mobile && video.bucket === 'bundled'
      ? video.storage_key.replace(/\.mp4$/, '-mobile.mp4')
      : video.storage_key,
    video.bucket,
  );
}
async function mediaForPackage(p: Row) {
  if (!p.hero_media_id) return p;
  const [media] = await db.query('SELECT * FROM media_assets WHERE id=$1', [p.hero_media_id]);
  if (!media) return p;
  const key =
    media.variants.find((v: any) => v.width === 1600 && v.format === 'webp')?.key ||
    media.storage_key;
  const url = publicMediaUrl(key, media.bucket);
  return {
    ...p,
    seo: { ...p.seo, image: url },
    hero_alt: media.alt,
    hero_video: p.hero_video_id ? await packageVideo(p.hero_video_id) : null,
    hero_video_mobile: p.hero_video_id ? await packageVideo(p.hero_video_id, true) : null,
    hero_variants: media.variants.map((v: any) => ({
      ...v,
      url: publicMediaUrl(v.key, media.bucket),
    })),
    hero_blur: media.blur_data_url,
    hero_focal_x: media.focal_x,
    hero_focal_y: media.focal_y,
  };
}
export async function batchChecklist(id: string) {
  const [batch] = await db.query('SELECT * FROM batches WHERE id=$1', [id]);
  if (!batch) fail('not_found', 'Batch not found.', 404);
  const roster = await db.query(
    "SELECT t.*,b.id as booking_id,b.code FROM travelers t JOIN booking_travelers bt ON bt.traveler_id=t.id JOIN bookings b ON b.id=bt.booking_id WHERE b.batch_id=$1 AND b.status='confirmed' AND bt.removed_at IS NULL",
    [id],
  );
  const result = [];
  for (const traveler of roster) {
    const services = await db.query(
      'SELECT type,status,published_at,delivery_method,handover_status,handover_target_on FROM services WHERE batch_id=$1 AND (booking_id IS NULL OR booking_id=$2) AND (traveler_id IS NULL OR traveler_id=$3)',
      [id, traveler.booking_id, traveler.id],
    );
    const docs = await db.query(
      "SELECT type FROM documents WHERE status='published' AND type<>'payment_proof' AND (booking_id=$1 OR (booking_id IS NULL AND batch_id=$2)) AND (traveler_id IS NULL OR traveler_id=$3)",
      [traveler.booking_id, id, traveler.id],
    );
    const visas = await db.query(
      'SELECT stage FROM visa_applications WHERE booking_id=$1 AND traveler_id=$2',
      [traveler.booking_id, traveler.id],
    );
    const missing = [];
    for (const type of ['flight', 'hotel', 'event_ticket'])
      if (
        !services.some(
          (s) => s.type === type && ['confirmed', 'issued'].includes(s.status) && s.published_at,
        )
      )
        missing.push(type + ' arrangement');
    for (const type of ['flight_ticket', 'hotel_voucher', 'event_ticket'])
      if (
        !(
          type === 'event_ticket' &&
          services.some(
            (s) =>
              s.type === 'event_ticket' &&
              s.published_at &&
              ['external_app', 'wallet', 'paper', 'in_person'].includes(s.delivery_method),
          )
        ) &&
        !docs.some((d) => d.type === type)
      )
        missing.push(type.replaceAll('_', ' ') + ' document');
    for (const service of services)
      if (
        service.handover_status === 'planned' &&
        service.handover_target_on &&
        String(service.handover_target_on) < new Date().toISOString().slice(0, 10)
      )
        missing.push(service.type + ' handover overdue');
    if (!visas.length || visas.some((v) => !['approved', 'not_required'].includes(v.stage)))
      missing.push('visa approval');
    if (
      (
        await db.query(
          "SELECT id FROM invoices WHERE booking_id=$1 AND kind='supplement' AND status='issued'",
          [traveler.booking_id],
        )
      ).length
    )
      missing.push('unpaid supplement');
    const expiry = new Date(batch.end_date);
    expiry.setMonth(expiry.getMonth() + 6);
    if (!traveler.passport_expiry || new Date(traveler.passport_expiry) < expiry)
      missing.push('passport validity');
    result.push({
      traveler_id: traveler.id,
      name: traveler.given_names + ' ' + traveler.surname,
      code: traveler.code,
      missing,
    });
  }
  return result;
}
export async function routes(app: FastifyInstance) {
  app.get('/api/admin/members/:id', async (req) => {
    await authenticate(req, true);
    const id = z.uuid().parse((req.params as any).id);
    const [user] = await db.query("SELECT * FROM users WHERE id=$1 AND role='member'", [id]);
    if (!user) fail('not_found', 'Member not found.', 404);
    return {
      user: publicUser(user),
      travelers: (
        await db.query('SELECT * FROM travelers WHERE owner_user_id=$1 AND deleted_at IS NULL', [
          id,
        ])
      ).map(publicTraveler),
      bookings: await db.query(
        'SELECT b.*,p.title FROM bookings b JOIN packages p ON p.id=b.package_id WHERE b.user_id=$1 ORDER BY requested_at DESC',
        [id],
      ),
      invoices: await db.query('SELECT * FROM invoices WHERE user_id=$1 ORDER BY created_at DESC', [
        id,
      ]),
      notifications: await db.query(
        'SELECT template_key,channel,status,sent_at FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100',
        [id],
      ),
    };
  });
  app.get('/api/admin/batches/:id/checklist', async (req) => {
    await authenticate(req, true);
    const id = z.uuid().parse((req.params as any).id);
    return batchChecklist(id);
  });
  app.get('/healthz', async () => {
    await db.query('SELECT 1');
    return { status: 'ok' };
  });
  app.get('/api/healthz', async () => ({ status: 'ok' }));
  app.get('/api/public/catalog', async () => ({
    packages: await Promise.all(
      (
        await db.query(
          "SELECT * FROM packages WHERE status='published' AND readiness<>'draft' ORDER BY sort_order,code",
        )
      ).map(async (p) => publicPackage(await mediaForPackage(p))),
    ),
    events: (
      await db.query(
        "SELECT DISTINCT e.*,(SELECT before->>'starts_on' FROM audit_logs WHERE entity_id=e.id::text AND action IN ('events.update','events.verify_date') AND before->>'date_verified_at' IS NOT NULL ORDER BY created_at DESC LIMIT 1) AS previous_starts_on,b.package_id,p.slug,p.title as package_title,p.subtitle,p.seo,p.readiness FROM events e JOIN batches b ON b.event_id=e.id JOIN packages p ON p.id=b.package_id WHERE p.status='published' AND p.readiness<>'draft' ORDER BY starts_on",
      )
    ).map(publicEvent),
    pages: await db.query("SELECT slug FROM content_pages WHERE status='published' ORDER BY slug"),
    addons: await db.query("SELECT * FROM addons WHERE status='published'"),
    testimonials: await db.query(
      "SELECT quote,author_name,author_context FROM testimonials WHERE status='published' AND consent_on_file=true ORDER BY sort_order",
    ),
    settings: await db.query(
      "SELECT key,value FROM site_settings WHERE key IN ('contact','default_og_image','brand','social','trust_line_enabled')",
    ),
    team: (
      await db.query(
        "SELECT t.name,t.role,t.bio,m.storage_key,m.bucket FROM team_members t LEFT JOIN media_assets m ON m.id=t.photo_media_id WHERE t.status='published' AND t.verified_at IS NOT NULL ORDER BY t.sort_order",
      )
    ).map((t) => ({
      name: t.name,
      role: t.role,
      bio: t.bio,
      photo_url: t.storage_key ? publicMediaUrl(t.storage_key, t.bucket) : null,
    })),
    sections: await db.query(
      "SELECT * FROM home_sections WHERE status='published' ORDER BY sort_order",
    ),
  }));
  app.get('/api/public/packages', async (req) => {
    const q = req.query as any;
    return (
      await db.query(
        "SELECT * FROM packages WHERE status='published' AND readiness<>'draft' AND ($1::text IS NULL OR sport::text=$1) AND ($2::text IS NULL OR readiness::text=$2) ORDER BY sort_order",
        [q.sport || null, q.readiness || null],
      )
    ).map(publicPackage);
  });
  app.get('/api/public/packages/:slug', async (req) => {
    const [p] = await db.query(
      "SELECT * FROM packages WHERE slug=$1 AND status='published' AND readiness<>'draft'",
      [(req.params as any).slug],
    );
    if (!p) fail('not_found', 'Journey not found.', 404);
    return {
      ...publicPackage(await mediaForPackage(p)),
      options: await db.query(
        'SELECT * FROM package_options WHERE package_id=$1 AND active ORDER BY sort_order',
        [p.id],
      ),
      itinerary: await db.query(
        'SELECT * FROM package_itinerary_days WHERE package_id=$1 ORDER BY day_number',
        [p.id],
      ),
      events: (
        await db.query(
          "SELECT DISTINCT e.*,(SELECT before->>'starts_on' FROM audit_logs WHERE entity_id=e.id::text AND action IN ('events.update','events.verify_date') AND before->>'date_verified_at' IS NOT NULL ORDER BY created_at DESC LIMIT 1) AS previous_starts_on FROM events e JOIN batches b ON b.event_id=e.id WHERE b.package_id=$1 ORDER BY starts_on",
          [p.id],
        )
      ).map(publicEvent),
      batches: await db.query(
        "SELECT id,code,title,start_date,end_date,event_id,capacity,status,ticket_allocation_status,ticket_allocation_note,departure_confirmed_at FROM batches WHERE package_id=$1 AND status='open' AND (request_cutoff IS NULL OR request_cutoff>=current_date)",
        [p.id],
      ),
      addons: await db.query(
        "SELECT a.* FROM addons a LEFT JOIN package_addons pa ON pa.addon_id=a.id WHERE a.status='published' AND (a.applies_to_all OR pa.package_id=$1)",
        [p.id],
      ),
      faqs: await db.query(
        "SELECT * FROM faqs WHERE status='published' AND (package_id=$1 OR package_id IS NULL) ORDER BY sort_order",
        [p.id],
      ),
    };
  });
  app.get('/api/public/pages/*', async (req) => {
    const [page] = await db.query(
      "SELECT * FROM content_pages WHERE slug=$1 AND status='published' AND readiness<>'draft'",
      [(req.params as any)['*']],
    );
    return {
      page: page ? publicPageSchema.parse(page) : null,
      faqs: await db.query(
        "SELECT * FROM faqs WHERE package_id IS NULL AND status='published' ORDER BY sort_order",
      ),
    };
  });
  app.post(
    '/api/public/leads',
    { config: { rateLimit: { max: 3, timeWindow: '10 minutes' } } },
    async (req) => {
      const b = inputSchemas.routes_public_leads_b.parse(req.body);
      await botCheck(b.turnstile_token);
      const [lead] = await transaction(async (tx) => {
        let pkg: any;
        if (b.package_id) {
          [pkg] = await tx.query(
            "SELECT id,readiness FROM packages WHERE id=$1 AND status='published' AND readiness<>'draft'",
            [b.package_id],
          );
          if (!pkg) fail('not_found', 'Journey not found.', 404);
        }
        const kind = pkg?.readiness === 'interest_only' ? 'concept' : b.interest_kind;
        const [lead] = await tx.query(
          'INSERT INTO leads(name,email,whatsapp_e164,package_id,message,locale,ip,party_size,interest_kind,sport,preferred_period,budget_note,concept_label,landing_path,referrer,utm_source,utm_medium,utm_campaign,utm_content,utm_term,anon_session_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21) RETURNING *',
          [
            b.name,
            b.email || null,
            b.whatsapp_e164,
            b.package_id || null,
            b.message,
            b.locale,
            req.ip,
            b.party_size,
            kind,
            b.sport || null,
            b.preferred_period || null,
            b.budget_note || null,
            b.concept_label || null,
            b.landing_path || null,
            b.referrer || null,
            b.utm_source || null,
            b.utm_medium || null,
            b.utm_campaign || null,
            b.utm_content || null,
            b.utm_term || null,
            anonSession(req),
          ],
        );
        await analytics(tx, kind === 'concept' ? 'interest_submitted' : 'enquiry_submitted', {
          lead_id: lead.id,
          package_id: b.package_id,
          locale: b.locale,
          anon_session_id: anonSession(req),
          path: b.landing_path,
        });
        if (b.email)
          await tx.query(
            "INSERT INTO notifications(channel,template_key,locale,to_address,payload) VALUES('email','lead_autoreply',$1,$2,$3)",
            [
              b.locale,
              b.email,
              json({
                name: b.name,
                message:
                  b.locale === 'id'
                    ? 'Kami membalas dalam 1 hari kerja.'
                    : 'We reply within one business day.',
              }),
            ],
          );
        const rows = [lead];
        for (const admin of await tx.query(
          "SELECT id FROM users WHERE role='admin' AND status='active'",
        ))
          await notify(tx, admin.id, 'request_received', null, {
            message: 'New enquiry: ' + b.name,
          });
        return rows;
      });
      return { id: lead.id };
    },
  );
  app.get('/api/me/travelers', async (req) => {
    const u = await authenticate(req);
    return (
      await db.query(
        'SELECT * FROM travelers WHERE owner_user_id=$1 AND deleted_at IS NULL ORDER BY is_self DESC,created_at',
        [u.id],
      )
    ).map(publicTraveler);
  });
  app.post('/api/me/travelers', async (req) => {
    const u = await authenticate(req);
    const b = travelerSchema.parse(req.body);
    const { passport_number, ...fields } = b;
    const [t] = await db.query(
      'INSERT INTO travelers(owner_user_id,given_names,surname,is_self,gender,date_of_birth,nationality,passport_number_enc,passport_number_last3,passport_key_version,passport_expiry,dietary,dietary_notes,medical_notes,relationship) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *',
      [
        u.id,
        fields.given_names,
        fields.surname,
        fields.is_self,
        fields.gender || null,
        fields.date_of_birth || null,
        fields.nationality,
        passport_number ? encrypt(passport_number) : null,
        passport_number?.slice(-3) || null,
        passport_number ? config.encryptionVersion : null,
        fields.passport_expiry || null,
        fields.dietary,
        fields.dietary_notes || null,
        fields.medical_notes || null,
        fields.relationship || null,
      ],
    );
    return publicTraveler(t);
  });
  app.patch('/api/me/travelers/:id', async (req) => {
    const u = await authenticate(req);
    const b = travelerSchema.partial().strict().parse(req.body);
    return transaction(async (tx) => {
      const [t] = await tx.query(
        'SELECT * FROM travelers WHERE id=$1 AND owner_user_id=$2 AND deleted_at IS NULL FOR UPDATE',
        [(req.params as any).id, u.id],
      );
      if (!t) fail('not_found', 'Traveler not found.', 404);
      if (t.locked_at)
        fail(
          'traveler_locked',
          'Details are controlled by admin after confirmation. Contact Citadel.',
          409,
        );
      const fields: Row = { ...b };
      if (fields.passport_number) {
        fields.passport_number_enc = encrypt(fields.passport_number);
        fields.passport_number_last3 = fields.passport_number.slice(-3);
        fields.passport_key_version = config.encryptionVersion;
        delete fields.passport_number;
      }
      if (!Object.keys(fields).length) return publicTraveler(t);
      const keys = Object.keys(fields);
      const [updated] = await tx.query(
        `UPDATE travelers SET ${keys.map((k, i) => `"${k}"=$${i + 1}`).join(',')},updated_at=now() WHERE id=$${keys.length + 1} RETURNING *`,
        [...Object.values(fields), t.id],
      );
      return publicTraveler(updated);
    });
  });
  app.delete('/api/me/travelers/:id', async (req) => {
    const u = await authenticate(req);
    const [t] = await db.query(
      'UPDATE travelers SET deleted_at=now(),updated_at=now() WHERE id=$1 AND owner_user_id=$2 AND locked_at IS NULL RETURNING id',
      [(req.params as any).id, u.id],
    );
    if (!t) fail('traveler_locked', 'Traveler is locked or not found.', 409);
    return { ok: true };
  });
  app.patch('/api/me/profile', async (req) => {
    const u = await authenticate(req);
    const b = profileSchema.parse(req.body);
    const [v] = await db.query(
      'UPDATE users SET full_name=$1,whatsapp_e164=$2,whatsapp_opt_in=$3,locale=$4,updated_at=now() WHERE id=$5 RETURNING *',
      [b.full_name, b.whatsapp_e164, b.whatsapp_opt_in, b.locale, u.id],
    );
    return publicUser(v);
  });
  app.post('/api/me/delete-account', async (req) => {
    const u = await authenticate(req);
    await transaction(async (tx) => {
      await notify(tx, u.id, 'batch_message', null, {
        message: 'Account deletion requested. Citadel will contact you.',
      });
      for (const admin of await tx.query(
        "SELECT id FROM users WHERE role='admin' AND status='active'",
      ))
        await notify(tx, admin.id, 'account_deletion_requested', null, {
          message: {
            id: 'Permintaan penghapusan akun diterima.',
            en: 'Account deletion requested.',
          },
          url: `${config.APP_ORIGIN}/admin/deletion-requests`,
        });
      await audit(tx, req, 'account.deletion_requested', 'user', u.id, null, { requested: true });
    });
    return { ok: true };
  });
  app.get('/api/me/bookings', async (req) => {
    const u = await authenticate(req);
    return (
      await db.query(
        "SELECT b.*,p.title,p.slug,p.seo,ba.start_date,ba.end_date,CASE WHEN e.date_verified_at IS NULL THEN 'tba' ELSE e.date_status::text END as date_status,e.name as event_name FROM bookings b JOIN packages p ON p.id=b.package_id LEFT JOIN batches ba ON ba.id=b.batch_id LEFT JOIN events e ON e.id=ba.event_id WHERE b.user_id=$1 ORDER BY b.created_at DESC",
        [u.id],
      )
    ).map(memberBooking);
  });
  app.post('/api/me/bookings', async (req) => {
    const u = await authenticate(req);
    if (!u.email_verified_at)
      fail('email_unverified', 'Verify your email before requesting a journey.', 403);
    if (!u.whatsapp_e164) fail('phone_required', 'Add your WhatsApp number to your profile first.');
    const b = requestSchema.parse(req.body);
    return transaction(async (tx) => {
      const [pkg] = await tx.query("SELECT * FROM packages WHERE id=$1 AND status='published'", [
        b.package_id,
      ]);
      if (!pkg) fail('not_found', 'Package not found.', 404);
      if (pkg.readiness !== 'ready_to_offer')
        fail(
          'interest_only',
          'This trip is collecting interest. Please use the enquiry form.',
          409,
        );
      if (b.preferred_batch_id) {
        const [batch] = await tx.query(
          "SELECT id FROM batches WHERE id=$1 AND package_id=$2 AND status='open' AND (request_cutoff IS NULL OR request_cutoff>=current_date)",
          [b.preferred_batch_id, pkg.id],
        );
        if (!batch) fail('invalid_batch', 'Select an open departure or choose flexible dates.');
      }
      if (new Set(b.travelers.map((t) => t.traveler_id)).size !== b.travelers.length)
        fail('duplicate_traveler', 'Select each traveler once.');
      for (const t of b.travelers) {
        const [owner] = await tx.query(
          'SELECT id FROM travelers WHERE id=$1 AND owner_user_id=$2 AND deleted_at IS NULL',
          [t.traveler_id, u.id],
        );
        if (!owner) fail('invalid_traveler', 'A selected traveler is not yours.');
        if (
          t.package_option_id &&
          !(
            await tx.query(
              'SELECT id FROM package_options WHERE id=$1 AND package_id=$2 AND active',
              [t.package_option_id, pkg.id],
            )
          ).length
        )
          fail('invalid_option', 'Select an option for this package.');
      }
      const [seq] = await tx.query("SELECT nextval('booking_code_seq') as n");
      const code = `CTD-${new Date().getFullYear().toString().slice(-2)}-${String(seq.n).padStart(5, '0')}`;
      const [booking] = await tx.query(
        'INSERT INTO bookings(code,user_id,package_id,preferred_batch_id,room_preference,member_notes) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',
        [code, u.id, pkg.id, b.preferred_batch_id || null, b.room_preference, b.member_notes],
      );
      for (const [i, t] of b.travelers.entries())
        await tx.query(
          'INSERT INTO booking_travelers(booking_id,traveler_id,package_option_id,is_lead) VALUES($1,$2,$3,$4)',
          [booking.id, t.traveler_id, t.package_option_id || null, i === 0],
        );
      for (const addon of b.addons) {
        if (
          !(
            await tx.query(
              "SELECT a.id FROM addons a LEFT JOIN package_addons pa ON pa.addon_id=a.id WHERE a.id=$1 AND a.status='published' AND (a.applies_to_all OR pa.package_id=$2)",
              [addon, pkg.id],
            )
          ).length
        )
          fail('invalid_addon', 'Add-on is not available.');
        await tx.query(
          "INSERT INTO booking_addons(booking_id,addon_id,state) VALUES($1,$2,'interested')",
          [booking.id, addon],
        );
      }
      const [lead] = await tx.query(
        "SELECT id FROM leads WHERE (email=$1 OR whatsapp_e164=$2) AND status IN ('new','contacted','qualified') ORDER BY created_at DESC LIMIT 1 FOR UPDATE",
        [u.email, u.whatsapp_e164],
      );
      if (lead) {
        await tx.query(
          "UPDATE leads SET user_id=$1,status='converted',updated_at=now() WHERE id=$2",
          [u.id, lead.id],
        );
        await tx.query('UPDATE bookings SET lead_id=$1 WHERE id=$2', [lead.id, booking.id]);
      }
      await notify(tx, u.id, 'request_received', booking.id, {
        message: code,
        url: `${config.APP_ORIGIN}/${u.locale}/account/trips/${code}`,
      });
      return memberBooking(booking);
    });
  });
  app.get('/api/me/bookings/:code', async (req) => {
    const u = await authenticate(req),
      b = await ownedBooking(u.id, (req.params as any).code);
    const [p] = await db.query('SELECT * FROM packages WHERE id=$1', [b.package_id]);
    const [batch] = b.batch_id
      ? await db.query(
          'SELECT id,code,title,start_date,end_date,tour_leader_name,tour_leader_whatsapp,meeting_point,member_notes,event_id,status,ticket_allocation_status,ticket_allocation_note,departure_confirmed_at FROM batches WHERE id=$1',
          [b.batch_id],
        )
      : [];
    const [event] = batch?.event_id
      ? await db.query('SELECT * FROM events WHERE id=$1', [batch.event_id])
      : [];
    const travelers = (
      await db.query(
        'SELECT t.*,bt.package_option_id FROM travelers t JOIN booking_travelers bt ON bt.traveler_id=t.id WHERE bt.booking_id=$1 AND bt.removed_at IS NULL',
        [b.id],
      )
    ).map(publicTraveler);
    const invoices = await db.query(
      "SELECT * FROM invoices WHERE booking_id=$1 AND status<>'draft' ORDER BY created_at DESC",
      [b.id],
    );
    for (const i of invoices) {
      const [approval] = await db.query(
        'SELECT id,invoice_id,offer_version,snapshot,snapshot_sha256,terms_version,locale,approved_at FROM offer_approvals WHERE invoice_id=$1',
        [i.id],
      );
      i.approval = approval || null;
      i.lines = await db.query(
        'SELECT * FROM invoice_lines WHERE invoice_id=$1 ORDER BY sort_order',
        [i.id],
      );
    }
    const booking = memberBooking(b);
    return {
      booking,
      next_action: await nextAction(b, batch),
      package: publicPackage(p),
      batch: batch || null,
      event: event ? publicEvent(event) : null,
      travelers,
      invoices: invoices.map(memberInvoice),
      payments: await db.query(
        'SELECT p.id,p.invoice_id,p.amount,p.currency,p.paid_at FROM payments p JOIN invoices i ON i.id=p.invoice_id WHERE i.booking_id=$1 AND i.user_id=$2 ORDER BY p.paid_at DESC',
        [b.id, u.id],
      ),
      visas: await db.query(
        'SELECT id,traveler_id,destination,stage,appointment_at,appointment_location,checklist,member_note FROM visa_applications WHERE booking_id=$1',
        [b.id],
      ),
      itinerary: b.batch_id
        ? await db.query(
            'SELECT * FROM batch_itinerary_items WHERE batch_id=$1 AND published_at IS NOT NULL ORDER BY day_number,sort_order',
            [b.batch_id],
          )
        : [],
      documents: await db.query(
        "SELECT id,traveler_id,type,title,filename,published_at FROM documents WHERE status='published' AND type<>'payment_proof' AND (booking_id=$1 OR (booking_id IS NULL AND batch_id=$2)) AND (traveler_id IS NULL OR traveler_id=ANY($3::uuid[]))",
        [b.id, b.batch_id, travelers.map((t) => t.id)],
      ),
      services: b.batch_id
        ? (
            await db.query(
              'SELECT * FROM services WHERE batch_id=$1 AND published_at IS NOT NULL AND (booking_id IS NULL OR booking_id=$2) AND (traveler_id IS NULL OR traveler_id=ANY($3::uuid[]))',
              [b.batch_id, b.id, travelers.map((t) => t.id)],
            )
          ).map(memberService)
        : [],
    };
  });
  for (const action of ['cancel', 'decline-offer'])
    app.post(`/api/me/bookings/:code/${action}`, async (req) => {
      const u = await authenticate(req);
      const body = inputSchemas.memberCancel.parse(req.body || {});
      return transaction(async (tx) => {
        let b = await ownedBooking(u.id, (req.params as any).code, tx);
        await tx.query('SELECT id FROM invoices WHERE booking_id=$1 ORDER BY id FOR UPDATE', [
          b.id,
        ]);
        [b] = await tx.query('SELECT * FROM bookings WHERE id=$1 FOR UPDATE', [b.id]);
        if (!['requested', 'reviewing', 'waitlisted', 'offered'].includes(b.status))
          fail('invalid_transition', 'Contact Citadel to change a confirmed journey.', 409);
        for (const invoice of await tx.query(
          "SELECT id FROM invoices WHERE booking_id=$1 AND status='issued'",
          [b.id],
        ))
          await cancelInvoiceAttempts(tx, invoice.id);
        const next = action === 'cancel' ? 'cancelled' : 'declined';
        if (next === 'declined' && b.status !== 'offered')
          fail('invalid_transition', 'There is no offer to decline.', 409);
        await tx.query(
          'UPDATE bookings SET status=$1,cancel_reason=$2,cancelled_at=now(),updated_at=now() WHERE id=$3',
          [next, body.reason, b.id],
        );
        await tx.query(
          "UPDATE invoices SET status='void',voided_at=now(),updated_at=now() WHERE booking_id=$1 AND status='issued'",
          [b.id],
        );
        await tx.query(
          "UPDATE payment_attempts SET status='canceled' WHERE invoice_id IN (SELECT id FROM invoices WHERE booking_id=$1) AND status='active'",
          [b.id],
        );
        return { ok: true };
      });
    });
  app.get('/api/admin/dashboard', async (req) => {
    await authenticate(req, true);
    const [counts] = await db.query(
      `SELECT (SELECT count(*) FROM bookings WHERE status='requested') as requests,(SELECT count(*) FROM invoices WHERE status='issued' AND due_at>now() AND due_at<now()+interval '24 hours') as expiring,(SELECT count(*) FROM invoices WHERE needs_review) as review,(SELECT count(*) FROM batches WHERE start_date BETWEEN current_date AND current_date+14 AND status<>'cancelled') as departures,(SELECT count(*) FROM notifications WHERE status='failed') as failed`,
    );
    return {
      ...counts,
      overdue_handovers: (await overdueHandovers()).length,
      overdue_leads: (await overdueLeads()).length,
    };
  });
  app.get('/api/admin/bookings/:code', async (req) => {
    await authenticate(req, true);
    const [b] = await db.query(
      'SELECT b.*,u.full_name,u.email,p.title FROM bookings b JOIN users u ON u.id=b.user_id JOIN packages p ON p.id=b.package_id WHERE b.code=$1',
      [(req.params as any).code],
    );
    if (!b) fail('not_found', 'Request not found.', 404);
    return {
      ...b,
      travelers: await db.query(
        'SELECT t.id,t.given_names,t.surname,t.passport_expiry,t.dietary,bt.package_option_id FROM travelers t JOIN booking_travelers bt ON bt.traveler_id=t.id WHERE bt.booking_id=$1 AND bt.removed_at IS NULL',
        [b.id],
      ),
      invoices: await db.query(
        'SELECT * FROM invoices WHERE booking_id=$1 ORDER BY created_at DESC',
        [b.id],
      ),
      batches: await db.query(
        'SELECT b.*,s.held,s.confirmed,s.remaining FROM batches b JOIN batch_seat_counts s ON s.batch_id=b.id WHERE b.package_id=$1',
        [b.package_id],
      ),
    };
  });
  app.post('/api/admin/bookings/:code/status', async (req) => {
    await authenticate(req, true);
    const body = inputSchemas.routes_admin_bookings_code_status_body.parse(req.body);
    return transaction(async (tx) => {
      let [b] = await tx.query('SELECT * FROM bookings WHERE code=$1', [(req.params as any).code]);
      if (!b) fail('not_found', 'Request not found.', 404);
      await tx.query('SELECT id FROM invoices WHERE booking_id=$1 ORDER BY id FOR UPDATE', [b.id]);
      [b] = await tx.query('SELECT * FROM bookings WHERE id=$1 FOR UPDATE', [b.id]);
      transition('booking', b.status, body.status);
      const reason =
        typeof body.reason === 'string' ? { id: body.reason, en: body.reason } : body.reason;
      if (body.status === 'declined' && !reason?.id?.trim())
        fail('reason_required', 'Provide a reason in Bahasa Indonesia and optionally English.');
      await tx.query(
        'UPDATE bookings SET status=$1,decline_reason=$2,updated_at=now() WHERE id=$3',
        [body.status, reason ? json(reason) : null, b.id],
      );
      if (body.status === 'cancelled')
        for (const invoice of await tx.query(
          "SELECT id FROM invoices WHERE booking_id=$1 AND status='issued'",
          [b.id],
        ))
          await cancelInvoiceAttempts(tx, invoice.id);
      if (body.status === 'cancelled')
        await tx.query(
          "UPDATE invoices SET status='void',voided_at=now(),updated_at=now() WHERE booking_id=$1 AND status='issued'",
          [b.id],
        );
      if (body.status === 'cancelled')
        await tx.query(
          "UPDATE travelers SET locked_at=null,updated_at=now() WHERE id IN (SELECT traveler_id FROM booking_travelers WHERE booking_id=$1) AND NOT EXISTS (SELECT 1 FROM booking_travelers bt JOIN bookings bk ON bk.id=bt.booking_id WHERE bt.traveler_id=travelers.id AND bk.status='confirmed')",
          [b.id],
        );
      await audit(tx, req, 'booking.status', 'booking', b.id, b, { status: body.status });
      await notify(tx, b.user_id, 'trip_updated', b.id, {
        message: reason || {
          id: 'Status permintaan Anda diperbarui.',
          en: 'Your request status is updated.',
        },
      });
      return { ok: true };
    });
  });
  app.post('/api/admin/bookings/:code/offer', async (req) => {
    const u = await authenticate(req, true),
      body = offerSchema.parse(req.body);
    return idempotent(req, async (tx) => {
      let previous: any;
      if (body.replaces_invoice_id) {
        [previous] = await tx.query(
          "SELECT * FROM invoices WHERE id=$1 AND status='issued' FOR UPDATE",
          [body.replaces_invoice_id],
        );
        if (!previous)
          fail('invalid_transition', 'Only unpaid issued offers can be replaced.', 409);
      }
      const [b] = await tx.query('SELECT * FROM bookings WHERE code=$1 FOR UPDATE', [
        (req.params as any).code,
      ]);
      if (!b) fail('not_found', 'Request not found.', 404);
      if (previous && (previous.booking_id !== b.id || previous.kind !== body.kind))
        fail('invalid_offer', 'Choose an offer from this booking.');
      if (previous && !body.issue_now)
        fail(
          'invalid_transition',
          'Replacement offers are issued after their readiness check.',
          409,
        );
      if (body.kind === 'package' && !previous) transition('booking', b.status, 'offered');
      else if (body.kind === 'supplement' && b.status !== 'confirmed')
        fail('invalid_transition', 'Supplement invoices require a confirmed booking.', 409);
      const [batch] = await tx.query('SELECT * FROM batches WHERE id=$1 FOR UPDATE', [
        body.batch_id,
      ]);
      if (
        !batch ||
        batch.package_id !== b.package_id ||
        !['open', 'closed', 'confirmed'].includes(batch.status)
      )
        fail('invalid_batch', 'Assign an available batch for this package.');
      if (body.kind === 'supplement' && batch.id !== b.batch_id)
        fail('invalid_batch', 'Supplements must use the booking departure.', 409);
      const [seat] = await tx.query('SELECT * FROM batch_seat_counts WHERE batch_id=$1', [
        batch.id,
      ]);
      const travelers = await tx.query(
        'SELECT traveler_id FROM booking_travelers WHERE booking_id=$1 AND removed_at IS NULL',
        [b.id],
      );
      if (
        body.issue_now &&
        body.kind === 'package' &&
        Number(seat.remaining) + (previous && b.batch_id === batch.id ? travelers.length : 0) <
          travelers.length
      )
        fail('capacity', 'The batch does not have enough seats.', 409);
      const duplicates = await tx.query(
        "SELECT bt.traveler_id FROM booking_travelers bt JOIN bookings bk ON bk.id=bt.booking_id WHERE bk.batch_id=$1 AND bk.id<>$2 AND bk.status IN ('offered','confirmed') AND bt.traveler_id=ANY($3::uuid[]) AND bt.removed_at IS NULL",
        [batch.id, b.id, travelers.map((t) => t.traveler_id)],
      );
      if (body.issue_now && duplicates.length)
        fail('duplicate_traveler', 'A traveler already has an active booking in this batch.', 409);
      const subtotal = body.lines.reduce((sum, l) => sum + l.quantity * l.unit_amount, 0),
        total = subtotal - body.discount;
      if (body.confirm_amount !== String(total))
        fail('confirmation_required', 'Type the exact invoice total to confirm.');
      if (!Number.isSafeInteger(total) || total <= 0)
        fail('invalid_total', 'Invoice total must be a positive whole IDR amount.');
      if (new Date(body.due_at).getTime() <= Date.now())
        fail('invalid_deadline', 'Choose a future payment deadline.');
      if (body.issue_now)
        for (const key of [
          'supplier_confirmation',
          'quotation_price',
          'ticket_source_category',
          'event_date_status',
          'services_exclusions',
          'terms_attached',
        ])
          if (!body.readiness_checks[key]?.passed || !body.readiness_checks[key]?.note?.trim())
            fail(
              'readiness_incomplete',
              'Complete all six readiness checks with notes before issuing.',
              409,
              { missing: [key] },
            );
      if (previous) {
        await cancelInvoiceAttempts(tx, previous.id);
        await tx.query(
          "UPDATE invoices SET status='void',voided_at=now(),void_reason='Superseded by a new offer version',updated_at=now() WHERE id=$1",
          [previous.id],
        );
        await tx.query(
          "UPDATE payment_attempts SET status='canceled' WHERE invoice_id=$1 AND status='active'",
          [previous.id],
        );
      }
      const [seq] = await tx.query("SELECT nextval('invoice_number_seq') as n");
      const number = `INV-${new Date().getFullYear()}-${String(seq.n).padStart(6, '0')}`;
      const [inv] = await tx.query(
        'INSERT INTO invoices(number,booking_id,user_id,kind,status,subtotal,discount,total,due_at,allowed_channels,note,issued_at,issued_by,offer_version,offer_details,readiness_confirmed_at,readiness_confirmed_by) VALUES($1,$2,$3,$4,$14,$5,$6,$7,$8,$9,$10,$15,$11,$12,$13,$15,$11) RETURNING *',
        [
          body.issue_now ? number : null,
          b.id,
          b.user_id,
          body.kind,
          subtotal,
          body.discount,
          total,
          body.due_at,
          body.allowed_channels,
          json(body.note),
          body.issue_now ? u.id : null,
          previous ? previous.offer_version + 1 : 1,
          json(body.offer_details),
          body.issue_now ? 'issued' : 'draft',
          body.issue_now ? new Date().toISOString() : null,
        ],
      );
      if (body.issue_now) await recordReadiness(tx, inv.id, body.readiness_checks, u.id);
      else
        for (const key of [
          'supplier_confirmation',
          'quotation_price',
          'ticket_source_category',
          'event_date_status',
          'services_exclusions',
          'terms_attached',
        ])
          await tx.query('INSERT INTO offer_readiness_checks(invoice_id,check_key) VALUES($1,$2)', [
            inv.id,
            key,
          ]);
      if (previous)
        await tx.query('UPDATE invoices SET superseded_by=$1 WHERE id=$2', [inv.id, previous.id]);
      for (const [i, line] of body.lines.entries())
        await tx.query(
          'INSERT INTO invoice_lines(invoice_id,description,quantity,unit_amount,sort_order) VALUES($1,$2,$3,$4,$5)',
          [inv.id, json(line.description), line.quantity, line.unit_amount, i],
        );
      if (!body.issue_now) {
        if (body.kind === 'package')
          await tx.query('UPDATE bookings SET batch_id=$1,updated_at=now() WHERE id=$2', [
            batch.id,
            b.id,
          ]);
        await audit(tx, req, 'invoice.draft', 'invoice', inv.id, null, inv);
        return inv;
      }
      if (body.kind === 'package')
        await tx.query(
          "UPDATE bookings SET status='offered',batch_id=$1,offered_at=now(),updated_at=now() WHERE id=$2",
          [batch.id, b.id],
        );
      inv.offer_snapshot = await offerSnapshot(tx, inv, 'id');
      await tx.query('UPDATE invoices SET offer_snapshot=$1 WHERE id=$2', [
        json(inv.offer_snapshot),
        inv.id,
      ]);
      await analytics(tx, 'offer_issued', {
        user_id: b.user_id,
        booking_id: b.id,
        package_id: b.package_id,
      });
      await audit(tx, req, 'invoice.issue', 'invoice', inv.id, null, inv);
      await notify(tx, b.user_id, 'offer_ready', b.id, {
        message: number,
        url: `${config.APP_ORIGIN}/${(await tx.query('SELECT locale FROM users WHERE id=$1', [b.user_id]))[0].locale}/account/trips/${b.code}/payments`,
      });
      return inv;
    });
  });
  app.get('/api/admin/batches/:id/roster', async (req) => {
    await authenticate(req, true);
    return roster(z.uuid().parse((req.params as any).id));
  });
  app.get('/api/admin/batches/:id/roster.csv', async (req, reply) => {
    await authenticate(req, true);
    const records = await roster(z.uuid().parse((req.params as any).id));
    const rows = records.map((r) => ({
      code: r.code,
      status: r.booking_status,
      payment: r.payment_status,
      given_names: r.given_names,
      surname: r.surname,
      passport_expiry: r.passport_expiry,
      passport_warning: r.passport_warning,
      dietary: r.dietary.join(', '),
      rooms: r.rooms.map((v: any) => `${v.hotel_name || 'Stay'}: ${v.label}`).join('; '),
    }));
    const escape = (v: any) =>
      '"' +
      String(v ?? '')
        .replace(/^[=+@-]/, "'")
        .replaceAll('"', '""') +
      '"';
    reply
      .type('text/csv; charset=utf-8')
      .header('Content-Disposition', 'attachment; filename="roster.csv"');
    return (
      '\uFEFF' +
      [
        'Booking,Status,Payment,Given names,Surname,Passport expiry,Passport warning,Dietary,Rooms',
        ...rows.map((r) => Object.values(r).map(escape).join(',')),
      ].join('\r\n')
    );
  });
  app.post('/api/admin/batches/:id/publish', async (req) => {
    await authenticate(req, true);
    const body = inputSchemas.routes_admin_batches_id_publish_body.parse(req.body);
    const result = await transaction(async (tx) => {
      const id = (req.params as any).id;
      const [batch] = await tx.query('SELECT id FROM batches WHERE id=$1', [id]);
      if (!batch) fail('not_found', 'Batch not found.', 404);
      for (const [table, ids] of [
        ['services', body.services],
        ['documents', body.documents],
        ['batch_itinerary_items', body.itinerary],
      ] as const) {
        if (!ids.length) continue;
        const changed = await tx.query(
          `UPDATE ${table} SET published_at=now()${table === 'documents' ? ",status='published'" : ',updated_at=now()'} WHERE batch_id=$1 AND id=ANY($2::uuid[])${table === 'documents' ? " AND type<>'payment_proof'" : ''} RETURNING id`,
          [id, ids],
        );
        if (changed.length !== ids.length)
          fail('invalid_publish', 'Selected records do not all belong to this batch.');
        await audit(tx, req, 'batch.publish', table, id, null, { ids });
      }
      if (body.services.length + body.documents.length + body.itinerary.length)
        for (const b of await tx.query(
          "SELECT DISTINCT ON(user_id) id,user_id,code FROM bookings WHERE batch_id=$1 AND status='confirmed' ORDER BY user_id,requested_at",
          [id],
        ))
          await notify(tx, b.user_id, 'trip_updated', b.id, {
            message: {
              id: 'Pengaturan perjalanan Anda diperbarui.',
              en: 'Your travel arrangements have been updated.',
            },
            url: `${config.APP_ORIGIN}/id/account/trips/${b.code}`,
          });
      return { ok: true };
    });
    const batchId = (req.params as any).id;
    if (config.APP_ENV === 'development')
      setImmediate(() => void warmPublishedPdf(batchId).catch(() => undefined));
    else void wake('pdf.render', { batch_id: batchId });
    return result;
  });
  app.post('/api/admin/batches/:id/services/bulk', async (req) => {
    await authenticate(req, true);
    const body = inputSchemas.routes_admin_batches_id_services_bulk_body.parse(req.body);
    return transaction(async (tx) => {
      for (const id of body.ids) {
        const [s] = await tx.query(
          'SELECT * FROM services WHERE id=$1 AND batch_id=$2 FOR UPDATE',
          [id, (req.params as any).id],
        );
        if (!s) fail('not_found', 'Service not found.', 404);
        transition('service', s.status, body.status);
        await tx.query('UPDATE services SET status=$1,updated_at=now() WHERE id=$2', [
          body.status,
          id,
        ]);
        await audit(tx, req, 'service.status', 'service', id, s, { status: body.status });
      }
      return { ok: true };
    });
  });
  app.get('/api/admin/events/:id/impact', async (req) => {
    await authenticate(req, true);
    return db.query(
      'SELECT ba.id,ba.code,ba.start_date,ba.end_date,b.status,count(b.id) as bookings FROM batches ba LEFT JOIN bookings b ON b.batch_id=ba.id WHERE ba.event_id=$1 GROUP BY ba.id,b.status',
      [(req.params as any).id],
    );
  });
  app.post('/api/admin/batches/:id/broadcast', async (req) => {
    await authenticate(req, true);
    const b = inputSchemas.routes_admin_batches_id_broadcast_b.parse(req.body);
    return transaction(async (tx) => {
      for (const booking of await tx.query(
        "SELECT DISTINCT ON(user_id) id,user_id FROM bookings WHERE batch_id=$1 AND status IN ('offered','confirmed') ORDER BY user_id,requested_at",
        [(req.params as any).id],
      ))
        await notify(tx, booking.user_id, 'batch_message', booking.id, { message: b.message });
      await audit(tx, req, 'batch.broadcast', 'batch', (req.params as any).id, null, b);
      return { ok: true };
    });
  });
  app.post('/api/admin/events/:id/notify', async (req) => {
    await authenticate(req, true);
    const b = inputSchemas.routes_admin_events_id_notify_b.parse(req.body);
    return transaction(async (tx) => {
      for (const booking of await tx.query(
        "SELECT b.id,b.user_id FROM bookings b JOIN batches ba ON ba.id=b.batch_id WHERE ba.event_id=$1 AND b.status IN ('offered','confirmed')",
        [(req.params as any).id],
      ))
        await notify(tx, booking.user_id, 'event_date_changed', booking.id, b);
      await audit(tx, req, 'event.notify', 'event', (req.params as any).id, null, b);
      return { ok: true };
    });
  });
  app.post('/api/admin/notifications/:id/resend', async (req) => {
    await authenticate(req, true);
    return transaction(async (tx) => {
      await tx.query(
        "UPDATE notifications SET status='queued',attempts=0,send_after=now() WHERE id=$1",
        [(req.params as any).id],
      );
      await audit(tx, req, 'notification.resend', 'notification', (req.params as any).id, null, {
        status: 'queued',
      });
      return { ok: true };
    });
  });
  app.post('/api/admin/travelers/:id/reveal', async (req) => {
    await authenticate(req, true);
    return transaction(async (tx) => {
      const [t] = await tx.query('SELECT * FROM travelers WHERE id=$1', [(req.params as any).id]);
      if (!t) fail('not_found', 'Traveler not found.', 404);
      await audit(tx, req, 'passport.reveal', 'traveler', t.id, null, { revealed: true });
      return { passport_number: t.passport_number_enc ? decrypt(t.passport_number_enc) : null };
    });
  });
  app.post('/api/admin/members/:id/anonymize', async (req) => {
    await authenticate(req, true);
    return transaction(async (tx) => {
      const id = (req.params as any).id;
      const [member] = await tx.query(
        "SELECT id FROM users WHERE id=$1 AND role='member' FOR UPDATE",
        [id],
      );
      if (!member) fail('not_found', 'Member not found.', 404);
      if (
        (
          await tx.query(
            "SELECT id FROM bookings WHERE user_id=$1 AND status IN ('confirmed','offered')",
            [id],
          )
        ).length
      )
        fail('active_trip', 'Complete or cancel active trips before anonymizing.', 409);
      await tx.query(
        "UPDATE users SET email=$1,full_name='Deleted member',whatsapp_e164=null,whatsapp_opt_in=false,password_hash=null,status='deleted',deleted_at=now(),updated_at=now() WHERE id=$2 AND role='member'",
        [`deleted-${id}@invalid.local`, id],
      );
      await tx.query(
        "UPDATE travelers SET given_names='Deleted',surname='Traveler',passport_number_enc=null,passport_number_last3=null,date_of_birth=null,medical_notes=null,dietary_notes=null,phone_e164=null,email=null,deleted_at=now(),updated_at=now() WHERE owner_user_id=$1",
        [id],
      );
      await tx.query('DELETE FROM sessions WHERE user_id=$1', [id]);
      await tx.query('DELETE FROM oauth_accounts WHERE user_id=$1', [id]);
      await tx.query('DELETE FROM auth_tokens WHERE user_id=$1', [id]);
      await tx.query(
        "UPDATE notifications SET to_address='deleted',payload='{}',status=CASE WHEN status IN ('queued','sending') THEN 'skipped'::notification_status ELSE status END WHERE user_id=$1",
        [id],
      );
      await tx.query(
        "UPDATE leads SET name='Deleted member',email=$1,whatsapp_e164=null,message=null,updated_at=now() WHERE user_id=$2",
        [`deleted-${id}@invalid.local`, id],
      );
      await tx.query('UPDATE bookings SET member_notes=null,updated_at=now() WHERE user_id=$1', [
        id,
      ]);
      await audit(tx, req, 'user.anonymize', 'user', id, null, { anonymized: true });
      return { ok: true };
    });
  });
}
