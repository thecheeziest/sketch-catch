import type { Prisma, User } from '@prisma/client';
import type { UserPrivate } from '@sketch-catch/shared';

// /me·로그인 응답에 보유 아이템까지 실어 보내기 위한 include
export const USER_WITH_ITEMS = { items: { select: { itemId: true } } } satisfies Prisma.UserInclude;

export type UserWithItems = User & { items: { itemId: string }[] };

export function toUserPrivate(u: UserWithItems): UserPrivate {
  return {
    id: u.id,
    nickname: u.nickname,
    friendCode: u.friendCode,
    characterId: u.characterId,
    provider: u.provider,
    createdAt: u.createdAt.toISOString(),
    nicknameChangedAt: u.nicknameChangedAt ? u.nicknameChangedAt.toISOString() : null,
    coins: u.coins,
    ownedItemIds: u.items.map(item => item.itemId),
    frameId: u.frameId,
    backgroundId: u.backgroundId,
    chatColorId: u.chatColorId,
  };
}
