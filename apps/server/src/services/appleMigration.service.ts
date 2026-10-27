import { createHash, randomBytes } from 'node:crypto';
import { Prisma } from '@prisma/client';
import type { AppleMigrationCodeResponse } from '@sketch-catch/shared';
import type { verifyAppleToken } from '../auth/apple.js';
import { prisma } from '../db/prisma.js';
import { redis } from '../db/redis.js';
import { env } from '../lib/env.js';
import { USER_WITH_ITEMS, type UserWithItems } from '../lib/userPrivate.js';
import { logger } from '../lib/logger.js';

type Claims = Pick<Awaited<ReturnType<typeof verifyAppleToken>>, 'sub' | 'audience'>;
const CODE_TTL_SECONDS = 15 * 60;
const CODE_PREFIX = 'auth:apple-migration:code:';

export class AppleMigrationError extends Error {
  constructor(
    readonly code: string,
    readonly statusCode: number,
  ) {
    super(code);
  }
}

function migrationBundles() {
  const source = env.APPLE_MIGRATION_SOURCE_BUNDLE_ID;
  const target = env.APPLE_MIGRATION_TARGET_BUNDLE_ID;
  if (!source || !target || source === target) throw new AppleMigrationError('MIGRATION_UNAVAILABLE', 503);
  return { source, target };
}

function codeKey(code: string): string {
  return `${CODE_PREFIX}${createHash('sha256').update(code).digest('hex')}`;
}

export async function issueAppleMigrationCode(userId: string, claims: Claims): Promise<AppleMigrationCodeResponse> {
  if (claims.audience !== migrationBundles().source) throw new AppleMigrationError('MIGRATION_SOURCE_REQUIRED', 403);
  const identity = await prisma.appleIdentity.findUnique({ where: { providerId: claims.sub } });
  if (identity?.userId !== userId) throw new AppleMigrationError('MIGRATION_ACCOUNT_MISMATCH', 403);

  const lock = await redis.set(`auth:apple-migration:issue:${userId}`, '1', 'EX', 30, 'NX');
  if (!lock) throw new AppleMigrationError('MIGRATION_RATE_LIMITED', 429);

  const code = randomBytes(16).toString('hex');
  const key = codeKey(code);
  // 재발급하면 이전 코드를 즉시 만료시킨다. Redis에는 코드 원문을 저장하지 않는다.
  await redis.eval(
    `local previous = redis.call('GET', KEYS[1])
     if previous then redis.call('DEL', previous) end
     redis.call('SET', KEYS[1], KEYS[2], 'EX', ARGV[2])
     redis.call('SET', KEYS[2], ARGV[1], 'EX', ARGV[2])
     return 1`,
    2,
    `auth:apple-migration:active:${userId}`,
    key,
    userId,
    CODE_TTL_SECONDS,
  );
  return { code, expiresAt: new Date(Date.now() + CODE_TTL_SECONDS * 1000).toISOString() };
}

export async function linkAppleMigration(code: string, claims: Claims): Promise<UserWithItems> {
  if (claims.audience !== migrationBundles().target) throw new AppleMigrationError('MIGRATION_TARGET_REQUIRED', 403);

  try {
    // GETDEL로 만료·사용된 코드의 재사용과 동시 요청을 차단한다.
    const userId = await redis.getdel(codeKey(code));
    if (!userId) throw new AppleMigrationError('MIGRATION_CODE_INVALID', 403);
    const identity = await prisma.appleIdentity.upsert({
      where: { providerId: claims.sub },
      update: {},
      create: { providerId: claims.sub, userId },
      include: { user: { include: USER_WITH_ITEMS } },
    });
    if (identity.userId !== userId) throw new AppleMigrationError('MIGRATION_IDENTITY_IN_USE', 409);
    return identity.user;
  } catch (error) {
    if (error instanceof AppleMigrationError) throw error;
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') throw new AppleMigrationError('MIGRATION_IDENTITY_IN_USE', 409);
      if (error.code === 'P2003') throw new AppleMigrationError('MIGRATION_CODE_INVALID', 403);
    }
    logger.error({ error }, 'Apple identity linking failed');
    throw new AppleMigrationError('MIGRATION_UNAVAILABLE', 503);
  }
}
