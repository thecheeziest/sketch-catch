import { prisma } from '../db/prisma.js';
import { getPresence, type PresenceStatus } from '../db/redis.js';

// 커스텀 에러
export class SelfRequestError extends Error { code = 'SELF_REQUEST' as const; }
export class UserNotFoundError extends Error { code = 'USER_NOT_FOUND' as const; }
export class AlreadyFriendsError extends Error { code = 'ALREADY_FRIENDS' as const; }
export class DuplicateRequestError extends Error { code = 'REQUEST_ALREADY_SENT' as const; }
export class RequestNotFoundError extends Error { code = 'REQUEST_NOT_FOUND' as const; }
export class ForbiddenError extends Error { code = 'FORBIDDEN' as const; }

// 닉네임#코드 파싱 — '#' 없거나 코드 길이 != 5면 null
function parseTarget(target: string): { nickname: string; friendCode: string } | null {
  const idx = target.lastIndexOf('#');
  if (idx === -1) return null;
  const nickname = target.slice(0, idx);
  const friendCode = target.slice(idx + 1);
  if (!nickname || friendCode.length !== 5) return null;
  return { nickname, friendCode };
}

// Friendship 정규화: userAId < userBId 보장 (@@unique 기준)
function normalizeIds(a: string, b: string): { userAId: string; userBId: string } {
  return a < b ? { userAId: a, userBId: b } : { userAId: b, userBId: a };
}

export async function sendFriendRequest(senderId: string, target: string): Promise<void> {
  const parsed = parseTarget(target);
  if (!parsed) throw new SelfRequestError(); // 형식 오류는 라우트에서 400으로 처리

  const receiver = await prisma.user.findUnique({
    where: { nickname_friendCode: parsed },
  });
  if (!receiver) throw new UserNotFoundError();
  if (receiver.id === senderId) throw new SelfRequestError();

  // 이미 친구인지 확인
  const { userAId, userBId } = normalizeIds(senderId, receiver.id);
  const existing = await prisma.friendship.findUnique({ where: { userAId_userBId: { userAId, userBId } } });
  if (existing) throw new AlreadyFriendsError();

  // 중복 요청 확인 (@@unique([senderId, receiverId]) 위반 시 throw)
  try {
    await prisma.friendRequest.create({
      data: { senderId, receiverId: receiver.id, status: 'PENDING' },
    });
  } catch {
    throw new DuplicateRequestError();
  }
}

export type FriendEntry = {
  friendshipId: string;
  userId: string;
  nickname: string;
  friendCode: string;
  characterId: string;
  presenceStatus: PresenceStatus;
};

export async function getFriends(userId: string): Promise<FriendEntry[]> {
  const friendships = await prisma.friendship.findMany({
    where: { OR: [{ userAId: userId }, { userBId: userId }] },
    include: { userA: true, userB: true },
  });

  return Promise.all(
    friendships.map(async (f) => {
      const friend = f.userAId === userId ? f.userB : f.userA;
      const presenceStatus = await getPresence(friend.id);
      return {
        friendshipId: f.id,
        userId: friend.id,
        nickname: friend.nickname,
        friendCode: friend.friendCode,
        characterId: friend.characterId,
        presenceStatus,
      };
    })
  );
}

export type RequestEntry = {
  id: string;
  sender: { id: string; nickname: string; friendCode: string; characterId: string };
  createdAt: string;
};

export async function getFriendRequests(userId: string): Promise<RequestEntry[]> {
  const requests = await prisma.friendRequest.findMany({
    where: { receiverId: userId, status: 'PENDING' },
    include: { sender: true },
    orderBy: { createdAt: 'desc' },
  });
  return requests.map((r) => ({
    id: r.id,
    sender: {
      id: r.sender.id,
      nickname: r.sender.nickname,
      friendCode: r.sender.friendCode,
      characterId: r.sender.characterId,
    },
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function respondToRequest(
  userId: string,
  requestId: string,
  action: 'ACCEPT' | 'REJECT'
): Promise<void> {
  const req = await prisma.friendRequest.findUnique({ where: { id: requestId } });
  if (!req || req.status !== 'PENDING') throw new RequestNotFoundError();
  if (req.receiverId !== userId) throw new ForbiddenError();

  if (action === 'ACCEPT') {
    const { userAId, userBId } = normalizeIds(req.senderId, req.receiverId);
    await prisma.$transaction([
      prisma.friendRequest.update({ where: { id: requestId }, data: { status: 'ACCEPTED' } }),
      prisma.friendship.create({ data: { userAId, userBId } }),
    ]);
  } else {
    await prisma.friendRequest.update({ where: { id: requestId }, data: { status: 'REJECTED' } });
  }
}

export async function deleteFriend(userId: string, friendId: string): Promise<void> {
  const { userAId, userBId } = normalizeIds(userId, friendId);
  const friendship = await prisma.friendship.findUnique({ where: { userAId_userBId: { userAId, userBId } } });
  if (!friendship) throw new RequestNotFoundError(); // 친구 관계 없음
  await prisma.friendship.delete({ where: { id: friendship.id } });
}
