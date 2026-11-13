import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { badRequest } from './errors.js';

/** Paise → rupees for API responses. */
export const rupees = (paise: number) => Math.round(paise) / 100;

export const formatInr = (paise: number) =>
  'Rs. ' + (paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Returns E.164 (+<country code><number>). Bare 10-digit numbers are treated as Indian.
 * Indian numbers must be valid mobiles; other countries need 8–15 digits in total.
 */
export function normalizePhone(input: string): string {
  const raw = String(input ?? '').trim();
  const digits = raw.replace(/[^\d]/g, '');
  if (raw.startsWith('+') && !digits.startsWith('91')) {
    if (!/^[1-9]\d{7,14}$/.test(digits)) throw badRequest('Enter a valid mobile number with country code.');
    return `+${digits}`;
  }
  const local = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits.length === 11 && digits.startsWith('0') ? digits.slice(1) : digits;
  if (!/^[6-9]\d{9}$/.test(local)) throw badRequest('Enter a valid 10-digit Indian mobile number.');
  return `+91${local}`;
}

export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
export const hmacHex = (secret: string, s: string | Buffer) => createHmac('sha256', secret).update(s).digest('hex');
export const randomToken = (bytes = 32) => randomBytes(bytes).toString('base64url');

export function safeEqualHex(a: string, b: string): boolean {
  const ab = Buffer.from(a ?? '', 'utf8');
  const bb = Buffer.from(b ?? '', 'utf8');
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Indian financial year label for a date, e.g. 2026-27. */
export function financialYear(d = new Date()): string {
  const ist = new Date(d.getTime() + 330 * 60_000);
  const y = ist.getUTCFullYear();
  const start = ist.getUTCMonth() >= 3 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}

export const maskPhone = (p: string) => (p ? p.slice(0, 3) + '******' + p.slice(-4) : p);
