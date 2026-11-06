import type { BlockedUser, ReportReason, RoomState } from '@sketch-catch/shared';
import { prisma } from '../db/prisma.js';
import { findReportableMessage } from './chatStore.js';

export class SelfModerationError extends Error {
  code = 'SELF_TARGET' as const;
}
export class ModerationTargetNotFoundError extends Error {
  code = 'USER_NOT_FOUND' as const;
}

// Friendship 정규화: userAId < userBId 보장 (friends.service와 같은 기준)
function normalizeIds(a: string, b: string): { userAId: string; userBId: string } {
  return a < b ? { userAId: a, userBId: b } : { userAId: b, userBId: a };
}

async function assertTarget(userId: string, targetId: string): Promise<void> {
  if (userId === targetId) throw new SelfModerationError();
  const target = await prisma.user.findUnique({ where: { id: targetId }, select: { id: true } });
  if (!target) throw new ModerationTargetNotFoundError();
}

// 둘 중 한쪽이라도 차단했는지 — 친구 요청·초대 같은 상호작용을 막을 때 쓴다
export async function isBlockedEither(a: string, b: string): Promise<boolean> {
  const block = await prisma.userBlock.findFirst({
    where: {
      OR: [
        { blockerId: a, blockedId: b },
        { blockerId: b, blockedId: a },
      ],
    },
    select: { blockerId: true },
  });
  return block !== null;
}

// 내가 차단했거나 나를 차단한 유저 — 서로 보이지도, 같은 방에 있지도 않게 할 때 쓴다
export async function getBlockRelatedIds(userId: string): Promise<Set<string>> {
  const blocks = await prisma.userBlock.findMany({
    where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
    select: { blockerId: true, blockedId: true },
  });
  return new Set(blocks.map(block => (block.blockerId === userId ? block.blockedId : block.blockerId)));
}

// 방에 앉아 있는 사람(시상식 잔류 포함, 퇴장자 제외) 중 차단 관계인 사람이 있는지
export function hasBlockedMember(state: RoomState, relatedIds: ReadonlySet<string>): boolean {
  if (relatedIds.size === 0) return false;
  const members = [...state.players, ...(state.awardViewers ?? [])];
  return members.some(member => !member.left && relatedIds.has(member.id));
}

// 차단하면 친구 관계와 서로 주고받은 대기 중 친구 요청도 함께 정리한다 (이미 차단했으면 그대로 둔다)
export async function blockUser(userId: string, targetId: string): Promise<void> {
  await assertTarget(userId, targetId);
  const { userAId, userBId } = normalizeIds(userId, targetId);
  await prisma.$transaction([
    prisma.userBlock.upsert({
      where: { blockerId_blockedId: { blockerId: userId, blockedId: targetId } },
      create: { blockerId: userId, blockedId: targetId },
      update: {},
    }),
    prisma.friendship.deleteMany({ where: { userAId, userBId } }),
    prisma.friendRequest.deleteMany({
      where: {
        status: 'PENDING',
        OR: [
          { senderId: userId, receiverId: targetId },
          { senderId: targetId, receiverId: userId },
        ],
      },
    }),
  ]);
}

export async function unblockUser(userId: string, targetId: string): Promise<void> {
  await prisma.userBlock.deleteMany({ where: { blockerId: userId, blockedId: targetId } });
}

export async function listBlockedUsers(userId: string): Promise<BlockedUser[]> {
  const blocks = await prisma.userBlock.findMany({
    where: { blockerId: userId },
    orderBy: { createdAt: 'desc' },
    select: {
      createdAt: true,
      blocked: { select: { id: true, nickname: true, friendCode: true, characterId: true } },
    },
  });
  return blocks.map(({ createdAt, blocked }) => ({
    userId: blocked.id,
    nickname: blocked.nickname,
    friendCode: blocked.friendCode,
    characterId: blocked.characterId,
    blockedAt: createdAt.toISOString(),
  }));
}

/**
 * 신고 접수. 채팅 신고는 서버가 보관한 메시지 중 신고 대상이 실제로 보낸 것만 원문을 남긴다.
 * 같은 메시지를 여러 번 신고해도 1건만 남긴다.
 */
export async function reportUser(
  reporterId: string,
  input: { targetId: string; reason: ReportReason; detail?: string; messageId?: string },
): Promise<void> {
  await assertTarget(reporterId, input.targetId);

  const stored = input.messageId ? findReportableMessage(input.messageId) : undefined;
  const message = stored?.msg.userId === input.targetId ? stored : undefined;

  if (input.messageId) {
    const duplicate = await prisma.userReport.findFirst({
      where: { reporterId, targetId: input.targetId, messageId: input.messageId },
      select: { id: true },
    });
    if (duplicate) return;
  }

  await prisma.userReport.create({
    data: {
      reporterId,
      targetId: input.targetId,
      reason: input.reason,
      detail: input.detail ?? null,
      messageId: input.messageId ?? null,
      messageText: message?.msg.text ?? null,
      roomCode: message?.code ?? null,
    },
  });
}
