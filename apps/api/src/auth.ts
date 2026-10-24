import { inputSchemas } from '@citadel/contracts/requests';
import { signInDelay, signInFailed, signInSucceeded } from './rate-limits.js';
import { changePasswordSchema } from '@citadel/contracts';
import { config } from './config.js';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { db, transaction } from '@citadel/db';
import { hash, verify } from '@node-rs/argon2';
import { signUpSchema, signInSchema } from '@citadel/contracts';
import { authenticator } from 'otplib';
import { Google, generateState, generateCodeVerifier, decodeIdToken } from 'arctic';
import {
  fail,
  sha,
  token,
  encrypt,
  decrypt,
  publicUser,
  notify,
  audit,
  safeNext,
  secureEqual,
} from './core.js';
export const cookieName = config.production ? '__Host-citadel_sid' : 'citadel_sid';
export const cookieOptions = {
  path: '/',
  httpOnly: true,
  secure: config.production,
  sameSite: 'lax' as const,
};
export async function createSession(reply: FastifyReply, user: any) {
  const value = token();
  await db.query('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,$3)', [
    sha(value),
    user.id,
    new Date(Date.now() + (user.role === 'admin' ? 7 : 30) * 86400000),
  ]);
  reply.setCookie(cookieName, value, {
    ...cookieOptions,
    maxAge: (user.role === 'admin' ? 7 : 30) * 86400,
  });
}
export async function authenticate(req: FastifyRequest, admin = false) {
  const value = req.cookies[cookieName];
  if (!value) fail('unauthorized', 'Please sign in.', 401);
  const [s] = await db.query(
    "SELECT s.id as session_id,s.mfa_verified_at,s.last_seen_at,s.expires_at as session_expires_at,s.created_at as session_created_at,u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now() AND u.status='active' AND u.deleted_at IS NULL",
    [sha(value)],
  );
  if (!s) fail('unauthorized', 'Your session has expired. Please sign in.', 401);
  if (s.role === 'admin' && Date.now() - new Date(s.last_seen_at).getTime() > 8 * 3600000) {
    await db.query('DELETE FROM sessions WHERE id=$1', [s.session_id]);
    fail('unauthorized', 'Admin session expired.', 401);
  }
  if (admin && (s.role !== 'admin' || !s.mfa_verified_at))
    fail('mfa_required', 'Administrator authentication and two-factor verification required.', 403);
  await db.query(
    "UPDATE sessions SET last_seen_at=now(),expires_at=CASE WHEN $2='member' AND expires_at<now()+interval '15 days' THEN now()+interval '30 days' ELSE expires_at END WHERE id=$1",
    [s.session_id, s.role],
  );
  (req as any).user = s;
  (req as any).refreshSessionCookie =
    s.role === 'member' && new Date(s.session_expires_at).getTime() < Date.now() + 15 * 86400000;
  return s;
}
export async function botCheck(value?: string) {
  if (!process.env.TURNSTILE_SECRET) {
    if (config.production) fail('configuration', 'Turnstile is not configured.', 503);
    return;
  }
  const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: new URLSearchParams({ secret: process.env.TURNSTILE_SECRET, response: value || '' }),
  });
  const body = (await r.json()) as any;
  if (!body.success) fail('bot_check', 'Please complete the security check.');
}
async function checkPassword(password: string) {
  const hashHex = (await import('node:crypto'))
    .createHash('sha1')
    .update(password)
    .digest('hex')
    .toUpperCase();
  try {
    const r = await fetch('https://api.pwnedpasswords.com/range/' + hashHex.slice(0, 5), {
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) throw new Error('Password check unavailable');
    const text = await r.text();
    if (text.split('\n').some((x) => x.split(':')[0] === hashHex.slice(5)))
      fail('weak_password', 'Choose a password that has not appeared in a data breach.');
  } catch (e) {
    if (e instanceof Error && e.message.includes('breach')) throw e;
    if (config.production)
      fail(
        'password_check_unavailable',
        'Password verification is unavailable. Please try again.',
        503,
      );
  }
}
async function emailToken(user: any, type: string, minutes: number) {
  const value = token();
  await transaction(async (tx) => {
    await tx.query(
      'INSERT INTO auth_tokens(user_id,type,token_hash,expires_at) VALUES($1,$2,$3,$4)',
      [user.id, type, sha(value), new Date(Date.now() + minutes * 60000)],
    );
    await notify(tx, user.id, type, null, {
      url: `${config.APP_ORIGIN}/${user.locale}/${type === 'email_verify' ? 'verify-email' : 'reset-password'}?token=${value}`,
    });
  });
  return config.APP_ENV === 'development' && config.EMAIL_PROVIDER === 'development'
    ? value
    : undefined;
}
export async function authRoutes(app: FastifyInstance) {
  app.get('/api/auth/me', async (req) => {
    try {
      const u = await authenticate(req);
      return { user: publicUser(u), mfa_verified: !!u.mfa_verified_at };
    } catch {
      return { user: null };
    }
  });
  app.get('/api/public/config', async () => ({
    development: config.APP_ENV === 'development',
    upload_origin: config.r2Enabled
      ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
      : '',
    google: config.googleEnabled,
    payments: config.PAYMENT_PROVIDER,
    turnstile_site_key: process.env.TURNSTILE_SITE_KEY || null,
    sentry_dsn: process.env.SENTRY_DSN_PUBLIC || null,
  }));
  app.post(
    '/api/auth/sign-up',
    { config: { rateLimit: { max: 3, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const b = signUpSchema.parse(req.body);
      await botCheck(b.turnstile_token);
      await checkPassword(b.password);
      const existing = await db.query('SELECT id FROM users WHERE email=$1', [b.email]);
      if (existing.length)
        fail(
          'email_exists',
          'An account already uses this email. Sign in or reset your password.',
          409,
        );
      const [u] = await transaction(async (tx) => {
        const users = await tx.query(
          'INSERT INTO users(email,full_name,password_hash,whatsapp_e164,whatsapp_opt_in,locale) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',
          [
            b.email,
            b.full_name,
            await hash(b.password, { memoryCost: 19456, timeCost: 2, parallelism: 1 }),
            b.whatsapp_e164 || null,
            b.whatsapp_opt_in,
            b.locale,
          ],
        );
        await tx.query('UPDATE leads SET user_id=$1,updated_at=now() WHERE email=$2', [
          users[0].id,
          b.email,
        ]);
        return users;
      });
      await createSession(reply, u);
      return { user: publicUser(u), development_token: await emailToken(u, 'email_verify', 1440) };
    },
  );
  app.post(
    '/api/auth/sign-in',
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: '1 minute',
          keyGenerator: (req: any) => req.ip + '|' + String(req.body?.email || '').toLowerCase(),
        },
      },
    },
    async (req, reply) => {
      const b = signInSchema.parse(req.body);
      const delayKey = await signInDelay(req.ip, b.email);
      const [u] = await db.query(
        "SELECT * FROM users WHERE email=$1 AND status='active' AND deleted_at IS NULL",
        [b.email],
      );
      if (!u?.password_hash || !(await verify(u.password_hash, b.password))) {
        signInFailed(delayKey);
        fail('invalid_credentials', 'Email or password is incorrect.', 401);
      }
      signInSucceeded(delayKey);
      await createSession(reply, u);
      return { user: publicUser(u), mfa_required: u.role === 'admin' };
    },
  );
  app.get('/api/me/auth-links', async (req) => {
    const u = await authenticate(req);
    return {
      google_enabled: config.googleEnabled,
      links: await db.query('SELECT provider,email FROM oauth_accounts WHERE user_id=$1', [u.id]),
      has_password: !!u.password_hash,
    };
  });
  app.post('/api/me/change-password', async (req) => {
    const u = await authenticate(req),
      b = changePasswordSchema.parse(req.body);
    if (
      u.password_hash &&
      (!b.current_password || !(await verify(u.password_hash, b.current_password)))
    )
      fail('invalid_credentials', 'Current password is incorrect.', 403);
    await checkPassword(b.password);
    await transaction(async (tx) => {
      await tx.query('UPDATE users SET password_hash=$1,updated_at=now() WHERE id=$2', [
        await hash(b.password, { memoryCost: 19456, timeCost: 2, parallelism: 1 }),
        u.id,
      ]);
      await tx.query('DELETE FROM sessions WHERE user_id=$1 AND id<>$2', [u.id, u.session_id]);
      await audit(tx, req, 'account.password_changed', 'user', u.id, null, { changed: true });
    });
    return { ok: true };
  });
  app.post('/api/auth/sign-out', async (req, reply) => {
    if (req.cookies[cookieName])
      await db.query('DELETE FROM sessions WHERE token_hash=$1', [sha(req.cookies[cookieName]!)]);
    reply.clearCookie(cookieName, cookieOptions);
    return { ok: true };
  });
  app.post('/api/auth/verify-email', async (req) => {
    const { token: value } = inputSchemas.auth_auth_verify_email_token.parse(req.body);
    await transaction(async (tx) => {
      const [t] = await tx.query(
        "SELECT * FROM auth_tokens WHERE token_hash=$1 AND type='email_verify' AND used_at IS NULL AND expires_at>now() FOR UPDATE",
        [sha(value)],
      );
      if (!t) fail('invalid_token', 'This verification link has expired or was already used.');
      await tx.query('UPDATE auth_tokens SET used_at=now() WHERE id=$1', [t.id]);
      await tx.query('UPDATE users SET email_verified_at=now(),updated_at=now() WHERE id=$1', [
        t.user_id,
      ]);
    });
    return { ok: true };
  });
  app.post('/api/auth/resend-verification', async (req) => {
    const u = await authenticate(req);
    return {
      ok: true,
      development_token: !u.email_verified_at
        ? await emailToken(u, 'email_verify', 1440)
        : undefined,
    };
  });
  app.post(
    '/api/auth/forgot-password',
    { config: { rateLimit: { max: 3, timeWindow: '10 minutes' } } },
    async (req) => {
      const b = inputSchemas.auth_auth_forgot_password_b.parse(req.body);
      await botCheck(b.turnstile_token);
      const [u] = await db.query("SELECT * FROM users WHERE email=$1 AND status='active'", [
        b.email,
      ]);
      const dev = u ? await emailToken(u, 'password_reset', 30) : undefined;
      return { ok: true, development_token: dev };
    },
  );
  app.post('/api/auth/reset-password', async (req) => {
    const b = inputSchemas.auth_auth_reset_password_b.parse(req.body);
    await checkPassword(b.password);
    await transaction(async (tx) => {
      const [t] = await tx.query(
        "SELECT * FROM auth_tokens WHERE token_hash=$1 AND type='password_reset' AND used_at IS NULL AND expires_at>now() FOR UPDATE",
        [sha(b.token)],
      );
      if (!t) fail('invalid_token', 'This reset link has expired or was already used.');
      await tx.query('UPDATE auth_tokens SET used_at=now() WHERE id=$1', [t.id]);
      await tx.query('UPDATE users SET password_hash=$1,updated_at=now() WHERE id=$2', [
        await hash(b.password, { memoryCost: 19456, timeCost: 2, parallelism: 1 }),
        t.user_id,
      ]);
      await tx.query('DELETE FROM sessions WHERE user_id=$1', [t.user_id]);
    });
    return { ok: true };
  });
  app.post('/api/admin/auth/totp/enroll', async (req) => {
    const u = await authenticate(req);
    if (u.role !== 'admin') fail('forbidden', 'Admin only.', 403);
    if (u.totp_enabled_at)
      fail('already_enrolled', 'Two-factor authentication is already enabled.', 409);
    const secret = authenticator.generateSecret();
    await db.query('UPDATE users SET totp_secret_enc=$1,updated_at=now() WHERE id=$2', [
      encrypt(secret),
      u.id,
    ]);
    return { secret, uri: authenticator.keyuri(u.email, 'Citadel', secret) };
  });
  app.post('/api/admin/auth/totp/verify', async (req) => {
    const u = await authenticate(req);
    if (u.role !== 'admin') fail('forbidden', 'Admin only.', 403);
    const b = inputSchemas.auth_admin_auth_totp_verify_b.parse(req.body);
    if (!u.totp_secret_enc) fail('enrollment_required', 'Enroll your authenticator first.');
    let ok = authenticator.clone({ window: 1 }).check(b.code, decrypt(u.totp_secret_enc));
    let recoveryCodes: string[] | undefined;
    await transaction(async (tx) => {
      await tx.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [u.id]);
      if (!ok && u.totp_enabled_at) {
        const [r] = await tx.query(
          'SELECT * FROM admin_recovery_codes WHERE user_id=$1 AND code_hash=$2 AND used_at IS NULL FOR UPDATE',
          [u.id, sha(b.code).toString('hex')],
        );
        if (r) {
          await tx.query('UPDATE admin_recovery_codes SET used_at=now() WHERE id=$1', [r.id]);
          ok = true;
        }
      }
      if (!ok) fail('invalid_totp', 'The code is incorrect.', 401);
      if (!u.totp_enabled_at) {
        recoveryCodes = Array.from({ length: 10 }, () => token().slice(0, 16));
        for (const code of recoveryCodes)
          await tx.query('INSERT INTO admin_recovery_codes(user_id,code_hash) VALUES($1,$2)', [
            u.id,
            sha(code).toString('hex'),
          ]);
        await tx.query('UPDATE users SET totp_enabled_at=now(),updated_at=now() WHERE id=$1', [
          u.id,
        ]);
      }
      await tx.query('UPDATE sessions SET mfa_verified_at=now() WHERE id=$1', [u.session_id]);
      await audit(tx, req, 'auth.mfa_verify', 'user', u.id, null, { verified: true });
    });
    return { ok: true, recovery_codes: recoveryCodes };
  });
  app.get('/auth/google/start', async (req, reply) => {
    if (!config.googleEnabled)
      fail('not_configured', 'Google OAuth client ID and secret are not configured.', 503);
    const q = req.query as any,
      state = generateState(),
      verifier = generateCodeVerifier();
    const oauth = new Google(
      process.env.GOOGLE_CLIENT_ID!,
      process.env.GOOGLE_CLIENT_SECRET!,
      process.env.GOOGLE_REDIRECT_URI || `${config.APP_ORIGIN}/auth/google/callback`,
    );
    const linking = q.link === 'true' ? await authenticate(req) : null;
    if (linking && linking.role !== 'member')
      fail('forbidden', 'Administrators cannot link Google.', 403);
    reply.setCookie(
      'citadel_oauth',
      JSON.stringify({ state, verifier, next: safeNext(q.next), link_user_id: linking?.id }),
      {
        ...cookieOptions,
        signed: true,
        maxAge: 600,
      },
    );
    return reply.redirect(
      oauth.createAuthorizationURL(state, verifier, ['openid', 'email', 'profile']).toString(),
    );
  });
  app.get('/auth/google/callback', async (req, reply) => {
    const raw = req.cookies.citadel_oauth;
    const signed = raw ? req.unsignCookie(raw) : null;
    if (!signed?.valid || !signed.value) fail('invalid_oauth', 'The sign-in request has expired.');
    const saved = JSON.parse(signed.value),
      q = req.query as any;
    if (!secureEqual(q.state || '', saved.state) || !q.code)
      fail('invalid_oauth', 'OAuth state is invalid.');
    reply.clearCookie('citadel_oauth', cookieOptions);
    const oauth = new Google(
      process.env.GOOGLE_CLIENT_ID!,
      process.env.GOOGLE_CLIENT_SECRET!,
      process.env.GOOGLE_REDIRECT_URI || `${config.APP_ORIGIN}/auth/google/callback`,
    );
    const tokens = await oauth.validateAuthorizationCode(q.code, saved.verifier);
    const profile = decodeIdToken(tokens.idToken()) as any;
    if (!profile.email_verified) fail('unverified_google', 'Google email must be verified.', 403);
    const u = await transaction(async (tx) => {
      if (saved.link_user_id) {
        const current = await authenticate(req);
        if (
          current.id !== saved.link_user_id ||
          current.email.toLowerCase() !== String(profile.email).toLowerCase() ||
          !current.email_verified_at
        )
          fail('invalid_link', 'Use your verified account email to link Google.', 403);
      }
      let [user] = await tx.query(
        "SELECT u.* FROM oauth_accounts o JOIN users u ON u.id=o.user_id WHERE provider='google' AND provider_user_id=$1",
        [profile.sub],
      );
      if (!user) {
        [user] = await tx.query('SELECT * FROM users WHERE email=$1', [profile.email]);
        if (user && !user.email_verified_at)
          fail(
            'unverified_email_match',
            'Sign in with your password or reset it before linking Google.',
            409,
          );
        if (user?.role === 'admin')
          fail('admin_google_forbidden', 'Administrators must use password and TOTP.', 403);
        if (!user)
          [user] = await tx.query(
            'INSERT INTO users(email,full_name,email_verified_at) VALUES($1,$2,now()) RETURNING *',
            [profile.email, profile.name || profile.email],
          );
        await tx.query(
          "INSERT INTO oauth_accounts(user_id,provider,provider_user_id,email) VALUES($1,'google',$2,$3)",
          [user.id, profile.sub, profile.email],
        );
      }
      if (user.role === 'admin' || user.status !== 'active')
        fail('forbidden', 'This account cannot sign in with Google.', 403);
      await tx.query('UPDATE leads SET user_id=$1,updated_at=now() WHERE email=$2', [
        user.id,
        user.email,
      ]);
      return user;
    });
    await createSession(reply, u);
    return reply.redirect(saved.next);
  });
}
