import {
  createHash,
  randomBytes,
  createCipheriv,
  createDecipheriv,
  timingSafeEqual,
} from 'node:crypto';
import { db, type Connection, type Row } from '@citadel/db';
import { config } from './config.js';
import type { FastifyRequest } from 'fastify';
import { canTransition, publicTravelerResponseSchema } from '@citadel/contracts';
import { wake } from './queue.js';
import { date, money, status } from '@citadel/i18n';
export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode = 400,
    public details: Record<string, unknown> = {},
  ) {
    super(message);
  }
}
export function fail(
  code: string,
  message: string,
  status = 400,
  details: Record<string, unknown> = {},
): never {
  throw new AppError(code, message, status, details);
}
export const sha = (s: string | Buffer) => createHash('sha256').update(s).digest();
export const token = () => randomBytes(32).toString('base64url');
export function encrypt(value: string) {
  const iv = randomBytes(12),
    cipher = createCipheriv('aes-256-gcm', config.encryptionKey, iv);
  const body = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]);
}
export function decrypt(value: Uint8Array) {
  const b = Buffer.from(value);
  for (const key of config.encryptionKeys) {
    try {
      const decipher = createDecipheriv('aes-256-gcm', key, b.subarray(0, 12));
      decipher.setAuthTag(b.subarray(12, 28));
      return Buffer.concat([decipher.update(b.subarray(28)), decipher.final()]).toString('utf8');
    } catch {}
  }
  throw new Error('Encrypted data cannot be read with configured key versions.');
}
export function secureEqual(a: string, b: string) {
  const x = sha(a),
    y = sha(b);
  return timingSafeEqual(x, y);
}
export function transition(entity: string, from: string, to: string) {
  if (!canTransition(entity, from, to))
    fail('invalid_transition', `Cannot move ${entity} from ${from} to ${to}.`, 409);
}
export function publicUser(u: Row) {
  return {
    id: u.id,
    email: u.email,
    full_name: u.full_name,
    role: u.role,
    locale: u.locale,
    whatsapp_e164: u.whatsapp_e164,
    whatsapp_opt_in: u.whatsapp_opt_in,
    email_verified_at: u.email_verified_at,
    totp_enabled_at: u.totp_enabled_at,
  };
}
export function publicTraveler(t: Row): Row {
  return publicTravelerResponseSchema.parse({
    ...t,
    passport_masked: t.passport_number_last3 ? `•••••${t.passport_number_last3}` : null,
  });
}
export async function ownedBooking(userId: string, code: string, tx: Connection = db) {
  const [b] = await tx.query('SELECT * FROM bookings WHERE user_id=$1 AND code=$2', [userId, code]);
  if (!b) fail('not_found', 'Journey not found.', 404);
  return b;
}
export async function audit(
  tx: Connection,
  req: FastifyRequest | null,
  action: string,
  entity: string,
  id: string,
  before: unknown,
  after: unknown,
) {
  const sanitize = (v: unknown) =>
    JSON.stringify(v, (key, value) =>
      /password|token|passport_number|totp|secret/i.test(key) ? '[Redacted]' : value,
    );
  await tx.query(
    'INSERT INTO audit_logs(actor_user_id,action,entity_type,entity_id,before,after,ip,user_agent) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
    [
      (req as any)?.user?.id || null,
      action,
      entity,
      id,
      sanitize(before),
      sanitize(after),
      req?.ip || null,
      req?.headers['user-agent'] || null,
    ],
  );
}
export async function notify(
  tx: Connection,
  userId: string,
  key: string,
  bookingId: string | null,
  payload: Row = {},
) {
  const [u] = await tx.query('SELECT * FROM users WHERE id=$1', [userId]);
  if (!u) return;
  if (bookingId && !payload.url) {
    const [b] = await tx.query('SELECT code FROM bookings WHERE id=$1', [bookingId]);
    if (b)
      payload = { ...payload, url: `${config.APP_ORIGIN}/${u.locale}/account/trips/${b.code}` };
  }
  if (payload.url)
    payload = {
      ...payload,
      url: String(payload.url).replace(/\/(id|en)\/account/, `/${u.locale}/account`),
    };
  if (
    ['offer_ready', 'payment_reminder', 'payment_received', 'offer_expired'].includes(key) &&
    bookingId
  ) {
    const [inv] = await tx.query(
      'SELECT due_at,total FROM invoices WHERE booking_id=$1 AND (number=$2 OR id::text=$3) ORDER BY created_at DESC LIMIT 1',
      [
        bookingId,
        typeof payload.message === 'string' ? payload.message : '',
        payload.invoice_id || '',
      ],
    );
    if (inv)
      payload = {
        ...payload,
        amount: money(inv.total),
        deadline:
          date(inv.due_at, u.locale, true) +
          ' · ' +
          new Intl.DateTimeFormat(u.locale === 'id' ? 'id-ID' : 'en-GB', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Asia/Jakarta',
          }).format(new Date(inv.due_at)) +
          ' WIB',
      };
  }
  if (key === 'visa_status_changed' && typeof payload.message === 'string')
    payload = { ...payload, message: status(payload.message, u.locale) };
  for (const channel of [
    'email',
    ...(u.whatsapp_opt_in && u.whatsapp_e164 && !['email_verify', 'password_reset'].includes(key)
      ? ['whatsapp']
      : []),
  ])
    await tx.query(
      'INSERT INTO notifications(user_id,booking_id,channel,template_key,locale,to_address,payload) VALUES($1,$2,$3,$4,$5,$6,$7)',
      [
        u.id,
        bookingId,
        channel,
        key,
        u.locale,
        channel === 'email' ? u.email : u.whatsapp_e164,
        JSON.stringify({
          name: u.full_name,
          ...payload,
          ...(payload.message && typeof payload.message === 'object'
            ? { message: payload.message[u.locale] || payload.message.id }
            : {}),
        }),
      ],
    );
  setImmediate(() => void wake('notification.send'));
}
export function safeNext(input: unknown, fallback = '/id/account') {
  return typeof input === 'string' && /^\/(id|en)\/(account|sign-in)(\/|\?|$)/.test(input)
    ? input
    : fallback;
}
