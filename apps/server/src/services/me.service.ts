import type { User } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { ensureUniqueNicknameCode } from './user.service.js';
import type { UpdateMeInput } from '@sketch-catch/shared';

const NICKNAME_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000; // 30일

export class NicknameCooldownError extends Error {
  readonly code = 'NICKNAME_CHANGE_COOLDOWN';
  constructor(readonly nextChangeAt: string) {
    super('Nickname change is on cooldown');
  }
}

export class UserNotFoundError extends Error {
  readonly code = 'NOT_FOUND';
}

export function assertNicknameCooldown(lastChange: Date | null, now: Date = new Date()): void {
  if (!lastChange) return;
  const diff = now.getTime() - lastChange.getTime();
  if (diff < NICKNAME_COOLDOWN_MS) {
    const next = new Date(lastChange.getTime() + NICKNAME_COOLDOWN_MS);
    throw new NicknameCooldownError(next.toISOString());
  }
}

export async function updateMe(userId: string, input: UpdateMeInput): Promise<User> {
  const current = await prisma.user.findUnique({ where: { id: userId } });
  if (!current) throw new UserNotFoundError();

  // PROF-01: 닉네임 30일 cooldown 검증
  if (input.nickname !== undefined && input.nickname !== current.nickname) {
    assertNicknameCooldown(current.nicknameChangedAt);
  }

  // AUTH-04: 변경 후 닉네임+코드 조합 중복 검사 (변경 필드 + 미변경 필드 결합)
  const nextNickname = input.nickname ?? current.nickname;
  const nextFriendCode = input.friendCode ?? current.friendCode;
  if (nextNickname !== current.nickname || nextFriendCode !== current.friendCode) {
    await ensureUniqueNicknameCode(nextNickname, nextFriendCode, userId);
  }

  // 부분 업데이트
  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(input.nickname !== undefined ? { nickname: input.nickname, nicknameChangedAt: new Date() } : {}),
      ...(input.friendCode !== undefined ? { friendCode: input.friendCode } : {}),
      ...(input.characterId !== undefined ? { characterId: input.characterId } : {}),
    },
  });
  return updated;
}

export async function deleteMe(userId: string): Promise<void> {
  // PROF-05: cascade 삭제 — schema에 ON DELETE RESTRICT가 있으므로 수동 transaction
  await prisma.$transaction([
    prisma.friendRequest.deleteMany({ where: { OR: [{ senderId: userId }, { receiverId: userId }] } }),
    prisma.friendship.deleteMany({ where: { OR: [{ userAId: userId }, { userBId: userId }] } }),
    prisma.gameReplay.deleteMany({ where: { userId } }),
    prisma.user.delete({ where: { id: userId } }),
  ]);
}
