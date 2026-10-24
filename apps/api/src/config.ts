import { config as dotenv } from 'dotenv';
import { z } from 'zod';
import { randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
export const projectRoot = resolve(import.meta.dirname, '../../..');
dotenv({ path: resolve(projectRoot, '.env'), quiet: true });
const production = process.env.APP_ENV === 'production';
const env = z
  .object({
    APP_ENV: z.enum(['development', 'staging', 'production']).default('development'),
    APP_ORIGIN: z
      .url()
      .default('http://localhost:3000')
      .transform((value) => new URL(value).origin),
    APP_ALLOWED_ORIGINS: z
      .string()
      .default('')
      .transform((value) =>
        value
          .split(',')
          .map((origin) => origin.trim())
          .filter(Boolean)
          .map((origin) => new URL(origin).origin),
      ),
    PORT: z.coerce.number().default(4000),
    PAYMENT_PROVIDER: z
      .enum(['development', 'xendit', 'manual'])
      .default(production ? 'manual' : 'development'),
    EMAIL_PROVIDER: z
      .enum(['development', 'resend'])
      .default(production ? 'resend' : 'development'),
    WHATSAPP_ENABLED: z.enum(['true', 'false']).default('false'),
  })
  .parse(process.env);
if (production && env.PAYMENT_PROVIDER === 'development')
  throw new Error('Development payments are forbidden in production.');
if (production && env.EMAIL_PROVIDER === 'development')
  throw new Error('Development email is forbidden in production.');
if (production && !env.APP_ORIGIN.startsWith('https://'))
  throw new Error('APP_ORIGIN must use HTTPS in production.');
if (production && env.APP_ALLOWED_ORIGINS.some((origin) => !origin.startsWith('https://')))
  throw new Error('APP_ALLOWED_ORIGINS must use HTTPS in production.');
if (production && (process.env.SESSION_SECRET || '').length < 32)
  throw new Error('SESSION_SECRET must contain at least 32 random characters.');
function required(keys: string[]) {
  for (const key of keys)
    if (!process.env[key]) throw new Error(`Missing required configuration: ${key}`);
}
if (production) required(['TURNSTILE_SECRET', 'TURNSTILE_SITE_KEY']);
if (!!process.env.TURNSTILE_SECRET !== !!process.env.TURNSTILE_SITE_KEY)
  throw new Error('Configure both Turnstile keys.');
if (production)
  required([
    'DATABASE_URL',
    'SESSION_SECRET',
    'ENCRYPTION_KEY',
    'R2_ACCOUNT_ID',
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY',
    'R2_PUBLIC_BUCKET',
  ]);
if (process.env.ALERTS_ENABLED === 'true') required(['ALERT_WEBHOOK_URL']);
if (env.PAYMENT_PROVIDER === 'xendit') required(['XENDIT_SECRET_KEY', 'XENDIT_WEBHOOK_TOKEN']);
if (env.EMAIL_PROVIDER === 'resend') required(['RESEND_API_KEY', 'EMAIL_FROM']);
if (env.WHATSAPP_ENABLED === 'true')
  required(['WA_PHONE_NUMBER_ID', 'WA_ACCESS_TOKEN', 'WA_APP_SECRET']);
const dir = resolve(projectRoot, '.data');
mkdirSync(dir, { recursive: true });
let secrets: { session: string; encryption: string };
try {
  secrets = JSON.parse(readFileSync(resolve(dir, 'runtime-secrets.json'), 'utf8'));
} catch {
  secrets = {
    session: randomBytes(32).toString('hex'),
    encryption: randomBytes(32).toString('hex'),
  };
  writeFileSync(resolve(dir, 'runtime-secrets.json'), JSON.stringify(secrets), { mode: 0o600 });
}
const encryption = process.env.ENCRYPTION_KEY || secrets.encryption;
if (!/^[a-f0-9]{64}$/i.test(encryption))
  throw new Error('ENCRYPTION_KEY must be 64 hex characters (32 bytes).');
const keyVersion = Number(process.env.ENCRYPTION_KEY_VERSION || 1);
if (!Number.isInteger(keyVersion) || keyVersion < 1)
  throw new Error('ENCRYPTION_KEY_VERSION must be a positive integer.');
let oldKeys: Record<string, string> = {};
try {
  oldKeys = z
    .record(z.string().regex(/^[1-9][0-9]*$/), z.string().regex(/^[a-f0-9]{64}$/i))
    .parse(JSON.parse(process.env.ENCRYPTION_PREVIOUS_KEYS || '{}'));
} catch {
  throw new Error(
    'ENCRYPTION_PREVIOUS_KEYS must be a JSON object mapping positive versions to 64-character hex keys.',
  );
}
export const config = {
  ...env,
  allowedOrigins: [...new Set([env.APP_ORIGIN, ...env.APP_ALLOWED_ORIGINS])],
  production,
  sessionSecret: process.env.SESSION_SECRET || secrets.session,
  encryptionKey: Buffer.from(encryption, 'hex'),
  encryptionVersion: keyVersion,
  encryptionKeys: [
    Buffer.from(encryption, 'hex'),
    ...Object.values(oldKeys).map((k) => Buffer.from(k, 'hex')),
  ],
  googleEnabled: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
  r2Enabled: !!(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_PUBLIC_BUCKET
  ),
};
