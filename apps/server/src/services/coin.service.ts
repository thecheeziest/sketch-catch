import { Prisma } from '@prisma/client';
import {
  COIN_MIN_PLAYERS,
  COIN_REWARD,
  DAILY_COIN_CAP,
  getShopItem,
  type CoinReward,
  type CoinRewardLine,
  type CoinStats,
  type EquipInput,
  type RoomState,
  type ShopItem,
} from '@sketch-catch/shared';
import { prisma } from '../db/prisma.js';
import { USER_WITH_ITEMS, type UserWithItems } from '../lib/userPrivate.js';

export class ItemNotFoundError extends Error {
  readonly code = 'ITEM_NOT_FOUND';
}
export class AlreadyOwnedError extends Error {
  readonly code = 'ALREADY_OWNED';
}
export class InsufficientCoinsError extends Error {
  readonly code = 'INSUFFICIENT_COINS';
}
export class ItemNotOwnedError extends Error {
  readonly code = 'ITEM_NOT_OWNED';
}

export function createCoinStats(): CoinStats {
  return { correct: {}, solved: {}, idleDrawers: [], submits: {} };
}

// ─── 판 중 집계 (RoomState.coinStats를 직접 갱신 — 저장은 호출 측) ─────────────

/**
 * 모드1 라운드 결과 집계. 맞힌 라운드는 그림이 있었다고 보고,
 * 아무도 못 맞혔는데 출제자가 아무것도 그리지 않았으면 순위 보너스 제외 대상으로 표시한다.
 */
export function recordMode1Round(
  state: RoomState,
  round: { drawerId: string; correctUserId: string | null; drewSomething: boolean },
): void {
  const stats = (state.coinStats ??= createCoinStats());
  if (round.correctUserId) {
    stats.correct[round.correctUserId] = (stats.correct[round.correctUserId] ?? 0) + 1;
    stats.solved[round.drawerId] = (stats.solved[round.drawerId] ?? 0) + 1;
    return;
  }
  if (!round.drewSomething && !stats.idleDrawers.includes(round.drawerId)) stats.idleDrawers.push(round.drawerId);
}

/** 모드2 직접 제출 집계 — 시간 초과 자동 제출은 세지 않는다 */
export function recordMode2Submit(state: RoomState, userId: string): void {
  const stats = (state.coinStats ??= createCoinStats());
  stats.submits[userId] = (stats.submits[userId] ?? 0) + 1;
}

// ─── 지급액 계산 (순수 함수) ──────────────────────────────────────────────────

function rankBonus(rank: number, playerCount: number): number {
  if (rank === 3 && playerCount < COIN_REWARD.MODE1_RANK3_MIN_PLAYERS) return 0;
  return COIN_REWARD.MODE1_RANK[rank - 1] ?? 0;
}

function cappedCountLine(
  reason: CoinRewardLine['reason'],
  count: number,
  unit: number,
  max: number,
): CoinRewardLine | null {
  if (count <= 0) return null;
  return { reason, count, amount: Math.min(count * unit, max) };
}

/** 모드1 한 명의 지급 내역 — 순위는 시상대 순위 그대로 쓴다 (동점은 정답 시각으로 이미 갈려 있음) */
export function computeMode1Lines(params: {
  userId: string;
  rank: number;
  playerCount: number;
  stats: CoinStats;
}): CoinRewardLine[] {
  const { userId, rank, playerCount, stats } = params;
  const lines: CoinRewardLine[] = [{ reason: 'COMPLETE', amount: COIN_REWARD.COMPLETE }];
  const correct = cappedCountLine(
    'CORRECT',
    stats.correct[userId] ?? 0,
    COIN_REWARD.MODE1_CORRECT,
    COIN_REWARD.MODE1_CORRECT_MAX,
  );
  if (correct) lines.push(correct);
  const solved = cappedCountLine(
    'DRAWING_SOLVED',
    stats.solved[userId] ?? 0,
    COIN_REWARD.MODE1_DRAWING_SOLVED,
    COIN_REWARD.MODE1_DRAWING_SOLVED_MAX,
  );
  if (solved) lines.push(solved);
  // 그리기 차례에 아무것도 그리지 않았다면 순위 보너스는 주지 않는다
  if (!stats.idleDrawers.includes(userId)) {
    const bonus = rankBonus(rank, playerCount);
    if (bonus > 0) lines.push({ reason: 'RANK', rank, amount: bonus });
  }
  return lines;
}

/** 모드2 한 명의 지급 내역 — 공개식까지 남아 있으면 완주, 직접 제출 횟수만 센다 */
export function computeMode2Lines(params: { userId: string; stats: CoinStats }): CoinRewardLine[] {
  const lines: CoinRewardLine[] = [{ reason: 'COMPLETE', amount: COIN_REWARD.COMPLETE }];
  const submits = cappedCountLine(
    'SUBMIT',
    params.stats.submits[params.userId] ?? 0,
    COIN_REWARD.MODE2_SUBMIT,
    COIN_REWARD.MODE2_SUBMIT_MAX,
  );
  if (submits) lines.push(submits);
  return lines;
}

export function isRewardEligible(playerCount: number): boolean {
  return playerCount >= COIN_MIN_PLAYERS;
}

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** 하루 상한·첫 완주 보너스의 기준인 한국 시간 자정 */
export function startOfKstDay(now: Date): Date {
  const shifted = new Date(now.getTime() + KST_OFFSET_MS);
  shifted.setUTCHours(0, 0, 0, 0);
  return new Date(shifted.getTime() - KST_OFFSET_MS);
}

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

// ─── 게임 정산 ────────────────────────────────────────────────────────────────

