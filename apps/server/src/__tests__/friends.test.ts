import { describe, it, expect, vi, beforeEach } from 'vitest';

// Prisma / Redis mock — me.test.ts 패턴 동일
vi.mock('../db/prisma.js', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    friendRequest: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    friendship: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), delete: vi.fn() },
    $transaction: vi.fn(async (ops: unknown[]) => {
      const results = [];
      for (const op of ops) {
        results.push(await op);
      }
      return results;
    }),
  },
}));

vi.mock('../db/redis.js', () => ({
  getPresence: vi.fn().mockResolvedValue('OFFLINE'),
  redis: { get: vi.fn(), set: vi.fn(), del: vi.fn() },
}));

const { prisma } = await import('../db/prisma.js');
const { getPresence } = await import('../db/redis.js');
const {
  sendFriendRequest,
  respondToRequest,
  deleteFriend,
  getFriends,
  SelfRequestError,
  UserNotFoundError,
  AlreadyFriendsError,
  DuplicateRequestError,
  RequestNotFoundError,
  ForbiddenError,
} = await import('../services/friends.service.js');

// -------- sendFriendRequest --------

describe('sendFriendRequest', () => {
  beforeEach(() => vi.clearAllMocks());

  it('#이 없는 target → SelfRequestError (parseTarget null)', async () => {
    await expect(sendFriendRequest('u1', '닉네임없는코드')).rejects.toBeInstanceOf(SelfRequestError);
  });

  it('코드 길이가 5가 아니면 → SelfRequestError', async () => {
    await expect(sendFriendRequest('u1', '닉네임#AB')).rejects.toBeInstanceOf(SelfRequestError);
  });

  it('사용자 미존재 → UserNotFoundError', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    await expect(sendFriendRequest('u1', '닉네임#ABCDE')).rejects.toBeInstanceOf(UserNotFoundError);
  });

  it('자기 자신에게 요청 → SelfRequestError', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'u1' } as any);
    await expect(sendFriendRequest('u1', '닉네임#ABCDE')).rejects.toBeInstanceOf(SelfRequestError);
  });

  it('이미 친구인 경우 → AlreadyFriendsError', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'u2' } as any);
    vi.mocked(prisma.friendship.findUnique).mockResolvedValue({ id: 'fs1' } as any);
    await expect(sendFriendRequest('u1', '닉네임#ABCDE')).rejects.toBeInstanceOf(AlreadyFriendsError);
  });

  it('정상 요청 → friendRequest.create 호출', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'u2' } as any);
    vi.mocked(prisma.friendship.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.friendRequest.create).mockResolvedValue({} as any);

    await expect(sendFriendRequest('u1', '닉네임#ABCDE')).resolves.toBeUndefined();
    expect(prisma.friendRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ senderId: 'u1', receiverId: 'u2' }) })
    );
  });

  it('중복 요청 (create 실패) → DuplicateRequestError', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'u2' } as any);
    vi.mocked(prisma.friendship.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.friendRequest.create).mockRejectedValue(new Error('Unique constraint'));

    await expect(sendFriendRequest('u1', '닉네임#ABCDE')).rejects.toBeInstanceOf(DuplicateRequestError);
  });
});

// -------- respondToRequest --------

describe('respondToRequest', () => {
  beforeEach(() => vi.clearAllMocks());

  it('존재하지 않는 request → RequestNotFoundError', async () => {
    vi.mocked(prisma.friendRequest.findUnique).mockResolvedValue(null);
    await expect(respondToRequest('u2', 'req1', 'ACCEPT')).rejects.toBeInstanceOf(RequestNotFoundError);
  });

  it('PENDING 아닌 request → RequestNotFoundError', async () => {
    vi.mocked(prisma.friendRequest.findUnique).mockResolvedValue({
      id: 'req1', status: 'ACCEPTED', receiverId: 'u2', senderId: 'u1',
    } as any);
    await expect(respondToRequest('u2', 'req1', 'ACCEPT')).rejects.toBeInstanceOf(RequestNotFoundError);
  });

  it('receiverId 불일치 → ForbiddenError', async () => {
    vi.mocked(prisma.friendRequest.findUnique).mockResolvedValue({
      id: 'req1', status: 'PENDING', receiverId: 'u3', senderId: 'u1',
    } as any);
    await expect(respondToRequest('u2', 'req1', 'ACCEPT')).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('ACCEPT → friendRequest.update(ACCEPTED) + friendship.create 호출', async () => {
    vi.mocked(prisma.friendRequest.findUnique).mockResolvedValue({
      id: 'req1', status: 'PENDING', receiverId: 'u2', senderId: 'u1',
    } as any);
    vi.mocked(prisma.friendRequest.update).mockResolvedValue({} as any);
    vi.mocked(prisma.friendship.create).mockResolvedValue({} as any);

    await expect(respondToRequest('u2', 'req1', 'ACCEPT')).resolves.toBeUndefined();
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prisma.friendRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'ACCEPTED' } })
    );
    expect(prisma.friendship.create).toHaveBeenCalled();
  });

  it('REJECT → friendRequest.update(REJECTED) 호출', async () => {
    vi.mocked(prisma.friendRequest.findUnique).mockResolvedValue({
      id: 'req1', status: 'PENDING', receiverId: 'u2', senderId: 'u1',
    } as any);
    vi.mocked(prisma.friendRequest.update).mockResolvedValue({} as any);

    await expect(respondToRequest('u2', 'req1', 'REJECT')).resolves.toBeUndefined();
    expect(prisma.friendRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'REJECTED' } })
    );
    expect(prisma.friendship.create).not.toHaveBeenCalled();
  });
});

