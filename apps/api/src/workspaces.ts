import { inputSchemas } from '@citadel/contracts/requests';
import type { FastifyInstance } from 'fastify';
import { db, transaction, type Connection, type Row } from '@citadel/db';
import { z } from 'zod';
import { authenticate } from './auth.js';
import { audit, fail, publicTraveler, notify } from './core.js';
import { eventNoticeSchema } from '@citadel/contracts';
export async function roster(batchId: string, tx: Connection = db) {
  return tx.query(
    `SELECT bt.id AS booking_traveler_id,b.code,b.status AS booking_status,b.id AS booking_id,t.id AS traveler_id,t.given_names,t.surname,t.passport_expiry,t.dietary,
 CASE WHEN t.passport_expiry IS NULL THEN 'missing' WHEN t.passport_expiry < ba.end_date+interval '6 months' THEN 'expires_soon' ELSE 'valid' END AS passport_warning,
 (SELECT i.status FROM invoices i WHERE i.booking_id=b.id AND i.kind='package' ORDER BY i.created_at DESC LIMIT 1) AS payment_status,
 COALESCE((SELECT jsonb_agg(jsonb_build_object('room_id',r.id,'label',r.label,'hotel_service_id',r.hotel_service_id,'hotel_name',s.details->>'hotel_name')) FROM room_occupants ro JOIN rooms r ON r.id=ro.room_id LEFT JOIN services s ON s.id=r.hotel_service_id WHERE ro.booking_traveler_id=bt.id),'[]'::jsonb) AS rooms,
 COALESCE((SELECT jsonb_agg(jsonb_build_object('id',v.id,'stage',v.stage,'destination',v.destination,'appointment_at',v.appointment_at)) FROM visa_applications v WHERE v.booking_id=b.id AND v.traveler_id=t.id),'[]'::jsonb) AS visas
 FROM booking_travelers bt JOIN bookings b ON b.id=bt.booking_id JOIN batches ba ON ba.id=b.batch_id JOIN travelers t ON t.id=bt.traveler_id WHERE b.batch_id=$1 AND bt.removed_at IS NULL ORDER BY b.code,t.surname,bt.id`,
    [batchId],
  );
}
export async function nextAction(b: Row, batch?: Row) {
  const [invoice] = await db.query(
    "SELECT id,due_at FROM invoices WHERE booking_id=$1 AND status='issued' ORDER BY due_at LIMIT 1",
    [b.id],
  );
  if (invoice)
    return {
      date: invoice.due_at,
      timed: true,
      path: 'payments',
      message: {
        id: 'Tinjau penawaran dan selesaikan pembayaran sebelum batas waktu.',
        en: 'Review your offer and complete payment before the deadline.',
      },
    };
  const [visa] = await db.query(
    "SELECT v.appointment_at,v.appointment_location,t.given_names FROM visa_applications v JOIN travelers t ON t.id=v.traveler_id WHERE v.booking_id=$1 AND v.stage='appointment_booked' AND v.appointment_at>=now() ORDER BY v.appointment_at LIMIT 1",
    [b.id],
  );
  if (visa)
    return {
      date: visa.appointment_at,
      timed: true,
      path: 'travelers',
      message: {
        id: `Janji visa untuk ${visa.given_names} di ${visa.appointment_location || 'lokasi yang dikonfirmasi'}.`,
        en: `Visa appointment for ${visa.given_names} at ${visa.appointment_location || 'the confirmed location'}.`,
      },
    };
  const missing = await db.query(
    'SELECT t.given_names FROM travelers t JOIN booking_travelers bt ON bt.traveler_id=t.id WHERE bt.booking_id=$1 AND bt.removed_at IS NULL AND (t.passport_number_enc IS NULL OR t.passport_expiry IS NULL)',
    [b.id],
  );
  if (missing.length)
    return {
      date: batch?.request_cutoff || batch?.start_date || null,
      path: 'travelers',
      message: {
        id: `Lengkapi detail paspor: ${missing.map((t) => t.given_names).join(', ')}.`,
        en: `Complete passport details for ${missing.map((t) => t.given_names).join(', ')}.`,
      },
    };
  if (b.status === 'confirmed' && batch)
    return {
      date: batch.start_date,
      path: 'itinerary',
      message: {
        id: 'Tinjau itinerary dan titik pertemuan sebelum keberangkatan.',
        en: 'Review your itinerary and meeting point before departure.',
      },
    };
  return {
    date: b.requested_at,
    path: '',
    message: {
      id: 'Permintaan diterima. Tim Citadel akan menghubungi Anda untuk langkah berikutnya.',
      en: 'Request received. Citadel will contact you with the next step.',
    },
  };
}
export async function bookingWorkspace(code: string) {
  const [booking] = await db.query('SELECT * FROM bookings WHERE code=$1', [code]);
  if (!booking) fail('not_found', 'Booking not found.', 404);
  const [pkg] = await db.query('SELECT * FROM packages WHERE id=$1', [booking.package_id]);
  const [batch] = booking.batch_id
    ? await db.query('SELECT * FROM batches WHERE id=$1', [booking.batch_id])
    : [];
  const [event] = batch?.event_id
    ? await db.query('SELECT * FROM events WHERE id=$1', [batch.event_id])
    : [];
  const travelers = (
    await db.query(
      'SELECT t.*,bt.id AS booking_traveler_id,bt.package_option_id FROM travelers t JOIN booking_travelers bt ON bt.traveler_id=t.id WHERE bt.booking_id=$1 AND bt.removed_at IS NULL',
      [booking.id],
    )
  ).map(publicTraveler);
  const invoices = await db.query(
    'SELECT * FROM invoices WHERE booking_id=$1 ORDER BY created_at',
    [booking.id],
  );
  for (const i of invoices)
    i.lines = await db.query(
      'SELECT * FROM invoice_lines WHERE invoice_id=$1 ORDER BY sort_order',
      [i.id],
    );
  for (const i of invoices) {
    i.payments = await db.query(
      "SELECT p.*,coalesce((SELECT jsonb_agg(r) FROM refunds r WHERE r.payment_id=p.id),'[]'::jsonb) AS refunds FROM payments p WHERE p.invoice_id=$1 ORDER BY paid_at",
      [i.id],
    );
  }
  const history = await db.query(
    'SELECT action,created_at,before,after FROM audit_logs WHERE entity_id=$1 OR entity_id=ANY($2::text[]) ORDER BY created_at',
    [booking.id, invoices.map((i) => i.id)],
  );
  return {
    booking,
    package: pkg,
    batch: batch || null,
    event: event || null,
    travelers,
    invoices,
    history,
    services: await db.query(
      'SELECT * FROM services WHERE booking_id=$1 OR (batch_id=$2 AND booking_id IS NULL)',
      [booking.id, booking.batch_id],
    ),
    documents: await db.query(
      'SELECT * FROM documents WHERE booking_id=$1 OR (batch_id=$2 AND booking_id IS NULL)',
      [booking.id, booking.batch_id],
    ),
    visas: await db.query('SELECT * FROM visa_applications WHERE booking_id=$1', [booking.id]),
    itinerary: await db.query(
      'SELECT * FROM batch_itinerary_items WHERE batch_id=$1 ORDER BY day_number,sort_order',
      [booking.batch_id],
    ),
    next_action: await nextAction(booking, batch),
  };
}
export async function workspaceRoutes(app: FastifyInstance) {
  app.get('/api/admin/references/:kind', async (req) => {
    await authenticate(req, true);
    const definitions: Record<string, [string, string, string?]> = {
      package_id: ['packages', "coalesce(title->>'en',title->>'id')||' · '||code"],
      batch_id: ['batches', 'code'],
      event_id: ['events', "coalesce(name->>'en',name->>'id')||' · '||starts_on::text"],
      booking_id: ['bookings', 'code'],
      traveler_id: ['travelers', "given_names||' '||surname", 'deleted_at IS NULL'],
      user_id: ['users', "full_name||' · '||email::text", "role='member' AND status<>'deleted'"],
      owner_user_id: [
        'users',
        "full_name||' · '||email::text",
        "role='member' AND status<>'deleted'",
      ],
      media_id: ['media_assets', 'storage_key'],
      hero_media_id: ['media_assets', 'storage_key', "kind='image'"],
      poster_asset_id: ['media_assets', 'storage_key', "kind='image'"],
      hero_video_id: ['media_assets', 'storage_key', "kind='video'"],
      hotel_service_id: [
        'services',
        "coalesce(details->>'hotel_name',title->>'en',title->>'id')",
        "type='hotel'",
      ],
      service_id: ['services', "coalesce(title->>'en',title->>'id')||' · '||type::text"],
      proof_document_id: ['documents', 'filename', "type='payment_proof'"],
    };
    const def = definitions[(req.params as any).kind];
    if (!def) fail('not_found', 'Reference field not found.', 404);
    const q = z
      .object({
        search: z.string().max(150).default(''),
        cursor: z.uuid().optional(),
        selected_id: z.uuid().optional(),
      })
      .strict()
      .parse(req.query);
    const values: unknown[] = ['%' + q.search + '%'];
    const cursor = q.cursor ? (values.push(q.cursor), ' AND id>$2::uuid') : '';
    const rows = await db.query(
      `SELECT id,${def[1]} AS label FROM ${def[0]} WHERE ${def[2] || 'true'} AND (${def[1]}) ILIKE $1${cursor} ORDER BY id LIMIT 51`,
      values,
    );
    const [selected] = q.selected_id
      ? await db.query(
          `SELECT id,${def[1]} AS label FROM ${def[0]} WHERE id=$1 AND ${def[2] || 'true'}`,
          [q.selected_id],
        )
      : [];
    return {
      rows: rows.slice(0, 50),
      selected: selected || null,
      next_cursor: rows.length > 50 ? rows[49].id : null,
    };
  });
  app.get('/api/admin/bookings/:code/workspace', async (req) => {
    await authenticate(req, true);
    return bookingWorkspace((req.params as any).code);
  });
  app.get('/api/admin/batches/:id', async (req) => {
    await authenticate(req, true);
    const id = z.uuid().parse((req.params as any).id);
    const [b] = await db.query(
      'SELECT b.*,s.confirmed,s.held,s.remaining FROM batches b JOIN batch_seat_counts s ON s.batch_id=b.id WHERE b.id=$1',
      [id],
    );
    if (!b) fail('not_found', 'Batch not found.', 404);
    return b;
  });
  app.get('/api/admin/deletion-requests', async (req) => {
    await authenticate(req, true);
    return {
      rows: await db.query(
        "SELECT DISTINCT ON(u.id) a.id,u.id AS user_id,u.full_name,u.email,a.created_at FROM audit_logs a JOIN users u ON u.id=a.actor_user_id WHERE a.action='account.deletion_requested' AND u.status<>'deleted' ORDER BY u.id,a.created_at DESC",
      ),
    };
  });
  app.get('/api/admin/webhook-review', async (req) => {
    await authenticate(req, true);
    return {
      rows: await db.query(
        'SELECT id,provider,event_type,error,received_at,processed_at FROM webhook_events WHERE error IS NOT NULL ORDER BY received_at DESC LIMIT 100',
      ),
    };
  });
  app.post('/api/admin/webhook-review/:id/retry', async (req) => {
    await authenticate(req, true);
    await transaction(async (tx) => {
      const [e] = await tx.query(
        'UPDATE webhook_events SET processed_at=null,error=null WHERE id=$1 RETURNING id',
        [(req.params as any).id],
      );
      if (!e) fail('not_found', 'Event not found.', 404);
      await audit(tx, req, 'webhook.retry', 'webhook', String(e.id), null, { retry: true });
    });
    return { ok: true };
  });
  app.get('/api/admin/channel-limits', async (req) => {
    await authenticate(req, true);
    const [s] = await db.query(
      "SELECT value FROM site_settings WHERE key='payment_channel_limits'",
    );
    return { limits: s?.value || {} };
  });
  app.post('/api/admin/batches/:id/services/create-bulk', async (req) => {
    await authenticate(req, true);
    const batchId = z.uuid().parse((req.params as any).id);
    const b = inputSchemas.workspaces_admin_batches_id_services_create_bulk_b.parse(req.body);
    return transaction(async (tx) => {
      const rows = await tx.query(
        'SELECT bt.*,bk.batch_id FROM booking_travelers bt JOIN bookings bk ON bk.id=bt.booking_id WHERE bt.id=ANY($1::uuid[]) AND bk.batch_id=$2 AND bt.removed_at IS NULL',
        [b.booking_traveler_ids, batchId],
      );
      if (rows.length !== new Set(b.booking_traveler_ids).size)
        fail('invalid_traveler', 'All selected travelers must belong to this batch.');
      const created = [];
      for (const t of rows) {
        const [s] = await tx.query(
          'INSERT INTO services(batch_id,booking_id,traveler_id,type,title,details) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',
          [
            batchId,
            t.booking_id,
            t.traveler_id,
            b.type,
            JSON.stringify({ id: b.type, en: b.type }),
            JSON.stringify(b.type === 'flight' ? { segments: [] } : {}),
          ],
        );
        await audit(tx, req, 'service.create', 'service', s.id, null, s);
        created.push(s);
      }
      return { rows: created };
    });
  });
  app.post('/api/admin/events/:id/notify-template', async (req) => {
    await authenticate(req, true);
    const b = eventNoticeSchema.parse(req.body);
    const texts = {
      confirmed: {
        id: 'Tanggal acara telah dikonfirmasi. Tinjau perjalanan Anda.',
        en: 'The event date is confirmed. Review your journey.',
      },
      changed: {
        id: 'Tanggal acara berubah. Tim Citadel sedang menyesuaikan perjalanan Anda.',
        en: 'The event date changed. Citadel is adjusting your journey.',
      },
      cancelled: {
        id: 'Acara dibatalkan. Tim Citadel akan menghubungi Anda untuk langkah berikutnya.',
        en: 'The event was cancelled. Citadel will contact you about the next step.',
      },
    };
    return transaction(async (tx) => {
      const rows = await tx.query(
        "SELECT DISTINCT ON(b.user_id) b.user_id,b.id FROM bookings b JOIN batches ba ON ba.id=b.batch_id WHERE ba.event_id=$1 AND b.status IN ('offered','confirmed') ORDER BY b.user_id,b.requested_at",
        [(req.params as any).id],
      );
      for (const r of rows)
        await notify(tx, r.user_id, 'event_date_changed', r.id, {
          message: b.message || texts[b.template],
        });
      await audit(tx, req, 'event.notify', 'event', (req.params as any).id, null, b);
      return { recipients: rows.length };
    });
  });
}
