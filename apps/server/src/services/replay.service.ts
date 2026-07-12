import PQueue from 'p-queue';
import type { Namespace } from 'socket.io';
import type { Prisma } from '@prisma/client';
import type { ClientEvents, Mode2StepContent, ServerEvents } from '@sketch-catch/shared';
import { SERVER_EVENT } from '@sketch-catch/shared';
import { prisma } from '../db/prisma.js';
import { redis } from '../db/redis.js';
import { logger } from '../lib/logger.js';
import { sheetToGif } from './gif.service.js';

type GameNamespace = Namespace<ClientEvents, ServerEvents>;

export type ReplaySheet = {
  sheetId: string;
  ownerId: string;
  participantIds: string[];
  steps: Mode2StepContent[];
};

export type ReplayMeta = {
  participantIds: string[];
  gifUrl: string;
};

// D-10: N개 시트 GIF 동시 생성 부하 제한 — 서버 CPU를 독점하지 않도록 동시 2개까지만 렌더링
const gifQueue = new PQueue({ concurrency: 2 });

// Pitfall 6: 리뷰+베스트 투표+미리보기까지 거친 뒤 저장하므로 10분(MVP 초안)보다 넉넉한 30분 TTL 적용
const GIF_TTL_SECONDS = 1800;
const META_TTL_SECONDS = 1800;

function gifKey(sheetId: string): string {
  return `replay:${sheetId}:gif`;
}

function metaKey(sheetId: string): string {
  return `replay:${sheetId}:meta`;
}

// sheetId(= 원조자 userId)는 스키마상 @@index만 있고 @unique는 아님(같은 유저가 다른 게임에서 다시 원조자가 될 수 있음)
// → upsert 대신 매 게임 종료마다 새 row를 create하고, 조회는 최신(createdAt desc) 1건만 사용
export async function createReplay(sheet: ReplaySheet, roomCode: string, expiresAt: Date): Promise<string> {
  const replay = await prisma.gameReplay.create({
    data: {
      sheetId: sheet.sheetId,
      roomCode,
      ownerId: sheet.ownerId,
      participantIds: sheet.participantIds,
      steps: sheet.steps as unknown as Prisma.InputJsonValue,
      expiresAt,
    },
  });

  const meta: ReplayMeta = {
    participantIds: sheet.participantIds,
    gifUrl: `/replays/${sheet.sheetId}/gif`,
  };
  await redis.set(metaKey(sheet.sheetId), JSON.stringify(meta), 'EX', META_TTL_SECONDS);

  return replay.id;
}

export async function getReplayMeta(sheetId: string): Promise<ReplayMeta | null> {
  const cached = await redis.get(metaKey(sheetId));
  if (cached) return JSON.parse(cached) as ReplayMeta;

  const replay = await prisma.gameReplay.findFirst({ where: { sheetId }, orderBy: { createdAt: 'desc' } });
  if (!replay) return null;

  return {
    participantIds: replay.participantIds,
    gifUrl: replay.gifUrl ?? `/replays/${replay.sheetId}/gif`,
  };
}

export async function getReplayGif(sheetId: string): Promise<Buffer | null> {
  return redis.getBuffer(gifKey(sheetId));
}

// D-10: 게임 종료 즉시 N개 시트 전체 GIF를 p-queue로 동시성 제한하며 생성.
// 완료되는 대로 개별 시트 gifUrl을 room에 브로드캐스트(cookie:ready) — 전체 완료를 기다리지 않음.
export async function generateSheetGifs(game: GameNamespace, code: string, sheets: ReplaySheet[]): Promise<void> {
  const expiresAt = new Date(Date.now() + GIF_TTL_SECONDS * 1000);

  await Promise.all(
    sheets.map(sheet =>
      gifQueue.add(async () => {
        try {
          const replayId = await createReplay(sheet, code, expiresAt);

          const buf = await sheetToGif({ steps: sheet.steps });
          await redis.set(gifKey(sheet.sheetId), buf, 'EX', GIF_TTL_SECONDS);

          const gifUrl = `/replays/${sheet.sheetId}/gif`;
          await prisma.gameReplay.update({ where: { id: replayId }, data: { gifUrl } });

          game.to(`room:${code}`).emit(SERVER_EVENT.COOKIE_READY, { sheetId: sheet.sheetId, gifUrl });
        } catch (err) {
          logger.error({ err, sheetId: sheet.sheetId }, 'sheet gif generation failed');
        }
      })
    )
  );
}
