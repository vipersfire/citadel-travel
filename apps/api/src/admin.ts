import {
  checkPackageReadiness,
  claimsGuard,
  overdueHandovers,
  overdueLeads,
  leadResponseDue,
} from './v2.js';
import { inputSchemas } from '@citadel/contracts/requests';
import {
  resources,
  resourceOptions,
  jsonFields,
  resourceInputSchema,
} from '@citadel/contracts/resources';
import { config } from './config.js';
import type { FastifyInstance } from 'fastify';
import { db, transaction, type Row } from '@citadel/db';
import { z } from 'zod';
import {
  serviceDetailsSchema,
  travelerSchema,
  listQuerySchema,
  cursorSchema,
} from '@citadel/contracts';
import { authenticate } from './auth.js';
import { hash } from '@node-rs/argon2';
import { fail, audit, notify, transition, publicTraveler, publicUser, encrypt } from './core.js';
import { sha } from './core.js';
import { publicMediaUrl } from './storage.js';
import { purgePublicCache } from './cache.js';
export async function adminRoutes(app: FastifyInstance) {
  app.post('/api/admin/admins', async (req) => {
    await authenticate(req, true);
    const body = inputSchemas.admin_admin_admins_body.parse(req.body);
    return transaction(async (tx) => {
      const [user] = await tx.query(
        "INSERT INTO users(email,full_name,password_hash,role,email_verified_at) VALUES($1,$2,$3,'admin',now()) RETURNING *",
        [
          body.email,
          body.full_name,
          await hash(body.password, { memoryCost: 19456, timeCost: 2, parallelism: 1 }),
        ],
      );
      await audit(tx, req, 'admin.create', 'user', user.id, null, publicUser(user));
      return publicUser(user);
    });
  });
  app.get('/api/admin/data/:resource', async (req) => {
    await authenticate(req, true);
    const key = (req.params as any).resource;
    const r = Object.hasOwn(resources, key) ? resources[key] : undefined;
    if (!r) fail('not_found', 'Resource not found.', 404);
    const resource = (req.params as any).resource;
    const q = listQuerySchema.parse(req.query),
      limit = q.limit;
    const conditions: string[] = [],
      args: unknown[] = [];
    const add = (sql: string, value: unknown) => {
      args.push(value);
      conditions.push(sql.replace('?', `$${args.length}`));
    };
    if (q.overdue && ['services', 'leads'].includes(r.table)) {
      const records = await (r.table === 'services' ? overdueHandovers() : overdueLeads());
      add(
        'id=ANY(?::uuid[])',
        records.map((r) => r.id),
      );
    }
    if (resource === 'admins') conditions.push("role='admin'");
    if (resource === 'members') conditions.push("role='member'");
    if (
      q.batch_id &&
      ['services', 'documents', 'batch_itinerary_items', 'rooms', 'bookings'].includes(r.table)
    )
      add('batch_id=?', q.batch_id);
    if (q.batch_id && r.table === 'visa_applications')
      add('booking_id IN (SELECT id FROM bookings WHERE batch_id=?)', q.batch_id);
    if (
      q.package_id &&
      ['package_options', 'package_itinerary_days', 'batches', 'bookings'].includes(r.table)
    )
      add('package_id=?', q.package_id);
    const statusField =
      r.table === 'events' ? 'date_status' : r.table === 'visa_applications' ? 'stage' : 'status';
    if (q.status) {
      const [column] = await db.query(
        "SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND column_name=$2",
        [r.table, statusField],
      );
      if (!column) fail('invalid_filter', 'This resource does not support status filters.');
      add(`${statusField}::text=?`, q.status);
    }
    if (q.stage && r.table === 'visa_applications') add('stage::text=?', q.stage);
    if (q.needs_review && r.table === 'invoices') add('needs_review=?', q.needs_review === 'true');
    if (q.due_within && r.table === 'invoices')
      conditions.push("status='issued' AND due_at>now() AND due_at<=now()+interval '24 hours'");
    if (q.departures_within && r.table === 'batches')
      conditions.push(
        "start_date BETWEEN current_date AND current_date+14 AND status<>'cancelled'",
      );
    const searches: Record<string, string> = {
      bookings: 'code',
      users: "full_name||' '||email::text",
      leads: "name||' '||coalesce(email::text,'')||' '||coalesce(whatsapp_e164,'')",
      packages: "title::text||' '||code",
      batches: 'code',
      invoices: 'number',
      events: 'name::text',
      notifications: 'template_key',
      media_assets: 'storage_key',
      audit_logs: 'action',
      documents: 'filename',
    };
    if (q.search && searches[r.table]) add(`(${searches[r.table]}) ILIKE ?`, '%' + q.search + '%');
    const pk = r.table === 'site_settings' ? 'key' : 'id',
      ordered = r.table === 'bookings';
    const filter = sha(JSON.stringify({ ...q, cursor: undefined, limit: undefined })).toString(
      'hex',
    );
    if (q.cursor) {
      let cursor;
      try {
        cursor = cursorSchema.parse(JSON.parse(Buffer.from(q.cursor, 'base64url').toString()));
      } catch {
        fail('invalid_cursor', 'Invalid page cursor.');
      }
      if (cursor.resource !== resource || cursor.filter !== filter)
        fail('invalid_cursor', 'Cursor does not match these filters.');
      if (ordered) {
        args.push(cursor.requested_at, cursor.id);
        conditions.push(
          `(requested_at,id)>($${args.length - 1}::timestamptz,$${args.length}::uuid)`,
        );
      } else add(`${pk}>?`, cursor.id);
    }
    const where = conditions.length ? ' WHERE ' + conditions.join(' AND ') : '',
      order = ordered ? 'requested_at ASC,id ASC' : `${pk} ASC`;
    args.push(limit + 1);
    let rows = await db.query(
      `SELECT * FROM ${r.table}${where} ORDER BY ${order} LIMIT $${args.length}`,
      args,
    );
    const more = rows.length > limit;
    rows = rows.slice(0, limit);
    const last = rows.at(-1);
    const nextCursor =
      more && last
        ? Buffer.from(
            JSON.stringify({
              id: String(last[pk]),
              ...(ordered ? { requested_at: new Date(last.requested_at).toISOString() } : {}),
              resource,
              filter,
            }),
          ).toString('base64url')
        : null;
    if (r.table === 'bookings')
      rows = rows.map((b) => {
        const hours = Math.max(
          0,
          Math.floor((Date.now() - new Date(b.requested_at).getTime()) / 3600000),
        );
        return {
          ...b,
          age_hours: hours,
          age:
            hours < 1
              ? '< 1 h'
              : hours < 24
                ? hours + ' h'
                : Math.floor(hours / 24) + ' d ' + (hours % 24) + ' h',
        };
      });
    if (r.table === 'leads')
      rows = rows.map((l) => ({
        ...l,
        response_due_at: leadResponseDue(l.created_at).toISOString(),
        response_overdue:
          !l.first_response_at && leadResponseDue(l.created_at).getTime() < Date.now(),
      }));
    if (r.table === 'users') rows = rows.map(publicUser);
    if (r.table === 'travelers') rows = rows.map(publicTraveler);
    if (r.table === 'batches')
      for (const b of rows) {
        const [counts] = await db.query(
          'SELECT held,confirmed,remaining FROM batch_seat_counts WHERE batch_id=$1',
          [b.id],
        );
        Object.assign(b, counts);
      }
    return {
      rows:
        r.table === 'media_assets'
          ? rows.map((m) => ({ ...m, public_url: publicMediaUrl(m.storage_key, m.bucket) }))
          : rows,
      filter_options: ['bookings', 'batches'].includes(r.table)
        ? {
            packages: await db.query('SELECT id,title,code FROM packages ORDER BY sort_order,code'),
            batches: await db.query('SELECT id,code FROM batches ORDER BY start_date'),
          }
        : null,
      next_cursor: nextCursor,
      fields:
        (req.params as any).resource === 'admins'
          ? ['email', 'full_name', 'password']
          : r.fields
            ? Object.keys(r.fields)
            : [],
      field_options: resourceOptions[resource] || {},
      readonly: !!r.readonly,
    };
  });
  for (const method of ['POST', 'PATCH'] as const)
    app.route({
      method,
      url: method === 'POST' ? '/api/admin/data/:resource' : '/api/admin/data/:resource/:id',
      handler: async (req) => {
        const u = await authenticate(req, true),
          resource = (req.params as any).resource,
          r = resources[resource];
        if (!r?.fields || r.readonly)
          fail('forbidden', 'This resource cannot be changed directly.', 403);
        const schema = resourceInputSchema(resource);
        const body: Row = schema.parse(req.body);
        const { claims_reason, rights_reason, override_reason } = body;
        delete body.claims_reason;
        delete body.rights_reason;
        delete body.override_reason;
        return transaction(async (tx) => {
          const pk = r.table === 'site_settings' ? 'key' : 'id';
          const key = (req.params as any).id;
          const [old] =
            method === 'PATCH'
              ? await tx.query(`SELECT * FROM ${r.table} WHERE ${pk}=$1 FOR UPDATE`, [key])
              : [];
          if (method === 'PATCH' && !old) fail('not_found', 'Record not found.', 404);
          if (!Object.keys(body).length) fail('empty', 'No changes supplied.');
          const merged = { ...old, ...body };
          if (r.table === 'site_settings' && merged.key === 'claims_terms')
            z.array(z.string().trim().min(1).max(100)).max(100).parse(merged.value);
          if (r.table === 'site_settings' && merged.key === 'trust_line_enabled')
            z.boolean().parse(merged.value);
          if (r.table === 'packages') {
            if (merged.readiness === 'ready_to_offer') await checkPackageReadiness(tx, merged);
            if (body.supplier_verified_at) body.supplier_verified_by = u.id;
            if (
              merged.status === 'published' &&
              (!merged.readiness || merged.readiness === 'draft')
            )
              fail(
                'readiness_incomplete',
                'Published products must be interest-only or ready to offer.',
                409,
              );
          }
          if (r.table === 'leads' && body.status && old?.status !== body.status) {
            const allowed: Record<string, string[]> = {
              new: ['contacted', 'closed'],
              contacted: ['qualified', 'closed'],
              qualified: ['converted', 'closed'],
            };
            if (!allowed[old?.status]?.includes(body.status))
              fail('invalid_transition', 'Invalid lead status transition.', 409);
            if (body.status === 'contacted') {
              body.first_response_at = new Date().toISOString();
              body.first_response_by = u.id;
            }
            if (body.status === 'qualified') {
              if (
                !(merged.package_id || merged.sport || merged.concept_label) ||
                !merged.party_size ||
                !merged.preferred_period?.trim() ||
                !(merged.whatsapp_e164 || merged.email)
              )
                fail(
                  'qualification_incomplete',
                  'Record interest, party size, date range and contact first.',
                  409,
                );
              body.qualified_at = new Date().toISOString();
              body.qualified_by = u.id;
            }
          }
          if (r.table === 'team_members' && merged.status === 'published' && !merged.verified_at)
            fail('verification_required', 'Verify this team profile before publishing.', 422);
          if (r.table === 'services') {
            if (old && body.handover_status && body.handover_status !== old.handover_status)
              transition('service_handover', old.handover_status, body.handover_status);
            if (
              merged.delivery_method === 'external_app' &&
              (!merged.external_app_name?.trim() ||
                !merged.delivery_instructions?.id?.trim() ||
                !merged.handover_target_on)
            )
              fail(
                'delivery_incomplete',
                'App tickets need an app name, instructions and handover target.',
                422,
              );
            if (body.handover_status === 'handed_over' && old?.handover_status !== 'handed_over')
              body.handed_over_at = new Date().toISOString();
          }
          if (r.table === 'events') {
            if (body.date_status === 'confirmed' && !old?.date_verified_at)
              fail('source_required', 'Use Verify date with official source and dates.', 422);
            if (
              old?.date_verified_at &&
              ['starts_on', 'ends_on'].some((k) => k in body && String(body[k]) !== String(old[k]))
            ) {
              body.date_verified_at = null;
              body.date_verified_by = null;
            }
          }
          const publicTables = [
            'packages',
            'content_pages',
            'home_sections',
            'testimonials',
            'faqs',
            'team_members',
          ];
          if (
            (merged.status === 'published' && publicTables.includes(r.table)) ||
            (r.table === 'site_settings' && merged.key !== 'claims_terms')
          ) {
            await claimsGuard(
              tx,
              Object.fromEntries(
                Object.entries(merged).filter(
                  ([k]) =>
                    ![
                      'sales_rights_note',
                      'quotation_ref',
                      'supplier_verified_by',
                      'internal_notes',
                    ].includes(k),
                ),
              ),
              claims_reason,
            );
          }

          if (
            r.table === 'events' &&
            old &&
            ((body.starts_on &&
              body.starts_on !== new Date(old.starts_on).toISOString().slice(0, 10)) ||
              (body.ends_on && body.ends_on !== new Date(old.ends_on).toISOString().slice(0, 10)))
          )
            body.date_status = 'changed';
          if (r.table === 'batches') {
            if (
              old &&
              body.ticket_allocation_status &&
              body.ticket_allocation_status !== old.ticket_allocation_status
            )
              transition(
                'ticket_allocation',
                old.ticket_allocation_status,
                body.ticket_allocation_status,
              );
            if (method === 'POST' && body.status && body.status !== 'draft')
              fail('invalid_transition', 'New batches begin in Draft.');
            if (old && body.status && old.status !== body.status)
              transition('batch', old.status, body.status);
            if (merged.min_pax > merged.capacity)
              fail('invalid_capacity', 'Minimum travelers exceeds capacity.');
            if (old && body.status === 'confirmed' && old.status !== 'confirmed') {
              const [seats] = await tx.query(
                'SELECT confirmed FROM batch_seat_counts WHERE batch_id=$1',
                [old.id],
              );
              body.departure_confirmed_at = new Date().toISOString();
              if (Number(seats.confirmed) < merged.min_pax && !override_reason?.trim())
                fail(
                  'min_pax_unmet',
                  'The batch has not reached its minimum paid traveler count.',
                  409,
                );
            }
            if (old && body.capacity) {
              const [seats] = await tx.query(
                'SELECT held,confirmed FROM batch_seat_counts WHERE batch_id=$1',
                [old.id],
              );
              if (body.capacity < Number(seats.held) + Number(seats.confirmed))
                fail('capacity', 'Capacity cannot be reduced below held and confirmed seats.', 409);
            }
          }
          if (r.table === 'services') {
            if (method === 'POST' && body.status && body.status !== 'not_started')
              fail('invalid_transition', 'New services begin at Not started.');
            if (old && body.status && old.status !== body.status)
              transition('service', old.status, body.status);
            serviceDetailsSchema.parse({ type: merged.type, details: merged.details || {} });
            if (merged.booking_id) {
              const [owner] = await tx.query('SELECT batch_id FROM bookings WHERE id=$1', [
                merged.booking_id,
              ]);
              if (!owner || owner.batch_id !== merged.batch_id)
                fail('invalid_owner', 'Service booking does not belong to this batch.');
            }
            if (
              merged.traveler_id &&
              (!merged.booking_id ||
                !(
                  await tx.query(
                    'SELECT id FROM booking_travelers WHERE booking_id=$1 AND traveler_id=$2 AND removed_at IS NULL',
                    [merged.booking_id, merged.traveler_id],
                  )
                ).length)
            )
              fail('invalid_traveler', 'Assign a traveler from the selected booking.');
          }
          if (
            r.table === 'visa_applications' &&
            body.stage === 'appointment_booked' &&
            !merged.appointment_at
          )
            fail('appointment_required', 'Choose the visa appointment date and time.');
          if (r.table === 'visa_applications' && old && body.stage && old.stage !== body.stage)
            transition('visa', old.stage, body.stage);
          if (r.table === 'rooms' && merged.hotel_service_id) {
            const [hotel] = await tx.query('SELECT batch_id,type FROM services WHERE id=$1', [
              merged.hotel_service_id,
            ]);
            if (!hotel || hotel.batch_id !== merged.batch_id || hotel.type !== 'hotel')
              fail('invalid_hotel', 'Choose a hotel arrangement from this batch.');
          }
          if (r.table === 'notification_templates' && merged.channel === 'whatsapp')
            fail('fixed_template', 'WhatsApp templates are fixed after Meta approval.');
          if (r.table === 'site_settings' && merged.key === 'payment_channel_limits')
            z.record(
              z.string().min(1),
              z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
            ).parse(merged.value);
          if (merged.status === 'published' && r.table === 'packages') {
            if (!merged.hero_media_id)
              fail('media_required', 'Choose a hero image before publishing.');
            const [hero] = await tx.query(
              'SELECT kind,alt,rights_status,license_expires_on FROM media_assets WHERE id=$1',
              [merged.hero_media_id],
            );
            if (!hero || hero.kind !== 'image' || !hero.alt?.id?.trim())
              fail('media_required', 'Choose an image with Indonesian alt text before publishing.');
            if (
              !['owned', 'licensed', 'commissioned'].includes(hero.rights_status) &&
              !(hero.rights_status === 'ai_placeholder' && rights_reason?.trim())
            )
              fail(
                'rights_required',
                'Public hero media requires rights evidence; AI placeholders require a reason.',
                422,
              );
            if (
              hero.license_expires_on &&
              String(hero.license_expires_on) < new Date().toISOString().slice(0, 10)
            )
              fail('rights_required', 'This media license has expired.', 422);
          }
          if (
            r.table === 'home_sections' &&
            merged.kind === 'hero' &&
            merged.status === 'published'
          ) {
            const key = String(merged.data?.poster || '')
              .replace(/^https?:\/\/[^/]+\//, '')
              .replace(/^\//, '');
            const [media] = await tx.query(
              'SELECT rights_status,license_expires_on FROM media_assets WHERE id::text=$1 OR storage_key=$2',
              [String(merged.data?.hero_media_id || ''), key],
            );
            if (
              !media ||
              (!['owned', 'licensed', 'commissioned'].includes(media.rights_status) &&
                !(media.rights_status === 'ai_placeholder' && rights_reason?.trim()))
            )
              fail(
                'rights_required',
                'Choose licensed, commissioned or owned hero media; AI placeholders need a reason.',
                422,
              );
            if (
              media.license_expires_on &&
              new Date(media.license_expires_on).getTime() < Date.now()
            )
              fail('rights_required', 'This media license has expired.', 422);
          }
          if (body.status === 'published') {
            const checkID = (value: any): void => {
              if (Array.isArray(value)) {
                for (const v of value) checkID(v);
              } else if (value && typeof value === 'object') {
                if ('id' in value && typeof value.id === 'string' && !value.id.trim())
                  fail('missing_translation', 'Indonesian content is required to publish.');
                for (const v of Object.values(value)) checkID(v);
              }
            };
            checkID(merged);
          }
          if (body.status === 'published') {
            for (const field of ['title', 'name', 'question', 'answer', 'quote'])
              if (
                field in merged &&
                typeof merged[field] === 'object' &&
                !merged[field]?.id?.trim()
              )
                fail('missing_translation', 'Indonesian text is required to publish.');
            if (r.table === 'testimonials' && !merged.consent_on_file)
              fail('consent_required', 'Testimonials require consent on file.');
            body.published_at = new Date().toISOString();
            if (!['packages', 'content_pages'].includes(r.table)) delete body.published_at;
          }
          if (old && 'updated_at' in old) body.updated_at = new Date().toISOString();
          const keys = Object.keys(body),
            values = keys.map((k) => (jsonFields.has(k) ? JSON.stringify(body[k]) : body[k]));
          let updated: Row;
          if (method === 'POST') {
            [updated] = await tx.query(
              `INSERT INTO ${r.table} (${keys.map((k) => `"${k}"`).join(',')}) VALUES(${keys.map((_, i) => `$${i + 1}`).join(',')}) RETURNING *`,
              values,
            );
          } else {
            [updated] = await tx.query(
              `UPDATE ${r.table} SET ${keys.map((k, i) => `"${k}"=$${i + 1}`).join(',')} WHERE ${pk}=$${keys.length + 1} RETURNING *`,
              [...values, key],
            );
          }
          if (r.table === 'batches' && method === 'POST') {
            const [event] = body.event_id
              ? await tx.query('SELECT timezone FROM events WHERE id=$1', [body.event_id])
              : [];
            await tx.query(
              'INSERT INTO batch_itinerary_items(batch_id,day_number,timezone,title,body,location_name) SELECT $1,day_number,$2,title,body,city FROM package_itinerary_days WHERE package_id=$3',
              [updated.id, event?.timezone || 'Europe/London', body.package_id],
            );
          }
          if (
            r.table === 'batches' &&
            old &&
            body.status === 'cancelled' &&
            old.status !== 'cancelled'
          ) {
            const bookings = await tx.query(
              "SELECT * FROM bookings WHERE batch_id=$1 AND status IN ('requested','reviewing','waitlisted','offered','confirmed') FOR UPDATE",
              [old.id],
            );
            for (const booking of bookings) {
              await tx.query(
                "UPDATE bookings SET status='cancelled',cancelled_at=now(),cancel_reason='Departure batch cancelled',updated_at=now() WHERE id=$1",
                [booking.id],
              );
              await tx.query(
                "UPDATE invoices SET status='void',voided_at=now(),void_reason='Departure batch cancelled',updated_at=now() WHERE booking_id=$1 AND status='issued'",
                [booking.id],
              );
              await tx.query(
                "UPDATE payment_attempts SET status='canceled' WHERE invoice_id IN (SELECT id FROM invoices WHERE booking_id=$1) AND status='active'",
                [booking.id],
              );
              await notify(tx, booking.user_id, 'trip_updated', booking.id, {
                message: {
                  id: 'Keberangkatan dibatalkan. Tim Citadel akan menghubungi Anda.',
                  en: 'Departure cancelled. The Citadel team will contact you.',
                },
              });
              await audit(
                tx,
                req,
                'booking.batch_cancelled',
                'booking',
                booking.id,
                { status: booking.status },
                { status: 'cancelled' },
              );
            }
            await tx.query(
              "UPDATE travelers SET locked_at=null,updated_at=now() WHERE id IN (SELECT bt.traveler_id FROM booking_travelers bt JOIN bookings b ON b.id=bt.booking_id WHERE b.batch_id=$1) AND NOT EXISTS (SELECT 1 FROM booking_travelers bt JOIN bookings b ON b.id=bt.booking_id WHERE bt.traveler_id=travelers.id AND b.status='confirmed')",
              [old.id],
            );
          }
          if (r.table === 'visa_applications' && body.stage)
            await notify(
              tx,
              merged.booking_id
                ? (
                    await tx.query('SELECT user_id FROM bookings WHERE id=$1', [merged.booking_id])
                  )[0].user_id
                : u.id,
              'visa_status_changed',
              merged.booking_id,
              { message: body.stage },
            );
          if (
            r.table === 'services' &&
            old &&
            old.handover_status !== 'handed_over' &&
            updated.handover_status === 'handed_over' &&
            updated.published_at
          ) {
            for (const booking of await tx.query(
              "SELECT DISTINCT ON(user_id) id,user_id FROM bookings WHERE batch_id=$1 AND ($2::uuid IS NULL OR id=$2) AND status='confirmed' ORDER BY user_id,requested_at",
              [updated.batch_id, updated.booking_id],
            ))
              await notify(tx, booking.user_id, 'trip_updated', booking.id, {
                message: {
                  id: 'Layanan perjalanan telah diserahkan.',
                  en: 'Your travel service has been handed over.',
                },
              });
          }
          await audit(
            tx,
            req,
            `${resource}.${method === 'POST' ? 'create' : 'update'}`,
            r.table,
            updated[pk],
            old || null,
            {
              ...updated,
              ...(claims_reason ? { claims_reason } : {}),
              ...(rights_reason ? { rights_reason } : {}),
              ...(override_reason ? { override_reason } : {}),
            },
          );
          if (
            [
              'packages',
              'content_pages',
              'home_sections',
              'events',
              'site_settings',
              'faqs',
              'testimonials',
              'team_members',
            ].includes(r.table)
          )
            setImmediate(() => void purgePublicCache());
          return updated;
        });
      },
    });
  app.post('/api/admin/rooms/:id/occupants', async (req) => {
    await authenticate(req, true);
    const b = inputSchemas.admin_admin_rooms_id_occupants_b.parse(req.body);
    return transaction(async (tx) => {
      const [room] = await tx.query('SELECT * FROM rooms WHERE id=$1 FOR UPDATE', [
        (req.params as any).id,
      ]);
      if (!room) fail('not_found', 'Room not found.', 404);
      if (room.room_type === 'single' && b.booking_traveler_ids.length > 1)
        fail('room_capacity', 'Single rooms allow one traveler.');
      await tx.query('DELETE FROM room_occupants WHERE room_id=$1', [room.id]);
      for (const id of b.booking_traveler_ids) {
        const [bt] = await tx.query(
          'SELECT bt.id FROM booking_travelers bt JOIN bookings b ON b.id=bt.booking_id WHERE bt.id=$1 AND b.batch_id=$2 AND bt.removed_at IS NULL FOR UPDATE OF bt',
          [id, room.batch_id],
        );
        if (!bt) fail('invalid_traveler', 'Traveler does not belong to this batch.');
        await tx.query(
          'DELETE FROM room_occupants WHERE booking_traveler_id=$1 AND room_id IN (SELECT id FROM rooms WHERE batch_id=$2 AND hotel_service_id IS NOT DISTINCT FROM $3)',
          [id, room.batch_id, room.hotel_service_id],
        );
        await tx.query('INSERT INTO room_occupants(room_id,booking_traveler_id) VALUES($1,$2)', [
          room.id,
          id,
        ]);
      }
      await audit(tx, req, 'room.assign', 'room', room.id, null, b);
      return { ok: true };
    });
  });
  app.patch('/api/admin/travelers/:id', async (req) => {
    await authenticate(req, true);
    const body = travelerSchema.partial().parse(req.body);
    return transaction(async (tx) => {
      const [old] = await tx.query('SELECT * FROM travelers WHERE id=$1 FOR UPDATE', [
        (req.params as any).id,
      ]);
      if (!old) fail('not_found', 'Traveler not found.', 404);
      const b: Row = { ...body };
      if (b.passport_number) {
        b.passport_number_enc = encrypt(b.passport_number);
        b.passport_number_last3 = b.passport_number.slice(-3);
        b.passport_key_version = config.encryptionVersion;
        delete b.passport_number;
      }
      const keys = Object.keys(b);
      if (!keys.length) return publicTraveler(old);
      const [updated] = await tx.query(
        `UPDATE travelers SET ${keys.map((k, i) => `"${k}"=$${i + 1}`).join(',')},updated_at=now() WHERE id=$${keys.length + 1} RETURNING *`,
        [...Object.values(b), old.id],
      );
      await audit(tx, req, 'traveler.update', 'traveler', old.id, old, updated);
      return publicTraveler(updated);
    });
  });
}
