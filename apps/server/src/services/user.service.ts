import type { Provider, User } from '@prisma/client';
import { prisma } from '../db/prisma.js';
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
}): Promise<{ user: User; isNew: boolean }> {
  const existing = await prisma.user.findUnique({
    where: { provider_providerId: { provider: input.provider, providerId: input.providerId } },
  });
  if (existing) return { user: existing, isNew: false };

  const { nickname, friendCode } = await generateUniqueNicknameCode();
  const created = await prisma.user.create({
    data: {
      provider: input.provider,
      providerId: input.providerId,
      nickname,
      friendCode,
      characterId: CHARACTER_IDS[0]!, // 기본값 'dog' — 온보딩에서 변경
    },
  });
  return { user: created, isNew: true };
}

export async function ensureUniqueNicknameCode(
  nickname: string,
  friendCode: string,
  excludeUserId?: string
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
