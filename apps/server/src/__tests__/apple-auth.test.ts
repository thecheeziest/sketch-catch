import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateKeyPair, SignJWT } from 'jose';
import { verifyAppleToken } from '../auth/apple.js';

const config = vi.hoisted(() => ({
  APPLE_ISSUER: 'https://appleid.apple.com',
  APPLE_BUNDLE_ID: 'com.sketchcatch.app',
  APPLE_BUNDLE_IDS: undefined as string[] | undefined,
}));

vi.mock('../lib/env.js', () => ({ env: config }));
vi.mock('jose', async importOriginal => {
  const actual = await importOriginal<typeof import('jose')>();
  return { ...actual, createRemoteJWKSet: () => async () => verificationKey };
});

let verificationKey: Awaited<ReturnType<typeof generateKeyPair>>['publicKey'];
let signingKey: Awaited<ReturnType<typeof generateKeyPair>>['privateKey'];

beforeAll(async () => {
  const pair = await generateKeyPair('RS256');
  verificationKey = pair.publicKey;
  signingKey = pair.privateKey;
});

beforeEach(() => {
  config.APPLE_BUNDLE_IDS = ['com.sketchcatch.app', 'com.sketchcatch.ios'];
});

async function signToken(audience: string, issuer = config.APPLE_ISSUER, key = signingKey) {
  return new SignJWT({ email: 'tester@example.com' })
    .setProtectedHeader({ alg: 'RS256' })
    .setSubject('apple-test-user')
    .setIssuer(issuer)
    .setAudience(audience)
    .setExpirationTime('5m')
    .sign(key);
}

describe('Apple 로그인 Bundle ID 병행 허용', () => {
  it.each(['com.sketchcatch.app', 'com.sketchcatch.ios'])('%s 토큰을 검증한다', async audience => {
    await expect(verifyAppleToken(await signToken(audience))).resolves.toEqual({
      sub: 'apple-test-user',
      audience,
      email: 'tester@example.com',
    });
  });

  it('다른 앱의 토큰은 거부한다', async () => {
    await expect(verifyAppleToken(await signToken('com.unrelated.app'))).rejects.toThrow();
  });

  it('발급자가 다르면 거부한다', async () => {
    await expect(verifyAppleToken(await signToken('com.sketchcatch.ios', 'https://example.com'))).rejects.toThrow();
  });

  it('서명이 다르면 거부한다', async () => {
    const pair = await generateKeyPair('RS256');
    await expect(
      verifyAppleToken(await signToken('com.sketchcatch.ios', config.APPLE_ISSUER, pair.privateKey)),
    ).rejects.toThrow();
  });

  it('병행 설정이 없으면 기존 단일 ID 설정을 사용한다', async () => {
    config.APPLE_BUNDLE_IDS = undefined;
    await expect(verifyAppleToken(await signToken('com.sketchcatch.app'))).resolves.toMatchObject({
      sub: 'apple-test-user',
    });
    await expect(verifyAppleToken(await signToken('com.sketchcatch.ios'))).rejects.toThrow();
  });
});
