import { SignJWT, jwtVerify } from 'jose';
import { env } from '../lib/env.js';

const secret = new TextEncoder().encode(env.JWT_SECRET);

export type JwtPayload = { sub: string };

function ttlToSeconds(ttl: string): number {
  // '15m' → 900, '30d' → 2592000
  const match = ttl.match(/^(\d+)([smhd])$/);
  if (!match) throw new Error(`Invalid TTL: ${ttl}`);
  const n = Number(match[1]);
  const unit = match[2];
  const mult = unit === 's' ? 1 : unit === 'm' ? 60 : unit === 'h' ? 3600 : 86_400;
  return n * mult;
}

export async function signTokens(userId: string): Promise<{ accessToken: string; refreshToken: string }> {
  const now = Math.floor(Date.now() / 1000);
  const accessToken = await new SignJWT({ typ: 'access' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt(now)
    .setExpirationTime(now + ttlToSeconds(env.JWT_ACCESS_TTL))
    .sign(secret);
  const refreshToken = await new SignJWT({ typ: 'refresh' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt(now)
    .setExpirationTime(now + ttlToSeconds(env.JWT_REFRESH_TTL))
    .sign(secret);
  return { accessToken, refreshToken };
}

async function verifyToken(token: string, expectedTyp: 'access' | 'refresh'): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] });
    if (payload.typ !== expectedTyp) return null;
    if (typeof payload.sub !== 'string') return null;
    return { sub: payload.sub };
  } catch {
    return null;
  }
}

export const verifyAccessToken = (t: string) => verifyToken(t, 'access');
export const verifyRefreshToken = (t: string) => verifyToken(t, 'refresh');
