import { createRemoteJWKSet, jwtVerify } from 'jose';
import { env } from '../lib/env.js';

const KAKAO_JWKS = createRemoteJWKSet(new URL(`${env.KAKAO_ISSUER}/.well-known/jwks.json`));

export async function verifyKakaoToken(idToken: string): Promise<{ sub: string; email?: string }> {
  const { payload } = await jwtVerify(idToken, KAKAO_JWKS, {
    issuer: env.KAKAO_ISSUER,
  });
  if (typeof payload.sub !== 'string') throw new Error('Kakao token missing sub');
  return { sub: payload.sub, email: typeof payload.email === 'string' ? payload.email : undefined };
}
