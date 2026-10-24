import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { createServer, request as httpRequest } from 'node:http';
const directory = await mkdtemp(join(tmpdir(), 'citadel-preview-')),
  root = resolve(import.meta.dirname, '..');
const env = {
  ...process.env,
  APP_ENV: 'development',
  APP_ORIGIN: process.env.CITADEL_CHECK_ORIGIN || 'http://localhost:3330',
  PORT: '4450',
  API_INTERNAL_URL: 'http://127.0.0.1:4450',
  DATABASE_URL: '',
  PGLITE_DIR: directory,
  LOCAL_FILES_DIR: join(directory, 'files'),
  LOCAL_MEDIA_DIR: join(directory, 'media'),
  CLOUDFLARE_ZONE_ID: '',
  CLOUDFLARE_API_TOKEN: '',
  PAYMENT_PROVIDER: 'development',
  EMAIL_PROVIDER: 'development',
  WHATSAPP_ENABLED: 'false',
  GOOGLE_CLIENT_ID: '',
  GOOGLE_CLIENT_SECRET: '',
  R2_ACCOUNT_ID: '',
  R2_ACCESS_KEY_ID: '',
  R2_SECRET_ACCESS_KEY: '',
  TURNSTILE_SECRET: '',
  TURNSTILE_SITE_KEY: '',
  SENTRY_DSN: '',
  SENTRY_DSN_PUBLIC: '',
  ALERTS_ENABLED: 'false',
  ENCRYPTION_PREVIOUS_KEYS: '',
  SEED_ADMIN_EMAIL: '',
  SEED_ADMIN_PASSWORD: '',
  SESSION_SECRET: randomBytes(32).toString('hex'),
  ENCRYPTION_KEY: randomBytes(32).toString('hex'),
  LOG_LEVEL: 'warn',
};
const fixtures = spawnSync(
  process.execPath,
  ['--import', 'tsx', 'scripts/seed-check-fixtures.ts'],
  { cwd: root, env: { ...env, CITADEL_CHECK_FIXTURES: 'true' }, encoding: 'utf8' },
);
if (fixtures.status !== 0) throw new Error(fixtures.stderr || 'Check fixture seed failed');
const api = spawn(process.execPath, ['--import', 'tsx', 'apps/api/src/server.ts'], {
  cwd: root,
  env,
  stdio: 'inherit',
});
const web = spawn(
  process.execPath,
  ['node_modules/@react-router/serve/bin.js', 'build/server/index.js'],
  { cwd: join(root, 'apps/web'), env: { ...env, PORT: '3331' }, stdio: 'inherit' },
);
const gateway = createServer((req, res) => {
  const apiPath = /^\/(api|auth)(\/|$)/.test(req.url || '') || req.url === '/healthz';
  const upstream = httpRequest(
    {
      hostname: '127.0.0.1',
      port: apiPath ? 4450 : 3331,
      path: req.url,
      method: req.method,
      headers: req.headers,
    },
    (response) => {
      res.writeHead(response.statusCode || 502, response.headers);
      response.pipe(res);
    },
  );
  upstream.on('error', () => {
    res.writeHead(503);
    res.end('Preview starting');
  });
  req.pipe(upstream);
});
gateway.listen(3330, process.env.PREVIEW_LISTEN_HOST || '127.0.0.1');
let closing = false;
async function close() {
  if (closing) return;
  closing = true;
  gateway.close();
  api.kill('SIGTERM');
  web.kill('SIGTERM');
  await Promise.all(
    [api, web].map(
      (child) =>
        new Promise<void>((resolve) => {
          if (child.exitCode !== null) return resolve();
          child.once('exit', () => resolve());
          setTimeout(() => {
            child.kill('SIGKILL');
            resolve();
          }, 5000).unref();
        }),
    ),
  );
  await rm(directory, { recursive: true });
}
for (const signal of ['SIGTERM', 'SIGINT'])
  process.on(signal, async () => {
    await close();
    process.exit(0);
  });
for (const child of [api, web])
  child.on('exit', () => {
    if (!closing) void close().then(() => process.exit(1));
  });
