import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { randomInt } from 'node:crypto';
import { z } from 'zod';
import { config } from '../../config.js';
import { query, one, tx } from '../../lib/db.js';
import { requireUser, signAccessToken, type AuthUser } from '../../lib/auth.js';
import { badRequest, notFound, tooMany, unauthorized, unavailable } from '../../lib/errors.js';
import { cartClient } from '../../lib/clients.js';
import { sendOtp } from '../../lib/whatsapp.js';
import { hmacHex, maskPhone, normalizePhone, randomToken, safeEqualHex, sha256 } from '../../lib/util.js';

/**
 * Login with phone number + a 6-digit code sent on WhatsApp.
 * Codes are stored as HMACs, expire in OTP_TTL_MINUTES, allow OTP_MAX_ATTEMPTS guesses,
 * and requests are rate-limited per phone and per IP.
 * Sessions: short-lived access token (Authorization: Bearer) + rotating refresh token in an httpOnly cookie.
 */

const COOKIE = 'aribas_rt';
const RESEND_SECONDS = 30;

const codeHash = (phone: string, code: string) => hmacHex(config.JWT_SECRET, `otp:${phone}:${code}`);

export const userApi = (u: any) => ({ id: u.id, phone: u.phone, name: u.name, email: u.email, role: u.role, createdAt: u.created_at });

async function startSession(req: FastifyRequest, reply: FastifyReply, user: any) {
  const token = randomToken();
  await query(`INSERT INTO users.sessions (user_id, token_hash, user_agent, expires_at) VALUES ($1, $2, $3, now() + make_interval(days => $4))`, [
    user.id,
    sha256(token),
    String(req.headers['user-agent'] ?? '').slice(0, 300),
    config.REFRESH_TOKEN_DAYS,
  ]);
  reply.setCookie(COOKIE, token, {
    path: '/api/auth',
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: config.cookieSecure ? 'none' : 'lax',
    maxAge: config.REFRESH_TOKEN_DAYS * 86400,
  });
  const authUser: AuthUser = { id: user.id, role: user.role, phone: user.phone };
  // Also returned in the body: browsers block third-party cookies when the API is on another site
  // (e.g. two *.onrender.com hosts), so the storefront keeps it and sends it to /refresh itself.
  return { accessToken: await signAccessToken(authUser), refreshToken: token, expiresIn: config.ACCESS_TOKEN_MINUTES * 60, user: userApi(user) };
}

const addressBody = z.object({
  fullName: z.string().trim().min(2).max(80),
  phone: z.string().transform(normalizePhone),
  line1: z.string().trim().min(3).max(160),
  line2: z.string().trim().max(160).default(''),
  city: z.string().trim().min(2).max(60),
  state: z.string().trim().min(2).max(60),
  pincode: z.string().regex(/^[1-9]\d{5}$/, 'Enter a valid 6-digit pincode'),
  isDefault: z.boolean().default(false),
});
export const addressApi = (a: any) => ({
  id: a.id, fullName: a.full_name, phone: a.phone, line1: a.line1, line2: a.line2, city: a.city, state: a.state, pincode: a.pincode, isDefault: a.is_default,
});

