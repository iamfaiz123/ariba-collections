import type { FastifyReply, FastifyRequest } from 'fastify';
import { SignJWT, jwtVerify } from 'jose';
import { config } from '../config.js';
import { forbidden, unauthorized } from './errors.js';
import { safeEqualHex } from './util.js';

const secret = new TextEncoder().encode(config.JWT_SECRET);

export interface AuthUser {
  id: string;
  role: 'customer' | 'admin';
  phone: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthUser;
    rawBody?: Buffer;
  }
}

export async function signAccessToken(user: AuthUser): Promise<string> {
  return new SignJWT({ role: user.role, phone: user.phone })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuedAt()
    .setIssuer('aribas')
    .setExpirationTime(`${config.ACCESS_TOKEN_MINUTES}m`)
    .sign(secret);
}

async function readUser(req: FastifyRequest): Promise<AuthUser | undefined> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return undefined;
  try {
    const { payload } = await jwtVerify(header.slice(7), secret, { issuer: 'aribas', algorithms: ['HS256'] });
    return { id: String(payload.sub), role: payload.role === 'admin' ? 'admin' : 'customer', phone: String(payload.phone ?? '') };
  } catch {
    return undefined;
  }
}

/** preHandler: attaches req.user when a valid token is sent; never rejects. */
export async function optionalAuth(req: FastifyRequest) {
  req.user = await readUser(req);
}

export async function requireUser(req: FastifyRequest) {
  req.user = await readUser(req);
  if (!req.user) throw unauthorized();
}

export async function requireAdmin(req: FastifyRequest) {
  await requireUser(req);
  if (req.user!.role !== 'admin') throw forbidden();
}

/** preHandler for /internal routes: service-to-service calls carry the shared INTERNAL_TOKEN. */
export async function requireInternal(req: FastifyRequest, _reply: FastifyReply) {
  const token = String(req.headers['x-internal-token'] ?? '');
  if (!safeEqualHex(token, config.INTERNAL_TOKEN)) throw forbidden('Internal route.');
}
