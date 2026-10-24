import { v2Routes, v2Maintenance } from './v2.js';
import { config } from './config.js';
import { reportError } from './instrumentation.js';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import { ZodError } from 'zod';
import { seed } from '../../../packages/db/src/seed.js';
import { closeDb, pool } from '@citadel/db';
import { authRoutes, cookieName, cookieOptions } from './auth.js';
import { routes } from './routes.js';
import { adminRoutes } from './admin.js';
import { paymentRoutes } from './payments.js';
import { filesRoutes } from './files.js';
import { workspaceRoutes } from './workspaces.js';
import { uploadRoutes } from './uploads.js';
import { closeQueue } from './queue.js';
import { notifications, lifecycle, recoverBackground, predepartureAlerts } from './jobs.js';
import { AppError } from './core.js';
export const app = Fastify({
  trustProxy: process.env.TRUST_PROXY ? process.env.TRUST_PROXY.split(',') : false,
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    serializers: {
      req: (req) => ({
        id: req.id,
        method: req.method,
        url: req.url?.split('?')[0],
        remoteAddress: req.ip,
      }),
    },
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'req.headers["x-callback-token"]',
        'password',
        'token',
        'passport_number',
        'totp_secret',
        'body.password',
        'body.token',
      ],
      censor: '[Redacted]',
    },
  },
  bodyLimit: 1048576,
});
app.addContentTypeParser(
  ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm'],
  { parseAs: 'buffer', bodyLimit: 83886080 },
  (_req, body, done) => done(null, body),
);
await app.register(cookie, { secret: config.sessionSecret });
await app.register(helmet, { contentSecurityPolicy: false });
await app.register(rateLimit, {
  max: (req) => (['GET', 'HEAD'].includes(req.method) ? 600 : 180),
  keyGenerator: (req) => req.ip + (['GET', 'HEAD'].includes(req.method) ? ':read' : ':write'),
  timeWindow: '1 minute',
  hook: 'preHandler',
});
await app.register(multipart, { limits: { fileSize: 83886080, files: 1, fields: 20 } });
app.addHook('onSend', async (req, reply, payload) => {
  if ((req as any).refreshSessionCookie && req.cookies[cookieName])
    reply.setCookie(cookieName, req.cookies[cookieName]!, { ...cookieOptions, maxAge: 30 * 86400 });
  return payload;
});
app.addHook('onRequest', async (req, reply) => {
  if (
    !['GET', 'HEAD', 'OPTIONS'].includes(req.method) &&
    req.url !== '/api/webhooks/xendit' &&
    !config.allowedOrigins.includes(req.headers.origin || '')
  )
    throw new AppError('invalid_origin', 'Request origin is not allowed.', 403);
  if (
    req.url.startsWith('/api/me') ||
    req.url.startsWith('/api/admin') ||
    req.url.startsWith('/api/auth')
  )
    reply.header('Cache-Control', 'no-store');
});
app.addHook('preParsing', async (req, _reply, payload) => {
  if (req.url === '/api/webhooks/xendit') {
    const chunks: Buffer[] = [];
    for await (const chunk of payload) {
      chunks.push(Buffer.from(chunk));
      if (chunks.reduce((s, c) => s + c.length, 0) > 1048576)
        throw new AppError('payload_too_large', 'Webhook too large.', 413);
    }
    const raw = Buffer.concat(chunks);
    (req as any).rawBody = raw;
    return (await import('node:stream')).Readable.from(raw);
  }
  return payload;
});
app.setErrorHandler((e, req, reply) => {
  if (e instanceof ZodError)
    return reply.code(422).send({
      error: {
        code: 'validation',
        message: 'Please check the form fields.',
        details: e.flatten(),
      },
    });
  if (e instanceof AppError)
    return reply
      .code(e.statusCode)
      .send({ error: { code: e.code, message: e.message, details: e.details } });
  if ((e as any).code === '23505')
    return reply
      .code(409)
      .send({ error: { code: 'conflict', message: 'This record already exists.', details: {} } });
  if ((e as any).code === '23503' || (e as any).code === '23514' || (e as any).code === '23502')
    return reply.code(422).send({
      error: {
        code: 'invalid_record',
        message: 'Check required fields and related records.',
        details: {},
      },
    });
  reportError(e);
  app.log.error(
    { error_code: (e as any).code, error_message: (e as any).message },
    'Request failed',
  );
  reply.code((e as any).statusCode || 500).send({
    error: {
      code: 'server_error',
      message: 'Something went wrong. Please try again.',
      details: {},
    },
  });
});
export const routeRegistry: { method: string; url: string }[] = [];
app.addHook('onRoute', (route) => {
  for (const method of Array.isArray(route.method) ? route.method : [route.method])
    routeRegistry.push({ method, url: route.url });
});
await seed();
await authRoutes(app);
await routes(app);
await v2Routes(app);
await adminRoutes(app);
await paymentRoutes(app);
await filesRoutes(app);
await workspaceRoutes(app);
await uploadRoutes(app);
let busy = false;
const tick = async () => {
  if (busy) return;
  busy = true;
  try {
    await lifecycle();
    await notifications();
    await recoverBackground();
    await predepartureAlerts();
    await v2Maintenance();
  } catch (e) {
    app.log.error({ err: e }, 'Background job failed');
  } finally {
    busy = false;
  }
};
const standalone = !!process.argv[1]?.endsWith('server.ts');
const inlineJobs = standalone && (!pool || config.APP_ENV === 'development');
const timer = inlineJobs
  ? setInterval(
      tick,
      config.APP_ENV === 'development'
        ? Math.max(1000, Number(process.env.DEV_JOB_INTERVAL_MS) || 30000)
        : 30000,
    )
  : null;
if (inlineJobs) void tick();
if (standalone) await app.listen({ port: config.PORT, host: '0.0.0.0' });
if (standalone)
  for (const signal of ['SIGINT', 'SIGTERM'])
    process.on(signal, async () => {
      if (timer) clearInterval(timer);
      await app.close();
      await closeQueue();
      await closeDb();
      process.exit(0);
    });