// -------- deleteFriend --------

describe('deleteFriend', () => {
  beforeEach(() => vi.clearAllMocks());

  it('Friendship 없음 → RequestNotFoundError', async () => {
    vi.mocked(prisma.friendship.findUnique).mockResolvedValue(null);
    await expect(deleteFriend('u1', 'u2')).rejects.toBeInstanceOf(RequestNotFoundError);
  });

  it('정상 삭제 → friendship.delete 호출', async () => {
    vi.mocked(prisma.friendship.findUnique).mockResolvedValue({ id: 'fs1' } as any);
    vi.mocked(prisma.friendship.delete).mockResolvedValue({} as any);

    await expect(deleteFriend('u1', 'u2')).resolves.toBeUndefined();
    expect(prisma.friendship.delete).toHaveBeenCalledWith({ where: { id: 'fs1' } });
  });
});

// -------- getFriends --------

describe('getFriends', () => {
  beforeEach(() => vi.clearAllMocks());

  it('빈 목록 반환', async () => {
    vi.mocked(prisma.friendship.findMany).mockResolvedValue([]);
    const result = await getFriends('u1');
    expect(result).toEqual([]);
  });

  it('userAId === userId인 경우 userB를 friend로 반환', async () => {
    const friendship = {
      id: 'fs1',
      userAId: 'u1',
      userBId: 'u2',
      userA: { id: 'u1', nickname: '유저A', friendCode: 'AAAAA', characterId: 'dog' },
      userB: { id: 'u2', nickname: '유저B', friendCode: 'BBBBB', characterId: 'cat' },
    };
    vi.mocked(prisma.friendship.findMany).mockResolvedValue([friendship] as any);

    const result = await getFriends('u1');
    expect(result).toHaveLength(1);
    expect(result[0]!.userId).toBe('u2');
    expect(result[0]!.nickname).toBe('유저B');
  });

  it('userBId === userId인 경우 userA를 friend로 반환', async () => {
    const friendship = {
      id: 'fs1',
      userAId: 'u1',
      userBId: 'u2',
      userA: { id: 'u1', nickname: '유저A', friendCode: 'AAAAA', characterId: 'dog' },
      userB: { id: 'u2', nickname: '유저B', friendCode: 'BBBBB', characterId: 'cat' },
    };
    vi.mocked(prisma.friendship.findMany).mockResolvedValue([friendship] as any);

    const result = await getFriends('u2');
    expect(result).toHaveLength(1);
    expect(result[0]!.userId).toBe('u1');
    expect(result[0]!.nickname).toBe('유저A');
  });

  it('presenceStatus를 getPresence 결과로 채움', async () => {
    const friendship = {
      id: 'fs1',
      userAId: 'u1',
      userBId: 'u2',
      userA: { id: 'u1', nickname: '유저A', friendCode: 'AAAAA', characterId: 'dog' },
      userB: { id: 'u2', nickname: '유저B', friendCode: 'BBBBB', characterId: 'cat' },
    };
    vi.mocked(prisma.friendship.findMany).mockResolvedValue([friendship] as any);
    vi.mocked(getPresence).mockResolvedValue('ONLINE');

    const result = await getFriends('u1');
    expect(result[0]!.presenceStatus).toBe('ONLINE');
    expect(getPresence).toHaveBeenCalledWith('u2');
  });
});
