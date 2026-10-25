import { PgBoss } from 'pg-boss';
import { postgresPoolConfig } from '@citadel/db';
import { config } from './config.js';
let queue: PgBoss | undefined;
let opening: Promise<PgBoss> | undefined;
export async function jobQueue() {
  if (!process.env.DATABASE_URL) return null;
  if (!opening)
    opening = (async () => {
      queue = new PgBoss({ ...postgresPoolConfig(2), useListenNotify: false });
      queue.on('error', () => {
        /* Durable domain outbox is retried by recovery jobs. */
      });
      await queue.start();
      for (const name of ['notification.send', 'webhook.process', 'media.variants', 'pdf.render'])
        await queue.createQueue(name);
      return queue;
    })().catch((error) => {
      opening = undefined;
      queue = undefined;
      throw error;
    });
  await opening;
  return queue;
}
export async function wake(name: string, data: Record<string, unknown> = {}) {
  if (config.APP_ENV === 'development') return;
  try {
    await (
      await jobQueue()
    )?.send(name, data, { retryLimit: 5, retryDelay: 60, retryBackoff: true });
  } catch {
    /* Durable domain outbox remains the recovery source. */
  }
}
export async function closeQueue() {
  await queue?.stop();
  queue = undefined;
  opening = undefined;
}
