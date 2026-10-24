import { db, transaction } from '@citadel/db';
import { config } from './config.js';
import { notify, audit } from './core.js';
import { paymentProvider, processWebhook } from './payments.js';
import { renderEmail } from '@citadel/emails';
import { notifyAdmins } from './alerts.js';
import { recoverMedia } from './media-jobs.js';
import { cleanupUploads } from './uploads.js';
import { batchChecklist } from './routes.js';
export async function notifications() {
  await db.query(
    "UPDATE notifications SET status='queued',send_after=now() WHERE status='sending' AND send_after<now()-interval '10 minutes'",
  );
  for (let count = 0; count < 25; count++) {
    const n = await transaction(async (tx) => {
      const [row] = await tx.query(
        "SELECT * FROM notifications WHERE status='queued' AND send_after<=now() ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1",
      );
      if (row)
        await tx.query(
          "UPDATE notifications SET status='sending',attempts=attempts+1,send_after=now() WHERE id=$1",
          [row.id],
        );
      return row;
    });
    if (!n) break;
    try {
      const [template] = await db.query(
        'SELECT * FROM notification_templates WHERE key=$1 AND channel=$2 AND locale=$3',
        [n.template_key, n.channel, n.locale],
      );
      const vars = n.payload;
      const interpolate = (v: string) =>
        v.replace(/\{\{(\w+)\}\}/g, (_, key) => String(vars[key] || ''));
      const subject = interpolate(template?.subject || 'Citadel · Your journey'),
        body = interpolate(template?.body || '{{message}} {{url}}');
      let providerId: string | null = null,
        status = 'sent';
      if (n.channel === 'email' && config.EMAIL_PROVIDER === 'resend') {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Idempotency-Key': n.id,
            Authorization: 'Bearer ' + process.env.RESEND_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: process.env.EMAIL_FROM,
            to: [n.to_address],
            subject,
            html: await renderEmail(subject, body, vars.url, n.locale),
          }),
          signal: AbortSignal.timeout(15000),
        });
        const data = (await res.json()) as any;
        if (!res.ok) throw new Error('Email provider rejected the message');
        providerId = data.id;
      } else if (n.channel === 'whatsapp') {
        if (config.WHATSAPP_ENABLED !== 'true') status = 'skipped';
        else {
          const res = await fetch(
            `https://graph.facebook.com/${process.env.WA_GRAPH_VERSION || 'v23.0'}/${process.env.WA_PHONE_NUMBER_ID}/messages`,
            {
              method: 'POST',
              headers: {
                Authorization: 'Bearer ' + process.env.WA_ACCESS_TOKEN,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                messaging_product: 'whatsapp',
                to: n.to_address,
                type: 'template',
                template: {
                  name: template?.wa_template_name || n.template_key,
                  language: { code: template?.wa_language || n.locale },
                  components: [
                    { type: 'body', parameters: [{ type: 'text', text: vars.message || '' }] },
                  ],
                },
              }),
              signal: AbortSignal.timeout(15000),
            },
          );
          const data = (await res.json()) as any;
          if (!res.ok) throw new Error('WhatsApp provider rejected the message');
          providerId = data.messages?.[0]?.id;
        }
      } else providerId = 'development-outbox';
      await db.query(
        'UPDATE notifications SET status=$1,provider_message_id=$2,sent_at=now(),last_error=null WHERE id=$3',
        [status, providerId, n.id],
      );
    } catch (e) {
      const delays = [1, 5, 30, 120, 600],
        attempt = Number(n.attempts);
      await db.query('UPDATE notifications SET status=$1,last_error=$2,send_after=$3 WHERE id=$4', [
        attempt >= delays.length ? 'failed' : 'queued',
        e instanceof Error ? e.message : 'Delivery failed',
        new Date(Date.now() + (delays[attempt] || 600) * 60000),
        n.id,
      ]);
    }
  }
}
export async function lifecycle(scope = 'all') {
  if (scope === 'all' || scope === 'cleanup') await cleanupUploads();
  await transaction(async (tx) => {
    if (scope === 'all' || scope === 'expiry')
      for (const i of await tx.query(
        "SELECT * FROM invoices WHERE status='issued' AND due_at<=now() FOR UPDATE",
      )) {
        await tx.query(
          "UPDATE invoices SET status='expired',expired_at=now(),updated_at=now() WHERE id=$1",
          [i.id],
        );
        if (i.kind === 'package')
          await tx.query(
            "UPDATE bookings SET status='expired',expired_at=now(),updated_at=now() WHERE id=$1 AND status='offered'",
            [i.booking_id],
          );
        await tx.query(
          "UPDATE payment_attempts SET status='expired' WHERE invoice_id=$1 AND status='active'",
          [i.id],
        );
        await notify(tx, i.user_id, 'offer_expired', i.booking_id, { message: i.number });
        await audit(
          tx,
          null,
          'invoice.expire',
          'invoice',
          i.id,
          { status: 'issued' },
          { status: 'expired' },
        );
      }
    if (scope === 'all' || scope === 'reminder')
      for (const i of await tx.query(
        "SELECT * FROM invoices WHERE status='issued' AND due_at>now() AND due_at<=now()+interval '24 hours'",
      ))
        if (
          !(
            await tx.query(
              "SELECT id FROM notifications WHERE template_key='payment_reminder' AND payload->>'invoice_id'=$1",
              [i.id],
            )
          ).length
        )
          await notify(tx, i.user_id, 'payment_reminder', i.booking_id, {
            invoice_id: i.id,
            message: i.number,
          });
    if (scope === 'all' || scope === 'batches')
      for (const batch of await tx.query(
        "SELECT * FROM batches WHERE status='confirmed' AND start_date<=(now() AT TIME ZONE 'Asia/Jakarta')::date FOR UPDATE",
      )) {
        await tx.query("UPDATE batches SET status='in_progress',updated_at=now() WHERE id=$1", [
          batch.id,
        ]);
        await audit(tx, null, 'batch.start', 'batch', batch.id, null, { status: 'in_progress' });
      }
    if (scope === 'all' || scope === 'batches')
      for (const batch of await tx.query(
        "SELECT * FROM batches WHERE status='in_progress' AND end_date<(now() AT TIME ZONE 'Asia/Jakarta')::date FOR UPDATE",
      )) {
        await tx.query("UPDATE batches SET status='completed',updated_at=now() WHERE id=$1", [
          batch.id,
        ]);
        await tx.query(
          "UPDATE bookings SET status='completed',completed_at=now(),updated_at=now() WHERE batch_id=$1 AND status='confirmed'",
          [batch.id],
        );
        await tx.query(
          "UPDATE travelers SET locked_at=null,updated_at=now() WHERE locked_at IS NOT NULL AND NOT EXISTS(SELECT 1 FROM booking_travelers bt JOIN bookings b ON b.id=bt.booking_id WHERE bt.traveler_id=travelers.id AND b.status='confirmed')",
        );
        await audit(tx, null, 'batch.complete', 'batch', batch.id, null, { status: 'completed' });
      }
    if (scope === 'all' || scope === 'predeparture')
      for (const b of await tx.query(
        "SELECT b.* FROM bookings b JOIN batches ba ON ba.id=b.batch_id WHERE b.status='confirmed' AND ba.start_date=(now() AT TIME ZONE 'Asia/Jakarta')::date+7",
      ))
        if (
          !(
            await tx.query(
              "SELECT id FROM notifications WHERE template_key='departure_reminder' AND booking_id=$1",
              [b.id],
            )
          ).length
        )
          await notify(tx, b.user_id, 'departure_reminder', b.id, { message: b.code });
    if (scope === 'all' || scope === 'cleanup') {
      await tx.query('DELETE FROM sessions WHERE expires_at<now()');
      await tx.query("DELETE FROM auth_tokens WHERE expires_at<now()-interval '1 day'");
      await tx.query(
        "DELETE FROM idempotency_keys WHERE route<>'upload.reservation' AND created_at<now()-interval '24 hours'",
      );
    }
    if (scope === 'all' || scope === 'retention')
      await tx.query(
        `UPDATE travelers t SET passport_number_enc=null,passport_number_last3=null,date_of_birth=null WHERE EXISTS(SELECT 1 FROM booking_travelers bt JOIN bookings b ON b.id=bt.booking_id WHERE bt.traveler_id=t.id AND b.completed_at<now()-interval '180 days') AND NOT EXISTS(SELECT 1 FROM booking_travelers bt JOIN bookings b ON b.id=bt.booking_id WHERE bt.traveler_id=t.id AND (b.completed_at IS NULL OR b.completed_at>=now()-interval '180 days') AND b.status NOT IN ('declined','cancelled','expired'))`,
      );
  });
  if (scope === 'all' || scope === 'webhooks')
    for (const event of await db.query(
      'SELECT id FROM webhook_events WHERE processed_at IS NULL ORDER BY received_at LIMIT 100',
    ))
      await processWebhook(event.id);
}
export async function reconcile(full = false) {
  if (!process.env.XENDIT_SECRET_KEY) {
    await db.query(
      "UPDATE invoices i SET needs_review=true,review_reason='Paid invoice has no payment record',updated_at=now() WHERE i.status='paid' AND NOT EXISTS(SELECT 1 FROM payments p WHERE p.invoice_id=i.id)",
    );
    return;
  }
  let cursor = '';
  do {
    const attempts = full
      ? await db.query(
          "SELECT * FROM payment_attempts WHERE provider='xendit' AND id::text>$1 ORDER BY id LIMIT 100",
          [cursor],
        )
      : await db.query(
          "SELECT * FROM payment_attempts WHERE provider='xendit' AND status IN ('active','expired') AND expires_at<now()+interval '15 minutes' ORDER BY coalesce((raw_create_response->>'last_reconciled_at')::timestamptz,created_at) LIMIT 100",
        );
    for (const a of attempts) {
      try {
        const remote = await paymentProvider.getCheckout(a.payment_session_id);
        await db.query(
          "UPDATE payment_attempts SET raw_create_response=jsonb_set(coalesce(raw_create_response,'{}'),'{last_reconciled_at}',to_jsonb(now())) WHERE id=$1",
          [a.id],
        );
        if (remote.status === 'COMPLETED') {
          const [event] = await db.query(
            "INSERT INTO webhook_events(provider,event_key,event_type,payload) VALUES('xendit',$1,'payment_session.completed',$2) ON CONFLICT DO NOTHING RETURNING id",
            [
              `reconcile-${a.payment_session_id}`,
              JSON.stringify({ event: 'payment_session.completed', data: remote }),
            ],
          );
          if (event) await processWebhook(event.id);
        } else if (remote.status === 'EXPIRED' && a.status === 'active')
          await db.query("UPDATE payment_attempts SET status='expired' WHERE id=$1", [a.id]);
      } catch {
        await db.query(
          "UPDATE invoices SET needs_review=true,review_reason='Payment reconciliation failed',updated_at=now() WHERE id=$1",
          [a.invoice_id],
        );
      }
    }
    if (!full || attempts.length < 100) break;
    cursor = String(attempts.at(-1)!.id);
  } while (true);
  await db.query(
    "UPDATE invoices i SET needs_review=true,review_reason='Paid invoice has no payment record',updated_at=now() WHERE i.status='paid' AND NOT EXISTS(SELECT 1 FROM payments p WHERE p.invoice_id=i.id)",
  );
  const [flags] = await db.query('SELECT count(*) AS n FROM invoices WHERE needs_review');
  if (Number(flags.n))
    await notifyAdmins(
      'reconciliation_alert',
      { id: 'Pembayaran memerlukan peninjauan.', en: 'Payments require finance review.' },
      'reconciliation-' + new Date().toISOString().slice(0, 10),
    );
}
export async function predepartureAlerts() {
  for (const b of await db.query(
    "SELECT id,code FROM batches WHERE start_date=(now() AT TIME ZONE 'Asia/Jakarta')::date+14 AND status IN ('open','closed','confirmed')",
  )) {
    const flags = await batchChecklist(b.id);
    if (flags.some((t: any) => t.missing.length))
      await notifyAdmins(
        'predeparture_alert',
        {
          id: `Periksa visa dan dokumen untuk keberangkatan ${b.code}.`,
          en: `Review visa and document readiness for departure ${b.code}.`,
        },
        'predeparture-' + b.id,
      );
  }
}
export async function recoverBackground() {
  await lifecycle('webhooks');
  await recoverMedia();
  for (const e of await db.query('SELECT id FROM webhook_events WHERE error IS NOT NULL LIMIT 100'))
    await notifyAdmins(
      'reconciliation_alert',
      {
        id: 'Webhook pembayaran belum dapat dicocokkan. Tinjau log pembayaran.',
        en: 'A payment webhook requires review. Check the webhook queue.',
      },
      'webhook-' + e.id,
    );
}