/**
 * 한 명의 게임 보상을 지급한다. 같은 게임은 원장 unique로 한 번만 지급되며, 이미 지급됐으면 null.
 * 하루 상한(DAILY_COIN_CAP)은 게임 보상에만 적용하고, 하루 첫 완주 보너스는 상한과 별도로 준다.
 */
export async function settleGameReward(params: {
  userId: string;
  gameId: string;
  mode: 1 | 2;
  lines: CoinRewardLine[];
  now?: Date;
}): Promise<CoinReward | null> {
  const { userId, gameId, mode, lines } = params;
  const now = params.now ?? new Date();
  const dayStart = startOfKstDay(now);
  const baseTotal = lines.reduce((sum, line) => sum + line.amount, 0);

  try {
    return await prisma.$transaction(async tx => {
      const settled = await tx.coinLedger.findUnique({
        where: { userId_reason_refId: { userId, reason: 'GAME', refId: gameId } },
      });
      if (settled) return null;

      const today = await tx.coinLedger.aggregate({
        where: { userId, reason: 'GAME', createdAt: { gte: dayStart } },
        _sum: { amount: true },
      });
      const earnedBefore = today._sum.amount ?? 0;
      const granted = Math.max(0, Math.min(baseTotal, DAILY_COIN_CAP - earnedBefore));

      const firstBonusGiven = await tx.coinLedger.findFirst({
        where: { userId, reason: 'FIRST_GAME_BONUS', createdAt: { gte: dayStart } },
        select: { id: true },
      });
      const bonus = firstBonusGiven ? 0 : COIN_REWARD.FIRST_GAME_BONUS;

      // 0코인이어도 원장을 남겨 같은 게임의 재정산을 막는다
      await tx.coinLedger.create({ data: { userId, amount: granted, reason: 'GAME', refId: gameId, createdAt: now } });
      if (bonus > 0) {
        await tx.coinLedger.create({
          data: { userId, amount: bonus, reason: 'FIRST_GAME_BONUS', refId: gameId, createdAt: now },
        });
      }
      const user = await tx.user.update({
        where: { id: userId },
        data: { coins: { increment: granted + bonus } },
        select: { coins: true },
      });

      return {
        gameId,
        mode,
        lines: bonus > 0 ? [...lines, { reason: 'FIRST_GAME', amount: bonus }] : lines,
        total: granted + bonus,
        balance: user.coins,
        todayEarned: earnedBefore + granted,
        dailyCap: DAILY_COIN_CAP,
        capped: granted < baseTotal,
      } satisfies CoinReward;
    });
  } catch (err) {
    // 동시에 들어온 같은 게임 정산 — 먼저 끝난 쪽만 유효
    if (isUniqueViolation(err)) return null;
    throw err;
  }
}

// ─── 구매·장착 ────────────────────────────────────────────────────────────────

function equipData(item: ShopItem): Prisma.UserUpdateInput {
  switch (item.category) {
    case 'CHARACTER':
      return { characterId: item.id };
    case 'FRAME':
      return { frameId: item.id };
    case 'BACKGROUND':
      return { backgroundId: item.id };
    case 'CHAT_COLOR':
      return { chatColorId: item.id };
  }
}

/** 잔액 확인 → 차감 → 보유 → (장착)을 한 트랜잭션으로. 가격은 서버 카탈로그 기준 */
export async function purchaseItem(userId: string, itemId: string, equip: boolean): Promise<UserWithItems> {
  const item = getShopItem(itemId);
  if (!item) throw new ItemNotFoundError();

  try {
    return await prisma.$transaction(async tx => {
      const owned = await tx.userItem.findUnique({ where: { userId_itemId: { userId, itemId } } });
      if (owned) throw new AlreadyOwnedError();

      // 조건부 차감으로 잔액 확인과 차감을 원자적으로 처리한다
      const debited = await tx.user.updateMany({
        where: { id: userId, coins: { gte: item.price } },
        data: { coins: { decrement: item.price } },
      });
      if (debited.count === 0) throw new InsufficientCoinsError();

      await tx.userItem.create({ data: { userId, itemId } });
      await tx.coinLedger.create({ data: { userId, amount: -item.price, reason: 'PURCHASE', refId: itemId } });

      return tx.user.update({
        where: { id: userId },
        data: equip ? equipData(item) : {},
        include: USER_WITH_ITEMS,
      });
    });
  } catch (err) {
    // 같은 아이템 동시 구매 — 한쪽만 성공, 나머지는 차감까지 롤백된다
    if (isUniqueViolation(err)) throw new AlreadyOwnedError();
    throw err;
  }
}

const UNEQUIP_FIELD = {
  FRAME: 'frameId',
  BACKGROUND: 'backgroundId',
  CHAT_COLOR: 'chatColorId',
} as const;

/** 보유한 아이템만 장착. itemId null은 기본 모습으로 되돌림 (캐릭터 제외) */
export async function equipItem(userId: string, input: EquipInput): Promise<UserWithItems> {
  const { itemId } = input;
  if (itemId === null) {
    if (input.category === 'CHARACTER') throw new ItemNotFoundError();
    return prisma.user.update({
      where: { id: userId },
      data: { [UNEQUIP_FIELD[input.category]]: null },
      include: USER_WITH_ITEMS,
    });
  }

  const item = getShopItem(itemId);
  if (!item || item.category !== input.category) throw new ItemNotFoundError();
  await assertOwned(userId, item.id);

  return prisma.user.update({ where: { id: userId }, data: equipData(item), include: USER_WITH_ITEMS });
}

export async function assertOwned(userId: string, itemId: string): Promise<void> {
  const owned = await prisma.userItem.findUnique({ where: { userId_itemId: { userId, itemId } } });
  if (!owned) throw new ItemNotOwnedError();
}
