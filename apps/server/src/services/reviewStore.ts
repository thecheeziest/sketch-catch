import type { Mode2ReviewSheet } from '@sketch-catch/shared';
import { redis } from '../db/redis.js';

// 정답 공개식 시트(그림 전체)는 RoomState와 따로 둔다.
// RoomState에 넣으면 공개식·시상식 동안의 채팅·입퇴장마다 그림 전체를 읽고 쓰고 room:state로 다시 보내게 된다.
// 방 상태 키와 같은 상한 — 방이 끝나면 destroyRoom/finishAward가 먼저 지운다
const REVIEW_TTL_SEC = 7200;

function reviewKey(code: string): string {
  return `room:${code}:review`;
}

export async function saveReviewSheets(code: string, sheets: Mode2ReviewSheet[]): Promise<void> {
  await redis.set(reviewKey(code), JSON.stringify(sheets), 'EX', REVIEW_TTL_SEC);
}

export async function getReviewSheets(code: string): Promise<Mode2ReviewSheet[] | null> {
  const raw = await redis.get(reviewKey(code));
  return raw ? (JSON.parse(raw) as Mode2ReviewSheet[]) : null;
}

export async function clearReviewSheets(code: string): Promise<void> {
  await redis.del(reviewKey(code));
}
