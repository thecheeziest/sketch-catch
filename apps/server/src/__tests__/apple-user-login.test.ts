import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';

vi.mock('../db/prisma.js', () => ({
  prisma: {
    appleIdentity: { findUnique: vi.fn(), create: vi.fn(), upsert: vi.fn() },
    user: { findUnique: vi.fn(), create: vi.fn() },
  },
}));

const { prisma } = await import('../db/prisma.js');
const { upsertUserByProvider } = await import('../services/user.service.js');

const oldUser = {
  id: 'old-user',
  provider: 'APPLE' as const,
  providerId: 'old-apple-sub',
  nickname: '기존사용자',
  friendCode: 'ABCDE',
  characterId: 'dog',
  pushToken: null,
  createdAt: new Date('2026-01-01'),
  nicknameChangedAt: null,
  coins: 735,
  frameId: 'pixel-frame',
  backgroundId: null,
  chatColorId: null,
  items: [{ itemId: 'dog' }, { itemId: 'pixel-frame' }],
};
const sourceClaims = { sub: 'old-apple-sub' };
const targetClaims = { sub: 'new-apple-sub' };
const identities = new Map<string, string>();

beforeEach(() => {
  vi.resetAllMocks();
  identities.clear();
  identities.set(sourceClaims.sub, oldUser.id);
  vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
  vi.mocked(prisma.appleIdentity.findUnique).mockImplementation(async ({ where }) => {
    const userId = identities.get(where.providerId!);
    if (!userId) return null;
    return { providerId: where.providerId!, userId, createdAt: new Date(), user: { ...oldUser, id: userId } };
  });
  vi.mocked(prisma.appleIdentity.upsert).mockImplementation(async ({ where, create }) => {
    const providerId = where.providerId!;
    const userId = identities.get(providerId) ?? create.userId!;
    identities.set(providerId, userId);
    return { providerId, userId, createdAt: new Date(), user: { ...oldUser, id: userId } };
  });
});

describe('Apple 사용자 로그인', () => {
  it('이미 연결된 Apple 식별자로 같은 사용자와 보유 데이터를 반환한다', async () => {
    identities.set(targetClaims.sub, oldUser.id);
    for (const providerId of [sourceClaims.sub, targetClaims.sub]) {
      await expect(upsertUserByProvider({ provider: 'APPLE', providerId })).resolves.toMatchObject({
        isNew: false,
        user: { id: oldUser.id, coins: 735, items: oldUser.items },
      });
    }
    expect(prisma.user.create).not.toHaveBeenCalled();
  });
  it('기존 Apple 로그인에서 누락된 식별자를 복구한다', async () => {
    identities.delete(sourceClaims.sub);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(oldUser);
    await expect(upsertUserByProvider({ provider: 'APPLE', providerId: sourceClaims.sub })).resolves.toMatchObject({
      isNew: false,
      user: { id: oldUser.id },
    });
    expect(identities.get(sourceClaims.sub)).toBe(oldUser.id);
  });
  it('신규 가입과 계정 연결이 겹치면 연결된 기존 사용자를 반환한다', async () => {
    vi.mocked(prisma.appleIdentity.findUnique).mockResolvedValueOnce(null);
    vi.mocked(prisma.appleIdentity.create).mockImplementationOnce(async () => {
      identities.set(targetClaims.sub, oldUser.id);
      throw new Prisma.PrismaClientKnownRequestError('duplicate identity', { code: 'P2002', clientVersion: '5.22.0' });
    });
    await expect(upsertUserByProvider({ provider: 'APPLE', providerId: targetClaims.sub })).resolves.toMatchObject({
      isNew: false,
      user: { id: oldUser.id },
    });
    expect(prisma.user.create).not.toHaveBeenCalled();
  });
});
