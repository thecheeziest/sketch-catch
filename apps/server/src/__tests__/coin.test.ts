import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';
import type { RoomState } from '@sketch-catch/shared';

// 트랜잭션 클라이언트(tx)와 일반 클라이언트를 같은 mock으로 쓴다
const db = {
  coinLedger: { findUnique: vi.fn(), aggregate: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
  user: { update: vi.fn(), updateMany: vi.fn() },
  userItem: { findUnique: vi.fn(), create: vi.fn() },
};
vi.mock('../db/prisma.js', () => ({
  prisma: { ...db, $transaction: vi.fn(async (fn: (tx: typeof db) => unknown) => fn(db)) },
}));

const {
  computeMode1Lines,
  computeMode2Lines,
  createCoinStats,
  recordMode1Round,
  recordMode2Submit,
  isRewardEligible,
  startOfKstDay,
  settleGameReward,
  purchaseItem,
  equipItem,
  AlreadyOwnedError,
  InsufficientCoinsError,
  ItemNotFoundError,
  ItemNotOwnedError,
} = await import('../services/coin.service.js');

const total = (lines: { amount: number }[]): number => lines.reduce((sum, l) => sum + l.amount, 0);

describe('computeMode1Lines', () => {
  it('완주 + 정답·그림 횟수 + 순위 보너스를 합산한다', () => {
    const stats = { ...createCoinStats(), correct: { a: 3 }, solved: { a: 2 } };
    const lines = computeMode1Lines({ userId: 'a', rank: 1, playerCount: 4, stats });
    expect(lines).toEqual([
      { reason: 'COMPLETE', amount: 10 },
      { reason: 'CORRECT', count: 3, amount: 15 },
      { reason: 'DRAWING_SOLVED', count: 2, amount: 10 },
      { reason: 'RANK', rank: 1, amount: 30 },
    ]);
  });

  it('정답·그림 보상은 판당 15로 묶는다', () => {
    const stats = { ...createCoinStats(), correct: { a: 7 }, solved: { a: 5 } };
    const lines = computeMode1Lines({ userId: 'a', rank: 5, playerCount: 6, stats });
    expect(total(lines)).toBe(10 + 15 + 15);
  });

  it('3등 보너스는 4인 이상일 때만 준다', () => {
    const stats = createCoinStats();
    expect(computeMode1Lines({ userId: 'a', rank: 3, playerCount: 3, stats }).some(l => l.reason === 'RANK')).toBe(false);
    expect(computeMode1Lines({ userId: 'a', rank: 3, playerCount: 4, stats }).find(l => l.reason === 'RANK')?.amount).toBe(10);
  });

  it('그리기 차례에 아무것도 그리지 않았으면 순위 보너스를 빼고 나머지는 준다', () => {
    const stats = { ...createCoinStats(), correct: { a: 1 }, idleDrawers: ['a'] };
    const lines = computeMode1Lines({ userId: 'a', rank: 1, playerCount: 4, stats });
    expect(lines.map(l => l.reason)).toEqual(['COMPLETE', 'CORRECT']);
  });
});

describe('computeMode2Lines', () => {
  it('완주 + 직접 제출 횟수 (최대 15)', () => {
    const stats = { ...createCoinStats(), submits: { a: 4 } };
    expect(computeMode2Lines({ userId: 'a', stats })).toEqual([
      { reason: 'COMPLETE', amount: 10 },
      { reason: 'SUBMIT', count: 4, amount: 15 },
    ]);
  });
});

describe('판 중 집계', () => {
  const state = (): RoomState => ({ coinStats: createCoinStats() }) as RoomState;

  it('맞힌 라운드는 정답자·출제자 횟수를 올린다', () => {
    const s = state();
    recordMode1Round(s, { drawerId: 'd', correctUserId: 'g', drewSomething: true });
    expect(s.coinStats).toMatchObject({ correct: { g: 1 }, solved: { d: 1 }, idleDrawers: [] });
  });

  it('아무도 못 맞혔고 그림도 없으면 출제자를 한 번만 제외 대상에 넣는다', () => {
    const s = state();
    recordMode1Round(s, { drawerId: 'd', correctUserId: null, drewSomething: false });
    recordMode1Round(s, { drawerId: 'd', correctUserId: null, drewSomething: false });
    expect(s.coinStats?.idleDrawers).toEqual(['d']);
  });

  it('못 맞혔어도 그림이 있으면 제외하지 않는다', () => {
    const s = state();
    recordMode1Round(s, { drawerId: 'd', correctUserId: null, drewSomething: true });
    expect(s.coinStats?.idleDrawers).toEqual([]);
  });

  it('coinStats가 없던 방도 모드2 제출을 센다', () => {
    const s = {} as RoomState;
    recordMode2Submit(s, 'a');
    recordMode2Submit(s, 'a');
    expect(s.coinStats?.submits).toEqual({ a: 2 });
  });
});

describe('isRewardEligible / startOfKstDay', () => {
  it('3인 이상만 지급', () => {
    expect(isRewardEligible(2)).toBe(false);
    expect(isRewardEligible(3)).toBe(true);
  });

  it('한국 시간 자정을 UTC로 돌려준다', () => {
    // KST 2026-10-20 08:30 = UTC 2026-10-19 23:30 → 기준은 KST 10-20 00:00 = UTC 10-19 15:00
    expect(startOfKstDay(new Date('2026-10-19T23:30:00Z')).toISOString()).toBe('2026-10-19T15:00:00.000Z');
    // KST 2026-10-19 23:59 = UTC 14:59 → 기준은 UTC 10-18 15:00
    expect(startOfKstDay(new Date('2026-10-19T14:59:00Z')).toISOString()).toBe('2026-10-18T15:00:00.000Z');
  });
});

describe('settleGameReward', () => {
  const lines = [
    { reason: 'COMPLETE' as const, amount: 10 },
    { reason: 'RANK' as const, rank: 1, amount: 30 },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    db.coinLedger.findUnique.mockResolvedValue(null);
    db.coinLedger.aggregate.mockResolvedValue({ _sum: { amount: 0 } });
    db.coinLedger.findFirst.mockResolvedValue({ id: 'bonus' });
    db.user.update.mockImplementation(async ({ data }) => ({ coins: 100 + data.coins.increment }));
  });

  it('게임 보상을 지급하고 원장을 남긴다', async () => {
    const reward = await settleGameReward({ userId: 'u', gameId: 'g', mode: 1, lines });
    expect(reward).toMatchObject({ total: 40, balance: 140, todayEarned: 40, capped: false });
    expect(db.coinLedger.create).toHaveBeenCalledTimes(1);
    expect(db.coinLedger.create.mock.calls[0]![0].data).toMatchObject({ amount: 40, reason: 'GAME', refId: 'g' });
  });

  it('하루 첫 완주면 상한과 별도로 보너스 20을 더한다', async () => {
    db.coinLedger.findFirst.mockResolvedValue(null);
    const reward = await settleGameReward({ userId: 'u', gameId: 'g', mode: 1, lines });
    expect(reward?.total).toBe(60);
    expect(reward?.lines.at(-1)).toEqual({ reason: 'FIRST_GAME', amount: 20 });
    expect(reward?.todayEarned).toBe(40);
  });

  it('하루 상한 400을 넘는 만큼은 지급하지 않는다', async () => {
    db.coinLedger.aggregate.mockResolvedValue({ _sum: { amount: 380 } });
    const reward = await settleGameReward({ userId: 'u', gameId: 'g', mode: 1, lines });
    expect(reward).toMatchObject({ total: 20, todayEarned: 400, capped: true });
  });

  it('이미 정산한 게임은 다시 지급하지 않는다', async () => {
    db.coinLedger.findUnique.mockResolvedValue({ id: 'done' });
    expect(await settleGameReward({ userId: 'u', gameId: 'g', mode: 1, lines })).toBeNull();
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it('동시에 들어온 같은 게임 정산(unique 위반)은 null', async () => {
    db.coinLedger.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'test' }),
    );
    expect(await settleGameReward({ userId: 'u', gameId: 'g', mode: 1, lines })).toBeNull();
  });
});