export async function authRoutes(app: FastifyInstance) {
  app.post('/api/auth/otp/request', async (req) => {
    const phone = normalizePhone((req.body as any)?.phone);
    const ip = req.ip;
    const last = await one(`SELECT created_at FROM users.otp_codes WHERE phone = $1 ORDER BY created_at DESC LIMIT 1`, [phone]);
    if (last) {
      const wait = RESEND_SECONDS - Math.floor((Date.now() - new Date(last.created_at).getTime()) / 1000);
      if (wait > 0) throw tooMany(`Please wait ${wait}s before requesting another code.`);
    }
    const counts = await one(
      `SELECT (SELECT count(*) FROM users.otp_codes WHERE phone = $1 AND created_at > now() - interval '15 minutes')::int AS phone_n,
              (SELECT count(*) FROM users.otp_codes WHERE ip = $2 AND created_at > now() - interval '1 hour')::int AS ip_n`,
      [phone, ip],
    );
    if (counts.phone_n >= 5) throw tooMany('Too many codes requested for this number. Try again in 15 minutes.');
    if (counts.ip_n >= 20) throw tooMany('Too many requests. Try again later.');

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const row = await one(
      `INSERT INTO users.otp_codes (phone, code_hash, ip, expires_at) VALUES ($1, $2, $3, now() + make_interval(mins => $4)) RETURNING id`,
      [phone, codeHash(phone, code), ip, config.OTP_TTL_MINUTES],
    );
    try {
      await sendOtp(phone, code);
    } catch (err) {
      req.log.error({ err, phone: maskPhone(phone) }, 'OTP send failed');
      await query('DELETE FROM users.otp_codes WHERE id = $1', [row.id]);
      throw unavailable('Could not send the code on WhatsApp right now. Please try again.');
    }
    return {
      ok: true,
      expiresIn: config.OTP_TTL_MINUTES * 60,
      resendIn: RESEND_SECONDS,
      // Local development only: no WhatsApp is configured, so show the code.
      ...(config.WHATSAPP_PROVIDER === 'console' && !config.isProd ? { devCode: code } : {}),
    };
  });

  app.post('/api/auth/otp/verify', async (req, reply) => {
    const b = z.object({ phone: z.string().transform(normalizePhone), code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code'), name: z.string().trim().max(80).optional() }).parse(req.body);
    const otp = await one(
      `SELECT * FROM users.otp_codes WHERE phone = $1 AND consumed_at IS NULL AND expires_at > now() ORDER BY created_at DESC LIMIT 1`,
      [b.phone],
    );
    if (!otp) throw badRequest('This code has expired. Please request a new one.');
    if (otp.attempts >= config.OTP_MAX_ATTEMPTS) throw tooMany('Too many wrong attempts. Please request a new code.');
    if (!safeEqualHex(otp.code_hash, codeHash(b.phone, b.code))) {
      const left = config.OTP_MAX_ATTEMPTS - otp.attempts - 1;
      await query('UPDATE users.otp_codes SET attempts = attempts + 1 WHERE id = $1', [otp.id]);
      throw badRequest(left > 0 ? `Incorrect code. ${left} attempt${left === 1 ? '' : 's'} left.` : 'Too many wrong attempts. Please request a new code.');
    }
    const consumed = await query('UPDATE users.otp_codes SET consumed_at = now() WHERE id = $1 AND consumed_at IS NULL RETURNING id', [otp.id]);
    if (!consumed.length) throw badRequest('This code was already used. Please request a new one.');

    const isAdmin = config.ADMIN_PHONES.map((p) => { try { return normalizePhone(p); } catch { return ''; } }).includes(b.phone);
    const user = await one(
      `INSERT INTO users.users AS u (phone, name, role, last_login_at) VALUES ($1, $2, $3, now())
       ON CONFLICT (phone) DO UPDATE SET last_login_at = now(),
         role = CASE WHEN $3 = 'admin' THEN 'admin' ELSE u.role END,
         name = CASE WHEN u.name = '' THEN EXCLUDED.name ELSE u.name END
       RETURNING *, (xmax = 0) AS is_new`,
      [b.phone, b.name ?? '', isAdmin ? 'admin' : 'customer'],
    );
    // Bring the guest bag along. Best effort: login must not fail because of the cart.
    const cartId = z.string().uuid().safeParse(req.headers['x-cart-id']);
    if (cartId.success) await cartClient.merge(user.id, cartId.data).catch((err) => req.log.warn({ err }, 'cart merge failed'));
    return { ...(await startSession(req, reply, user)), isNew: user.is_new };
  });

  app.post('/api/auth/refresh', async (req, reply) => {
    const token = req.cookies[COOKIE] || z.object({ refreshToken: z.string().min(20).max(200) }).safeParse(req.body).data?.refreshToken;
    if (!token) throw unauthorized('Session expired. Please log in again.');
    const result = await tx(async (client) => {
      const s = await one('SELECT * FROM users.sessions WHERE token_hash = $1 FOR UPDATE', [sha256(token)], client);
      if (!s) return null;
      if (s.revoked_at) {
        // A rotated-out token was used again: someone may have stolen it. End every session.
        await client.query('UPDATE users.sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL', [s.user_id]);
        return null;
      }
      if (new Date(s.expires_at) < new Date()) return null;
      await client.query('UPDATE users.sessions SET revoked_at = now() WHERE id = $1', [s.id]);
      return one('SELECT * FROM users.users WHERE id = $1', [s.user_id], client);
    });
    if (!result) {
      reply.clearCookie(COOKIE, { path: '/api/auth' });
      throw unauthorized('Session expired. Please log in again.');
    }
    return startSession(req, reply, result);
  });

  app.post('/api/auth/logout', async (req, reply) => {
    const token = req.cookies[COOKIE] || z.object({ refreshToken: z.string().max(200) }).safeParse(req.body).data?.refreshToken;
    if (token) await query('UPDATE users.sessions SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL', [sha256(token)]);
    reply.clearCookie(COOKIE, { path: '/api/auth' });
    return { ok: true };
  });

  // ── profile & addresses ──
  app.register(async (r) => {
    r.addHook('preHandler', requireUser);

    r.get('/api/me', async (req) => userApi(await one('SELECT * FROM users.users WHERE id = $1', [req.user!.id])));

    r.patch('/api/me', async (req) => {
      const b = z.object({ name: z.string().trim().min(1).max(80).optional(), email: z.union([z.string().trim().email(), z.literal('')]).optional() }).parse(req.body);
      const u = await one(
        'UPDATE users.users SET name = COALESCE($2, name), email = COALESCE($3, email) WHERE id = $1 RETURNING *',
        [req.user!.id, b.name ?? null, b.email ?? null],
      );
      return userApi(u);
    });

    r.get('/api/me/addresses', async (req) => ({
      items: (await query('SELECT * FROM users.addresses WHERE user_id = $1 AND deleted_at IS NULL ORDER BY is_default DESC, created_at DESC', [req.user!.id])).map(addressApi),
    }));

    r.post('/api/me/addresses', async (req, reply) => {
      const b = addressBody.parse(req.body);
      const a = await tx(async (client) => {
        const count = (await one('SELECT count(*)::int AS n FROM users.addresses WHERE user_id = $1 AND deleted_at IS NULL', [req.user!.id], client)).n;
        if (count >= 20) throw badRequest('You can save up to 20 addresses.');
        const makeDefault = b.isDefault || count === 0;
        if (makeDefault) await client.query('UPDATE users.addresses SET is_default = false WHERE user_id = $1', [req.user!.id]);
        return one(
          `INSERT INTO users.addresses (user_id, full_name, phone, line1, line2, city, state, pincode, is_default) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
          [req.user!.id, b.fullName, b.phone, b.line1, b.line2, b.city, b.state, b.pincode, makeDefault],
          client,
        );
      });
      reply.code(201);
      return addressApi(a);
    });

    r.patch('/api/me/addresses/:id', async (req) => {
      const b = addressBody.partial().parse(req.body);
      const a = await tx(async (client) => {
        const cur = await one('SELECT * FROM users.addresses WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL FOR UPDATE', [(req.params as any).id, req.user!.id], client);
        if (!cur) throw notFound('Address');
        if (b.isDefault) await client.query('UPDATE users.addresses SET is_default = false WHERE user_id = $1', [req.user!.id]);
        return one(
          `UPDATE users.addresses SET full_name = $2, phone = $3, line1 = $4, line2 = $5, city = $6, state = $7, pincode = $8, is_default = $9 WHERE id = $1 RETURNING *`,
          [cur.id, b.fullName ?? cur.full_name, b.phone ?? cur.phone, b.line1 ?? cur.line1, b.line2 ?? cur.line2, b.city ?? cur.city, b.state ?? cur.state, b.pincode ?? cur.pincode, b.isDefault ?? cur.is_default],
          client,
        );
      });
      return addressApi(a);
    });

    /** Soft delete: past orders keep their own copy of the address anyway. */
    r.delete('/api/me/addresses/:id', async (req) => {
      const res = await query('UPDATE users.addresses SET deleted_at = now(), is_default = false WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL RETURNING id', [(req.params as any).id, req.user!.id]);
      if (!res.length) throw notFound('Address');
      return { ok: true };
    });
  });
}
