import { v2Maintenance } from './v2.js';
import './config.js';
import { pool, closeDb, postgresPoolConfig } from '@citadel/db';
import { PgBoss } from 'pg-boss';
import {
  notifications,
  lifecycle,
  reconcile,
  predepartureAlerts,
  recoverBackground,
} from './jobs.js';
import { processWebhook } from './payments.js';
import { generateVariants } from './media-jobs.js';
import { warmPublishedPdf } from './pdf-cache.js';
import { monitor, operationalAlert } from './alerts.js';
import { reportError } from './instrumentation.js';
if (!pool) throw new Error('The worker requires PostgreSQL DATABASE_URL.');
const boss = new PgBoss({ ...postgresPoolConfig(4), useListenNotify: false });
await boss.start();
const jobs: Record<string, (data: any) => Promise<unknown>> = {
  'analytics.retention': () => v2Maintenance('analytics'),
  'handover.overdue': () => v2Maintenance('handover'),
  'lead.response_sla': () => v2Maintenance('leads'),
  'notification.send': notifications,
  'webhook.process': (d) => processWebhook(d.id),
  'media.variants': (d) => generateVariants(d.id),
  'pdf.render': (d) => warmPublishedPdf(d.batch_id),
  'invoice.expire': () => lifecycle('expiry'),
  'invoice.remind': () => lifecycle('reminder'),
  'batch.lifecycle': () => lifecycle('batches'),
  'trip.predeparture': async () => {
    await lifecycle('predeparture');
    await predepartureAlerts();
  },
  'pii.retention': () => lifecycle('retention'),
  'sessions.cleanup': () => lifecycle('cleanup'),
  'payment.reconcile': () => reconcile(),
  'payment.reconcile.full': () => reconcile(true),
  'outbox.recover': recoverBackground,
  monitor: monitor,
};
for (const [name, fn] of Object.entries(jobs)) {
  await boss.createQueue(name);
  await boss.work(name, async (batch) => {
    for (const job of batch) {
      try {
        await fn(job.data);
      } catch (e) {
        reportError(e);
        await operationalAlert('job_failure', 1);
        throw e;
      }
    }
  });
}
const schedules: Record<string, string> = {
  'analytics.retention': '30 3 * * *',
  'handover.overdue': '30 8 * * *',
  'lead.response_sla': '0 * * * *',
  'notification.send': '* * * * *',
  'invoice.expire': '*/5 * * * *',
  'invoice.remind': '0 * * * *',
  'batch.lifecycle': '30 0 * * *',
  'trip.predeparture': '0 8 * * *',
  'pii.retention': '0 3 * * *',
  'sessions.cleanup': '0 4 * * *',
  'payment.reconcile': '*/15 * * * *',
  'payment.reconcile.full': '0 2 * * *',
  'outbox.recover': '*/5 * * * *',
  monitor: '*/5 * * * *',
};
for (const [name, cron] of Object.entries(schedules))
  await boss.schedule(name, cron, {}, { tz: 'Asia/Jakarta' });
console.log('Citadel worker running with WIB schedules.');
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, async () => {
    await boss.stop();
    await closeDb();
    process.exit(0);
  });