describe('purchaseItem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.userItem.findUnique.mockResolvedValue(null);
    db.user.updateMany.mockResolvedValue({ count: 1 });
    db.user.update.mockResolvedValue({ id: 'u', items: [] });
  });

  it('서버 가격으로 차감하고 보유·원장·장착을 처리한다', async () => {
    await purchaseItem('u', 'frame_mint', true);
    expect(db.user.updateMany).toHaveBeenCalledWith({
      where: { id: 'u', coins: { gte: 200 } },
      data: { coins: { decrement: 200 } },
    });
    expect(db.userItem.create).toHaveBeenCalledWith({ data: { userId: 'u', itemId: 'frame_mint' } });
    expect(db.coinLedger.create.mock.calls[0]![0].data).toMatchObject({ amount: -200, reason: 'PURCHASE' });
    expect(db.user.update.mock.calls[0]![0].data).toEqual({ frameId: 'frame_mint' });
  });

  it('없는 아이템은 거부', async () => {
    await expect(purchaseItem('u', 'nope', true)).rejects.toBeInstanceOf(ItemNotFoundError);
  });

  it('이미 보유한 아이템은 거부', async () => {
    db.userItem.findUnique.mockResolvedValue({ userId: 'u', itemId: 'fox' });
    await expect(purchaseItem('u', 'fox', true)).rejects.toBeInstanceOf(AlreadyOwnedError);
  });

  it('잔액이 부족하면 차감 없이 거부', async () => {
    db.user.updateMany.mockResolvedValue({ count: 0 });
    await expect(purchaseItem('u', 'fox', true)).rejects.toBeInstanceOf(InsufficientCoinsError);
    expect(db.userItem.create).not.toHaveBeenCalled();
  });
});

describe('equipItem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.user.update.mockResolvedValue({ id: 'u', items: [] });
  });

  it('보유한 아이템만 장착', async () => {
    db.userItem.findUnique.mockResolvedValue(null);
    await expect(equipItem('u', { category: 'BACKGROUND', itemId: 'bg_dots' })).rejects.toBeInstanceOf(ItemNotOwnedError);

    db.userItem.findUnique.mockResolvedValue({ userId: 'u', itemId: 'bg_dots' });
    await equipItem('u', { category: 'BACKGROUND', itemId: 'bg_dots' });
    expect(db.user.update.mock.calls[0]![0].data).toEqual({ backgroundId: 'bg_dots' });
  });

  it('카테고리가 다른 아이템은 거부', async () => {
    await expect(equipItem('u', { category: 'FRAME', itemId: 'bg_dots' })).rejects.toBeInstanceOf(ItemNotFoundError);
  });

  it('null이면 기본 모습으로 되돌린다', async () => {
    await equipItem('u', { category: 'CHAT_COLOR', itemId: null });
    expect(db.user.update.mock.calls[0]![0].data).toEqual({ chatColorId: null });
    expect(db.userItem.findUnique).not.toHaveBeenCalled();
  });
});
