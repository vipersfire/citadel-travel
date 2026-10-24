import { transaction } from '@citadel/db';
import { sha, fail } from './core.js';
// Durable counters use the existing idempotency table in a reserved namespace.
export async function takeLimit(
  scope: string,
  userId: string,
  key: string,
  max: number,
  windowMs: number,
) {
  const bucket = Math.floor(Date.now() / windowMs),
    name = `rate:${scope}:${sha(key).toString('hex')}:${bucket}`;
  return transaction(async (tx) => {
    await tx.query(
      'INSERT INTO idempotency_keys(user_id,key,route,request_hash,response_body) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING',
      [userId, name, 'rate:' + scope, 'counter', JSON.stringify({ count: 0 })],
    );
    const [row] = await tx.query(
      'SELECT response_body FROM idempotency_keys WHERE user_id=$1 AND key=$2 FOR UPDATE',
      [userId, name],
    );
    const count = Number(row.response_body.count) + 1;
    if (count > max) fail('rate_limited', 'Too many attempts. Please wait and try again.', 429);
    await tx.query('UPDATE idempotency_keys SET response_body=$1 WHERE user_id=$2 AND key=$3', [
      JSON.stringify({ count }),
      userId,
      name,
    ]);
    return count;
  });
}
const failed = new Map<string, { count: number; until: number }>();
export async function signInDelay(ip: string, email: string) {
  const key = sha(ip + '|' + email.toLowerCase()).toString('hex'),
    entry = failed.get(key);
  if (entry && entry.until > Date.now())
    fail('rate_limited', 'Too many sign-in attempts. Please wait before trying again.', 429);
  return key;
}
export function signInFailed(key: string) {
  const old = failed.get(key);
  failed.set(key, {
    count: (old?.count || 0) + 1,
    until: Date.now() + Math.min(60000, 2 ** Math.min(old?.count || 0, 6) * 1000),
  });
  if (failed.size > 5000)
    for (const [k, v] of failed) if (v.until < Date.now() - 60000) failed.delete(k);
}
export function signInSucceeded(key: string) {
  failed.delete(key);
}
