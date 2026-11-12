import { SignJWT, importPKCS8 } from 'jose';
import { env } from '../lib/env.js';
import { logger } from '../lib/logger.js';

// 탈퇴 시 Sign in with Apple 연결 해제 — 앱이 보낸 일회용 authorization code를 토큰으로 바꾼 뒤 철회한다
const APPLE_AUTH_URL = 'https://appleid.apple.com/auth';
const REQUEST_TIMEOUT_MS = 5000;
const CLIENT_SECRET_TTL_SEC = 300;

type AppleTokenResponse = { refresh_token?: string; access_token?: string };

async function createClientSecret(keyId: string, privateKey: string): Promise<string> {
  const key = await importPKCS8(privateKey, 'ES256');
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: keyId })
    .setIssuer(env.APPLE_TEAM_ID)
    .setIssuedAt(now)
    .setExpirationTime(now + CLIENT_SECRET_TTL_SEC)
    .setAudience('https://appleid.apple.com')
    .setSubject(env.APPLE_SIWA_CLIENT_ID)
    .sign(key);
}

async function postForm(path: string, body: Record<string, string>): Promise<Response> {
  return fetch(`${APPLE_AUTH_URL}/${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
}

/**
 * Apple 로그인 연결을 해제한다. 실패해도 탈퇴는 계속 진행해야 하므로 예외를 던지지 않고 성공 여부만 돌려준다.
 */
export async function revokeAppleAuthorization(authorizationCode: string): Promise<boolean> {
  if (!env.APPLE_SIWA_KEY_ID || !env.APPLE_SIWA_PRIVATE_KEY) {
    logger.warn('apple revoke skipped: APPLE_SIWA_KEY_ID / APPLE_SIWA_PRIVATE_KEY not set');
    return false;
  }
  try {
    const clientSecret = await createClientSecret(env.APPLE_SIWA_KEY_ID, env.APPLE_SIWA_PRIVATE_KEY);
    const credentials = { client_id: env.APPLE_SIWA_CLIENT_ID, client_secret: clientSecret };

    const tokenRes = await postForm('token', {
      ...credentials,
      code: authorizationCode,
      grant_type: 'authorization_code',
    });
    if (!tokenRes.ok) {
      logger.warn({ status: tokenRes.status, body: await tokenRes.text() }, 'apple token exchange failed');
      return false;
    }
    const tokens = (await tokenRes.json()) as AppleTokenResponse;
    const token = tokens.refresh_token ?? tokens.access_token;
    if (!token) return false;

    const revokeRes = await postForm('revoke', {
      ...credentials,
      token,
      token_type_hint: tokens.refresh_token ? 'refresh_token' : 'access_token',
    });
    if (!revokeRes.ok) {
      logger.warn({ status: revokeRes.status }, 'apple revoke failed');
      return false;
    }
    return true;
  } catch (err) {
    logger.warn({ err }, 'apple revoke error');
    return false;
  }
}
