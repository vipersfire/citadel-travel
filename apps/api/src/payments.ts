import { requireApproval, analytics } from './v2.js';
import { inputSchemas } from '@citadel/contracts/requests';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { db, transaction, type Connection, type Row } from '@citadel/db';
import { z } from 'zod';
import { config } from './config.js';
import { fail, sha, secureEqual, audit, notify, transition } from './core.js';
import { authenticate } from './auth.js';
import { takeLimit } from './rate-limits.js';
import { wake } from './queue.js';
import { parsedPaymentEventSchema } from '@citadel/contracts';
export interface PaymentProvider {
  createCheckout(input: Row): Promise<Row>;
  getCheckout(id: string): Promise<Row>;
  cancelCheckout(id: string): Promise<void>;
  parseWebhook(payload: unknown): ReturnType<typeof parsedPaymentEventSchema.parse>;
}
export const paymentProvider: PaymentProvider = {
  parseWebhook(value) {
    const payload = z.record(z.string(), z.any()).parse(value),
      d = payload.data || payload;
    const event = String(payload.event || payload.event_type || d.status || '').toLowerCase();
    return parsedPaymentEventSchema.parse({
      session_id: d.payment_session_id || d.id,
      reference_id: d.reference_id,
      type:
        event.includes('completed') || event === 'payment.succeeded'
          ? 'completed'
          : event.includes('expired')
            ? 'expired'
            : event.includes('cancel')
              ? 'canceled'
              : event.includes('fail')
                ? 'failed'
                : 'unknown',
      amount: d.amount ?? d.payment?.amount,
      currency: d.currency ?? d.payment?.currency,
      payment_id: d.payment_id || d.payment?.id,
      paid_at: d.updated || d.created,
    });
  },
  async createCheckout(input) {
    if (config.PAYMENT_PROVIDER === 'manual')
      fail('manual_payment', 'Please contact Citadel to arrange a bank transfer.', 409);
    if (config.PAYMENT_PROVIDER === 'development')
      return {
        payment_session_id: `dev-${input.reference_id}`,
        payment_link_url: `${config.APP_ORIGIN}/dev/checkout/${input.reference_id}`,
        expires_at: input.expires_at,
        status: 'ACTIVE',
      };
    const value = await xendit('/sessions', 'POST', input);
    const parsed = z
      .object({
        payment_session_id: z.string().min(1),
        payment_link_url: z.url(),
        expires_at: z.iso.datetime().optional(),
        status: z.string(),
      })
      .passthrough()
      .safeParse(value);
    if (!parsed.success)
      fail('payment_provider', 'The payment provider returned an invalid checkout response.', 502);
    return parsed.data;
  },
  async cancelCheckout(id) {
    if (config.PAYMENT_PROVIDER === 'xendit') {
      const current = await this.getCheckout(id);
      if (['CANCELED', 'CANCELLED', 'EXPIRED'].includes(String(current.status).toUpperCase()))
        return;
      if (String(current.status).toUpperCase() === 'COMPLETED')
        fail(
          'payment_in_progress',
          'This checkout is already completed. Wait for payment confirmation before changing the offer.',
          409,
        );
      await xendit('/sessions/' + encodeURIComponent(id) + '/cancel', 'POST');
    }
  },
  async getCheckout(id) {
    return xendit('/sessions/' + encodeURIComponent(id), 'GET');
  },
};
async function xendit(path: string, method: string, input?: Row) {
  const response = await fetch('https://api.xendit.co' + path, {
    method,
    headers: {
      Authorization: 'Basic ' + Buffer.from(process.env.XENDIT_SECRET_KEY + ':').toString('base64'),
      'Content-Type': 'application/json',
      ...(input ? { 'Idempotency-Key': String(input.reference_id) } : {}),
    },
    body: input ? JSON.stringify(input) : undefined,
    signal: AbortSignal.timeout(20000),
  });
  const data = (await response.json()) as Row;
  if (!response.ok)
    fail(
      'payment_provider',
      'The payment provider is unavailable. Please try again or contact Citadel.',
      502,
    );
  return data;
}
export async function idempotent(req: FastifyRequest, action: (tx: Connection) => Promise<Row>) {
  const u = (req as any).user;
  const key = req.headers['idempotency-key'];
  if (typeof key !== 'string' || key.length < 8 || key.length > 200)
    fail('idempotency_required', 'An Idempotency-Key header (8–200 characters) is required.');
  const hash = sha(JSON.stringify(req.body || {})).toString('hex');
  return transaction(async (tx) => {
    await tx.query(
      "DELETE FROM idempotency_keys WHERE route<>'upload.reservation' AND created_at<now()-interval '24 hours'",
    );
    await tx.query(
      'INSERT INTO idempotency_keys(user_id,key,route,request_hash) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',
      [u.id, key, req.url, hash],
    );
    const [old] = await tx.query(
      'SELECT * FROM idempotency_keys WHERE user_id=$1 AND key=$2 FOR UPDATE',
      [u.id, key],
    );
    if (old.request_hash !== hash || old.route !== req.url)
      fail('idempotency_conflict', 'This key was used for a different request.', 409);
    if (old.response_body) return old.response_body;
    const result = await action(tx);
    await tx.query(
      'UPDATE idempotency_keys SET response_status=200,response_body=$1 WHERE user_id=$2 AND key=$3',
      [JSON.stringify(result), u.id, key],
    );
    return result;
  });
}
export async function cancelInvoiceAttempts(tx: Connection, invoiceId: string) {
  const attempts = await tx.query(
    "SELECT * FROM payment_attempts WHERE invoice_id=$1 AND status='active' FOR UPDATE",
    [invoiceId],
  );
  for (const attempt of attempts) {
    if (attempt.provider === 'xendit' && attempt.payment_session_id)
      await paymentProvider.cancelCheckout(attempt.payment_session_id);
    await tx.query("UPDATE payment_attempts SET status='canceled' WHERE id=$1", [attempt.id]);
  }
}
export async function recordPayment(
  tx: Connection,
  invoice: Row,
  payment: Row,
  req: FastifyRequest | null,
) {
  const [existing] = payment.provider_payment_id
    ? await tx.query('SELECT id FROM payments WHERE provider_payment_id=$1', [
        payment.provider_payment_id,
      ])
    : [];
  if (existing) return { duplicate: true };
  const [p] = await tx.query(
    'INSERT INTO payments(invoice_id,attempt_id,method,amount,currency,provider_payment_id,reference,paid_at,proof_document_id,recorded_by,raw) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *',
    [
      invoice.id,
      payment.attempt_id || null,
      payment.method,
      payment.amount,
      payment.currency || 'IDR',
      payment.provider_payment_id || null,
      payment.reference || null,
      payment.paid_at || new Date(),
      payment.proof_document_id || null,
      (req as any)?.user?.id || null,
      JSON.stringify(payment.raw || {}),
    ],
  );
  const [approval] = await tx.query(
    'SELECT id FROM offer_approvals WHERE invoice_id=$1 AND offer_version=$2',
    [invoice.id, invoice.offer_version],
  );
  if (
    !approval ||
    !invoice.readiness_confirmed_at ||
    Number(invoice.total) !== Number(payment.amount) ||
    (payment.currency || 'IDR') !== 'IDR' ||
    invoice.status !== 'issued' ||
    new Date(invoice.due_at).getTime() < Date.now()
  ) {
    await tx.query(
      'UPDATE invoices SET needs_review=true,review_reason=$1,updated_at=now() WHERE id=$2',
      ['Amount/currency mismatch, duplicate payment, or late payment', invoice.id],
    );
    await audit(tx, req, 'payment.needs_review', 'invoice', invoice.id, invoice, {
      payment_id: p.id,
    });
    await notify(tx, invoice.user_id, 'payment_review', invoice.booking_id, {
      message: invoice.number,
    });
    for (const admin of await tx.query(
      "SELECT id FROM users WHERE role='admin' AND status='active'",
    ))
      await notify(tx, admin.id, 'reconciliation_alert', null, {
        message: {
          id: 'Pembayaran ' + invoice.number + ' memerlukan peninjauan.',
          en: 'Payment ' + invoice.number + ' requires review.',
        },
        alert_id: 'payment:' + p.id,
        url: config.APP_ORIGIN + '/admin/invoices?needs_review=true',
      });
    return { needs_review: true };
  }
  await tx.query("UPDATE invoices SET status='paid',paid_at=$1,updated_at=now() WHERE id=$2", [
    payment.paid_at || new Date(),
    invoice.id,
  ]);
  await analytics(tx, 'payment_valid', {
    user_id: invoice.user_id,
    booking_id: invoice.booking_id,
  });
  if (invoice.kind === 'package') {
    const [booking] = await tx.query('SELECT * FROM bookings WHERE id=$1 FOR UPDATE', [
      invoice.booking_id,
    ]);
    transition('booking', booking.status, 'confirmed');
    await tx.query(
      "UPDATE bookings SET status='confirmed',confirmed_at=now(),updated_at=now() WHERE id=$1",
      [booking.id],
    );
    await tx.query(
      'UPDATE travelers SET locked_at=now(),updated_at=now() WHERE id IN (SELECT traveler_id FROM booking_travelers WHERE booking_id=$1 AND removed_at IS NULL)',
      [booking.id],
    );
    const [pkg] = await tx.query('SELECT countries FROM packages WHERE id=$1', [
      booking.package_id,
    ]);
    for (const destination of new Set(
      (pkg.countries as string[]).map((c) => (c === 'GB' ? 'GB' : 'SCHENGEN')),
    )) {
      const [tpl] = await tx.query('SELECT * FROM visa_checklist_templates WHERE destination=$1', [
        destination,
      ]);
      await tx.query(
        'INSERT INTO visa_applications(booking_id,traveler_id,destination,visa_type,checklist) SELECT $1,traveler_id,$2,$3,$4 FROM booking_travelers WHERE booking_id=$1 AND removed_at IS NULL ON CONFLICT DO NOTHING',
        [
          booking.id,
          destination,
          tpl?.visa_type || null,
          JSON.stringify((tpl?.items || []).map((x: any) => ({ ...x, done: false }))),
        ],
      );
    }
  }
  await audit(
    tx,
    req,
    'payment.record',
    'invoice',
    invoice.id,
    { status: invoice.status },
    { status: 'paid', payment_id: p.id },
  );
  await notify(tx, invoice.user_id, 'payment_received', invoice.booking_id, {
    message: invoice.number,
  });
  return { paid: true, payment_id: p.id };
}
export async function processWebhook(id: string | number) {
  await transaction(async (tx) => {
    const [event] = await tx.query(
      'SELECT * FROM webhook_events WHERE id=$1 AND processed_at IS NULL FOR UPDATE',
      [id],
    );
    if (!event) return;
    const payload = event.payload,
      data = payload.data || payload;
    let parsed;
    try {
      parsed = paymentProvider.parseWebhook(payload);
    } catch {
      await tx.query('UPDATE webhook_events SET error=$1,processed_at=now() WHERE id=$2', [
        'Invalid payment event payload',
        id,
      ]);
      return;
    }
    const sessionId = data.payment_session_id || data.id;
    const ref = data.reference_id;
    const [attempt] = await tx.query(
      'SELECT * FROM payment_attempts WHERE payment_session_id=$1 OR reference_id=$2',
      [sessionId, ref || null],
    );
    if (!attempt) {
      await tx.query('UPDATE webhook_events SET error=$1,processed_at=now() WHERE id=$2', [
        'Unmatched payment session',
        id,
      ]);
      return;
    }
    const type = parsed.type;
    const [invoice] = await tx.query('SELECT * FROM invoices WHERE id=$1 FOR UPDATE', [
      attempt.invoice_id,
    ]);
    await tx.query('SELECT id FROM payment_attempts WHERE id=$1 FOR UPDATE', [attempt.id]);
    if (type === 'completed') {
      if (parsed.amount === undefined || !parsed.currency) {
        await tx.query('UPDATE webhook_events SET error=$1,processed_at=now() WHERE id=$2', [
          'Missing payment amount or currency',
          id,
        ]);
        await tx.query(
          "UPDATE invoices SET needs_review=true,review_reason='Incomplete payment event',updated_at=now() WHERE id=$1",
          [invoice.id],
        );
        return;
      }
      await recordPayment(
        tx,
        invoice,
        {
          method: 'xendit',
          attempt_id: attempt.id,
          amount: parsed.amount,
          currency: parsed.currency,
          provider_payment_id:
            data.payment_id || data.payment?.id || `${attempt.payment_session_id}-payment`,
          paid_at: data.updated || data.created || new Date(),
          raw: payload,
        },
        null,
      );
      await tx.query(
        "UPDATE payment_attempts SET status='completed',completed_at=now() WHERE id=$1",
        [attempt.id],
      );
    } else if (
      (type === 'expired' || type === 'canceled' || type === 'failed') &&
      attempt.status !== 'completed'
    )
      await tx.query('UPDATE payment_attempts SET status=$1 WHERE id=$2', [
        type === 'failed' ? 'canceled' : type,
        attempt.id,
      ]);
    await tx.query('UPDATE webhook_events SET processed_at=now(),error=null WHERE id=$1', [id]);
  });
}
export async function paymentRoutes(app: FastifyInstance) {
  app.post('/api/me/invoices/:id/pay', async (req) => {
    const u = await authenticate(req);
    await takeLimit('pay', u.id, u.id, 10, 60000);
    return idempotent(req, async (tx) => {
      const [inv] = await tx.query(
        'SELECT i.*,b.code FROM invoices i JOIN bookings b ON b.id=i.booking_id WHERE i.id=$1 AND i.user_id=$2 FOR UPDATE OF i',
        [(req.params as any).id, u.id],
      );
      if (!inv) fail('not_found', 'Invoice not found.', 404);
      if (inv.needs_review)
        fail(
          'payment_review',
          'The payment is being reviewed. Contact Citadel before paying again.',
          409,
        );
      if (inv.status !== 'issued' || new Date(inv.due_at).getTime() <= Date.now())
        fail(
          'invoice_not_payable',
          'The payment deadline has passed or this invoice is not payable.',
          409,
        );
      if (!u.email_verified_at) fail('email_unverified', 'Verify your email before paying.', 403);
      const approval = await requireApproval(tx, inv);
      const [active] = await tx.query(
        "SELECT * FROM payment_attempts WHERE invoice_id=$1 AND status='active'",
        [inv.id],
      );
      if (active && new Date(active.expires_at).getTime() > Date.now() + 600000)
        return { url: active.payment_link_url };
      if (active)
        await tx.query("UPDATE payment_attempts SET status='expired' WHERE id=$1", [active.id]);
      const [count] = await tx.query(
        'SELECT coalesce(max(attempt_no),0)+1 as number FROM payment_attempts WHERE invoice_id=$1',
        [inv.id],
      );
      const reference = `inv_${inv.id}_a${count.number}`;
      const expires = new Date(
        Math.min(new Date(inv.due_at).getTime(), Date.now() + 86400000),
      ).toISOString();
      const lines = await tx.query(
        'SELECT * FROM invoice_lines WHERE invoice_id=$1 ORDER BY sort_order',
        [inv.id],
      );
      const checkout = await paymentProvider.createCheckout({
        reference_id: reference,
        session_type: 'PAY',
        mode: 'PAYMENT_LINK',
        amount: Number(inv.total),
        currency: 'IDR',
        country: 'ID',
        customer: {
          reference_id: u.id,
          type: 'INDIVIDUAL',
          email: u.email,
          ...(u.whatsapp_e164 ? { mobile_number: u.whatsapp_e164 } : {}),
          individual_detail: { given_names: u.full_name },
        },
        ...(inv.allowed_channels.length ? { allowed_payment_channels: inv.allowed_channels } : {}),
        expires_at: expires,
        items: lines.map((l) => ({
          reference_id: l.id,
          type: 'PHYSICAL_SERVICE',
          category: 'TRAVEL',
          name: String(l.description[u.locale] || l.description.id).slice(0, 255),
          currency: 'IDR',
          quantity: l.quantity,
          net_unit_amount: Number(l.unit_amount),
        })),
        locale: u.locale,
        capture_method: 'AUTOMATIC',
        description: `Citadel ${inv.code} · ${inv.number}`,
        success_return_url: `${config.APP_ORIGIN}/${u.locale}/account/trips/${inv.code}/payments?result=success&invoice=${inv.id}`,
        cancel_return_url: `${config.APP_ORIGIN}/${u.locale}/account/trips/${inv.code}/payments?result=cancelled`,
      });
      await tx.query(
        'INSERT INTO payment_attempts(invoice_id,attempt_no,provider,reference_id,payment_session_id,payment_link_url,amount,expires_at,raw_create_response,approval_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
        [
          inv.id,
          count.number,
          config.PAYMENT_PROVIDER,
          reference,
          checkout.payment_session_id,
          checkout.payment_link_url,
          inv.total,
          checkout.expires_at || expires,
          JSON.stringify(checkout),
          approval.id,
        ],
      );
      return { url: checkout.payment_link_url };
    });
  });
  app.post('/api/webhooks/xendit', async (req, reply) => {
    if (
      !process.env.XENDIT_WEBHOOK_TOKEN ||
      !secureEqual(String(req.headers['x-callback-token'] || ''), process.env.XENDIT_WEBHOOK_TOKEN)
    )
      fail('invalid_webhook_token', 'Invalid callback token.', 401);
    const body = req.body as any;
    const key = body.id || sha((req as any).rawBody || JSON.stringify(body)).toString('hex');
    const [event] = await db.query(
      "INSERT INTO webhook_events(provider,event_key,event_type,payload) VALUES('xendit',$1,$2,$3) ON CONFLICT DO NOTHING RETURNING id",
      [key, body.event || body.event_type, JSON.stringify(body)],
    );
    reply.send({ received: true });
    if (event) void wake('webhook.process', { id: event.id });
    if (event && config.APP_ENV === 'development')
      setImmediate(() =>
        processWebhook(event.id).catch((e) =>
          app.log.error({ err: e }, 'Webhook processing failed'),
        ),
      );
  });
  if (config.APP_ENV === 'development' && config.PAYMENT_PROVIDER === 'development') {
    app.get('/api/dev/checkout/:reference', async (req) => {
      const u = await authenticate(req);
      const [a] = await db.query(
        'SELECT a.*,i.number,b.code FROM payment_attempts a JOIN invoices i ON i.id=a.invoice_id JOIN bookings b ON b.id=i.booking_id WHERE a.reference_id=$1 AND i.user_id=$2',
        [(req.params as any).reference, u.id],
      );
      if (!a) fail('not_found', 'Checkout not found.', 404);
      return { ...a, locale: u.locale };
    });
    app.post('/api/dev/checkout/:reference/complete', async (req) => {
      const u = await authenticate(req);
      const [a] = await db.query(
        'SELECT a.* FROM payment_attempts a JOIN invoices i ON i.id=a.invoice_id WHERE a.reference_id=$1 AND i.user_id=$2',
        [(req.params as any).reference, u.id],
      );
      if (!a || a.status !== 'active' || new Date(a.expires_at).getTime() < Date.now())
        fail('invalid_checkout', 'Checkout is expired or completed.', 409);
      const [e] = await db.query(
        "INSERT INTO webhook_events(provider,event_key,event_type,payload) VALUES('development',$1,'payment_session.completed',$2) ON CONFLICT DO NOTHING RETURNING id",
        [
          a.reference_id,
          JSON.stringify({
            event: 'payment_session.completed',
            data: {
              payment_session_id: a.payment_session_id,
              amount: Number(a.amount),
              currency: 'IDR',
              payment_id: `dev-${a.id}`,
            },
          }),
        ],
      );
      if (e) await processWebhook(e.id);
      return { ok: true };
    });
  }
  app.post('/api/admin/invoices/:id/manual-payment', async (req) => {
    await authenticate(req, true);
    const b = inputSchemas.payments_admin_invoices_id_manual_payment_b.parse(req.body);
    if (b.confirm_amount !== String(b.amount))
      fail('confirmation_required', 'Type the exact amount to confirm.');
    return idempotent(req, async (tx) => {
      const [i] = await tx.query('SELECT * FROM invoices WHERE id=$1 FOR UPDATE', [
        (req.params as any).id,
      ]);
      if (!i) fail('not_found', 'Invoice not found.', 404);
      const [proof] = await tx.query(
        "SELECT id FROM documents WHERE id=$1 AND type='payment_proof'",
        [b.proof_document_id],
      );
      if (!proof) fail('invalid_proof', 'Upload a payment proof first.');
      await requireApproval(tx, i);
      return recordPayment(tx, i, { ...b, method: 'manual_transfer' }, req);
    });
  });
  app.post('/api/admin/invoices/:id/resolve-review', async (req) => {
    await authenticate(req, true);
    const body = inputSchemas.payments_admin_invoices_id_resolve_review_body.parse(req.body);
    return transaction(async (tx) => {
      const [i] = await tx.query('SELECT * FROM invoices WHERE id=$1 FOR UPDATE', [
        (req.params as any).id,
      ]);
      if (!i) fail('not_found', 'Invoice not found.', 404);
      const rows = await tx.query(
        'SELECT p.amount,p.currency,coalesce((SELECT sum(r.amount) FROM refunds r WHERE r.payment_id=p.id),0) AS refunded FROM payments p WHERE p.invoice_id=$1',
        [i.id],
      );
      const net = rows.reduce((n, p) => n + Number(p.amount) - Number(p.refunded), 0);
      if (
        net !== 0 &&
        !(i.status === 'paid' && net === Number(i.total) && rows.every((p) => p.currency === 'IDR'))
      )
        fail(
          'unresolved_payment',
          'Record external refunds or resolve the payment allocation before closing this review.',
          409,
        );
      await tx.query(
        'UPDATE invoices SET needs_review=false,review_reason=null,updated_at=now() WHERE id=$1',
        [i.id],
      );
      await audit(
        tx,
        req,
        'invoice.review_resolved',
        'invoice',
        i.id,
        { needs_review: i.needs_review },
        { note: body.note, net },
      );
      return { ok: true };
    });
  });
  app.post('/api/admin/invoices/:id/void', async (req) => {
    await authenticate(req, true);
    const b = inputSchemas.payments_admin_invoices_id_void_b.parse(req.body);
    return idempotent(req, async (tx) => {
      const [i] = await tx.query('SELECT * FROM invoices WHERE id=$1 FOR UPDATE', [
        (req.params as any).id,
      ]);
      if (!i) fail('not_found', 'Invoice not found.', 404);
      if (b.confirm_amount !== String(i.total))
        fail('confirmation_required', 'Type the exact amount.');
      transition('invoice', i.status, 'void');
      await cancelInvoiceAttempts(tx, i.id);
      await tx.query(
        "UPDATE invoices SET status='void',voided_at=now(),void_reason=$1,updated_at=now() WHERE id=$2",
        [b.reason, i.id],
      );
      if (i.kind === 'package')
        await tx.query(
          "UPDATE bookings SET status='cancelled',cancelled_at=now(),updated_at=now() WHERE id=$1 AND status='offered'",
          [i.booking_id],
        );
      await audit(tx, req, 'invoice.void', 'invoice', i.id, i, { status: 'void' });
      return { ok: true };
    });
  });
  app.post('/api/admin/payments/:id/refunds', async (req) => {
    const u = await authenticate(req, true);
    const b = inputSchemas.payments_admin_payments_id_refunds_b.parse(req.body);
    if (b.confirm_amount !== String(b.amount))
      fail('confirmation_required', 'Type the exact amount.');
    return idempotent(req, async (tx) => {
      const [p] = await tx.query('SELECT * FROM payments WHERE id=$1 FOR UPDATE', [
        (req.params as any).id,
      ]);
      if (!p) fail('not_found', 'Payment not found.', 404);
      const [sum] = await tx.query(
        'SELECT coalesce(sum(amount),0) as amount FROM refunds WHERE payment_id=$1',
        [p.id],
      );
      if (Number(sum.amount) + b.amount > Number(p.amount))
        fail('refund_exceeds_payment', 'Refund exceeds the payment.', 409);
      const [r] = await tx.query(
        'INSERT INTO refunds(payment_id,amount,method,reason,processed_on,reference,recorded_by) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *',
        [p.id, b.amount, b.method, b.reason, b.processed_on, b.reference || null, u.id],
      );
      await audit(tx, req, 'refund.record', 'refund', r.id, null, r);
      return r;
    });
  });
}
