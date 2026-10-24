import { db, transaction, pool } from '@citadel/db';
import { notify } from './core.js';
import { config } from './config.js';
import { reportError } from './instrumentation.js';
export async function notifyAdmins(
  key: string,
  message: { id: string; en: string },
  identity: string,
  url?: string,
) {
  await transaction(async (tx) => {
    if (pool) await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [key + ':' + identity]);
    if (
      (
        await tx.query(
          "SELECT id FROM notifications WHERE template_key=$1 AND payload->>'alert_id'=$2 LIMIT 1",
          [key, identity],
        )
      ).length
    )
      return;
    for (const u of await tx.query("SELECT id FROM users WHERE role='admin' AND status='active'"))
      await notify(tx, u.id, key, null, {
        message,
        alert_id: identity,
        url: url || `${config.APP_ORIGIN}/admin`,
      });
  });
}
export async function operationalAlert(kind: string, count: number) {
  if (process.env.ALERTS_ENABLED !== 'true' || !process.env.ALERT_WEBHOOK_URL) return;
  try {
    const response = await fetch(process.env.ALERT_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service: 'citadel',
        environment: config.APP_ENV,
        kind,
        count,
        time: new Date().toISOString(),
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error('Operational alert failed');
  } catch (e) {
    reportError(e);
  }
}
export async function monitor() {
  const [n] = await db.query(
    "SELECT (SELECT count(*) FROM notifications WHERE status='failed') AS failed,(SELECT count(*) FROM invoices WHERE needs_review) AS review,(SELECT count(*) FROM webhook_events WHERE error IS NOT NULL) AS webhook",
  );
  for (const key of ['failed', 'review', 'webhook'])
    if (Number(n[key])) await operationalAlert(key, Number(n[key]));
}
