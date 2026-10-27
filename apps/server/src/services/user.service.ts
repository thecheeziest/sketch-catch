import { Prisma, type Provider } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { USER_WITH_ITEMS, type UserWithItems } from '../lib/userPrivate.js';
import { CHARACTER_IDS } from '@sketch-catch/shared';

export class NicknameCodeConflictError extends Error {
  readonly code = 'NICKNAME_CODE_CONFLICT';
  constructor() {
    super('nickname+friendCode combination already exists');
  }
}

function randomFriendCode(): string {
  // 5자리 영문대문자+숫자
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let out = '';
  for (let i = 0; i < 5; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function randomNickname(): string {
  // 신규 가입자에게 임시 닉네임 부여 — 온보딩 PATCH로 변경
  return `손님${Math.floor(Math.random() * 90000) + 10000}`;
}

async function generateUniqueNicknameCode(): Promise<{ nickname: string; friendCode: string }> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const nickname = randomNickname();
    const friendCode = randomFriendCode();
    const exists = await prisma.user.findUnique({
      where: { nickname_friendCode: { nickname, friendCode } },
    });
    if (!exists) return { nickname, friendCode };
  }
  throw new Error('Failed to generate unique nickname+code after 10 attempts');
}

export async function upsertUserByProvider(input: {
  provider: Provider;
  providerId: string;
}): Promise<{ user: UserWithItems; isNew: boolean }> {
  if (input.provider === 'APPLE') {
    const identity = await prisma.appleIdentity.findUnique({
      where: { providerId: input.providerId },
      include: { user: { include: USER_WITH_ITEMS } },
    });
    if (identity) return { user: identity.user, isNew: false };
  }
  const existing = await prisma.user.findUnique({
    where: { provider_providerId: { provider: input.provider, providerId: input.providerId } },
    include: USER_WITH_ITEMS,
  });
  if (existing) return { user: existing, isNew: false };

  const { nickname, friendCode } = await generateUniqueNicknameCode();
  if (input.provider === 'APPLE') {
    try {
      // 신규 로그인과 기존 계정 연결이 겹치면 식별자 고유 제약으로 한쪽만 확정한다.
      const identity = await prisma.appleIdentity.create({
        data: {
          providerId: input.providerId,
          user: { create: { ...input, nickname, friendCode, characterId: CHARACTER_IDS[0]! } },
        },
        include: { user: { include: USER_WITH_ITEMS } },
      });
      return { user: identity.user, isNew: true };
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error;
      const identity = await prisma.appleIdentity.findUnique({
        where: { providerId: input.providerId },
        include: { user: { include: USER_WITH_ITEMS } },
      });
      if (!identity) throw error;
      return { user: identity.user, isNew: false };
    }
  }
  const created = await prisma.user.create({
    data: {
      provider: input.provider,
      providerId: input.providerId,
      nickname,
      friendCode,
      characterId: CHARACTER_IDS[0]!, // 기본값 'dog' — 온보딩에서 변경
    },
    include: USER_WITH_ITEMS,
  });
  return { user: created, isNew: true };
}

export async function ensureUniqueNicknameCode(
  nickname: string,
  friendCode: string,
  excludeUserId?: string,
): Promise<void> {
  const found = await prisma.user.findFirst({
    where: {
      nickname,
      friendCode,
      ...(excludeUserId ? { NOT: { id: excludeUserId } } : {}),
    },
    select: { id: true },
  });
  if (found) throw new NicknameCodeConflictError();
}
