import { createRemoteJWKSet, jwtVerify } from 'jose';
import { env } from '../lib/env.js';

const APPLE_JWKS = createRemoteJWKSet(new URL(`${env.APPLE_ISSUER}/auth/keys`));

export async function verifyAppleToken(identityToken: string): Promise<{ sub: string; email?: string }> {
  const { payload } = await jwtVerify(identityToken, APPLE_JWKS, {
    issuer: env.APPLE_ISSUER,
    audience: env.APPLE_BUNDLE_ID,
  });
  if (typeof payload.sub !== 'string') throw new Error('Apple token missing sub');
  return { sub: payload.sub, email: typeof payload.email === 'string' ? payload.email : undefined };
}
