import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ChatMessage, Player, RoomState } from '@sketch-catch/shared';
import { reportUserSchema } from '@sketch-catch/shared';

vi.mock('../db/prisma.js', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    userBlock: { upsert: vi.fn(), deleteMany: vi.fn(), findFirst: vi.fn(), findMany: vi.fn() },
    userReport: { create: vi.fn(), findFirst: vi.fn() },
    friendship: { deleteMany: vi.fn() },
    friendRequest: { deleteMany: vi.fn() },
    $transaction: vi.fn(async (ops: unknown[]) => Promise.all(ops)),
  },
}));

const { prisma } = await import('../db/prisma.js');
const { rememberForReport } = await import('../services/chatStore.js');
const {
  blockUser,
  getBlockRelatedIds,
  hasBlockedMember,
  isBlockedEither,
  reportUser,
  SelfModerationError,
  ModerationTargetNotFoundError,
} = await import('../services/moderation.service.js');

const ME = '11111111-1111-4111-8111-111111111111';
const TARGET = '22222222-2222-4222-8222-222222222222';
const OTHER = '33333333-3333-4333-8333-333333333333';

function chat(id: string, userId: string, text: string): ChatMessage {
  return { id, userId, nickname: '닉', characterId: 'cat', chatColorId: null, text, masked: false, createdAt: 0 };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: TARGET } as never);
  vi.mocked(prisma.userReport.findFirst).mockResolvedValue(null);
});

describe('차단', () => {
  it('차단하면 친구 관계와 서로의 대기 중 친구 요청을 함께 정리한다', async () => {
    await blockUser(ME, TARGET);
    expect(prisma.userBlock.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: { blockerId: ME, blockedId: TARGET } }),
    );
    const [userAId, userBId] = ME < TARGET ? [ME, TARGET] : [TARGET, ME];
    expect(prisma.friendship.deleteMany).toHaveBeenCalledWith({ where: { userAId, userBId } });
    expect(prisma.friendRequest.deleteMany).toHaveBeenCalled();
  });

  it('자기 자신이나 없는 유저는 차단할 수 없다', async () => {
    await expect(blockUser(ME, ME)).rejects.toBeInstanceOf(SelfModerationError);
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);
    await expect(blockUser(ME, TARGET)).rejects.toBeInstanceOf(ModerationTargetNotFoundError);
    expect(prisma.userBlock.upsert).not.toHaveBeenCalled();
  });

  it('어느 한쪽이라도 차단했으면 차단 관계로 본다', async () => {
    vi.mocked(prisma.userBlock.findFirst).mockResolvedValueOnce({ blockerId: TARGET } as never);
    expect(await isBlockedEither(ME, TARGET)).toBe(true);
    vi.mocked(prisma.userBlock.findFirst).mockResolvedValueOnce(null);
    expect(await isBlockedEither(ME, TARGET)).toBe(false);
  });
});

describe('신고', () => {
  it('채팅 신고는 서버가 보관한 원문과 방 코드를 남긴다', async () => {
    const messageId = '44444444-4444-4444-8444-444444444444';
    rememberForReport('ROOM01', chat(messageId, TARGET, '나쁜 말'));
    await reportUser(ME, { targetId: TARGET, reason: 'ABUSE', messageId });
    expect(prisma.userReport.create).toHaveBeenCalledWith({
      data: {
        reporterId: ME,
        targetId: TARGET,
        reason: 'ABUSE',
        detail: null,
        messageId,
        messageText: '나쁜 말',
        roomCode: 'ROOM01',
      },
    });
  });

  it('신고 대상이 보낸 메시지가 아니면 원문을 남기지 않는다', async () => {
    const messageId = '55555555-5555-4555-8555-555555555555';
    rememberForReport('ROOM01', chat(messageId, OTHER, '다른 사람 말'));
    await reportUser(ME, { targetId: TARGET, reason: 'SPAM', messageId });
    expect(prisma.userReport.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ messageText: null, roomCode: null }),
    });
  });

  it('같은 메시지를 다시 신고하면 1건만 남긴다', async () => {
    vi.mocked(prisma.userReport.findFirst).mockResolvedValueOnce({ id: 'r1' } as never);
    await reportUser(ME, { targetId: TARGET, reason: 'ABUSE', messageId: '66666666-6666-4666-8666-666666666666' });
    expect(prisma.userReport.create).not.toHaveBeenCalled();
  });

  it('프로필 신고는 메시지 없이 접수되고 기타 사유의 직접 쓴 내용을 남긴다', async () => {
    await reportUser(ME, { targetId: TARGET, reason: 'OTHER', detail: '닉네임이 불쾌해요' });
    expect(prisma.userReport.create).toHaveBeenCalledWith({
      data: {
        reporterId: ME,
        targetId: TARGET,
        reason: 'OTHER',
        detail: '닉네임이 불쾌해요',
        messageId: null,
        messageText: null,
        roomCode: null,
      },
    });
  });
});

describe('신고 입력 검증', () => {
  const base = { targetId: TARGET };
  it('기타 사유는 내용이 있어야 하고, 다른 사유에는 내용을 붙일 수 없다', () => {
    expect(reportUserSchema.safeParse({ ...base, reason: 'OTHER', detail: '  내용  ' }).data?.detail).toBe('내용');
    expect(reportUserSchema.safeParse({ ...base, reason: 'OTHER' }).success).toBe(false);
    expect(reportUserSchema.safeParse({ ...base, reason: 'OTHER', detail: '   ' }).success).toBe(false);
    expect(reportUserSchema.safeParse({ ...base, reason: 'ABUSE', detail: '내용' }).success).toBe(false);
    expect(reportUserSchema.safeParse({ ...base, reason: 'OTHER', detail: '가'.repeat(101) }).success).toBe(false);
  });
});

describe('차단 관계와 방', () => {
  const player = (id: string, extra: Partial<Player> = {}): Player => ({
    id,
    nickname: id,
    friendCode: 'CODE1',
    characterId: 'cat',
    slot: 0,
    isHost: false,
    isReady: false,
    connected: true,
    ...extra,
  });
  const room = (players: Player[], awardViewers?: Player[]) => ({ players, awardViewers }) as RoomState;

  it('내가 차단했든 나를 차단했든 상대 id를 모두 돌려준다', async () => {
    vi.mocked(prisma.userBlock.findMany).mockResolvedValueOnce([
      { blockerId: ME, blockedId: TARGET },
      { blockerId: OTHER, blockedId: ME },
    ] as never);
    expect([...(await getBlockRelatedIds(ME))].sort()).toEqual([TARGET, OTHER].sort());
  });

  it('차단 관계인 사람이 앉아 있거나 시상식에 남아 있으면 그 방은 막고, 나간 사람은 무시한다', () => {
    const related = new Set([TARGET]);
    expect(hasBlockedMember(room([player(ME), player(TARGET)]), related)).toBe(true);
    expect(hasBlockedMember(room([player(ME)], [player(TARGET)]), related)).toBe(true);
    expect(hasBlockedMember(room([player(ME), player(TARGET, { left: true })]), related)).toBe(false);
    expect(hasBlockedMember(room([player(ME), player(OTHER)]), related)).toBe(false);
  });
});
