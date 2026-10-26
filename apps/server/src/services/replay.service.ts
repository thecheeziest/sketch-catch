import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';
import PQueue from 'p-queue';
import type { Prisma } from '@prisma/client';
import type { Mode2StepContent } from '@sketch-catch/shared';
import { prisma } from '../db/prisma.js';
import { redis } from '../db/redis.js';
import type { RevealGifPlayer, RevealToGifOptions } from './gif.service.js';

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

// 다시 만들 수 있는 기간 — 공개식 후 다시 보기·저장까지 머무를 수 있으므로 넉넉히 둔다
const REPLAY_TTL_SECONDS = 1800;
// 만든 GIF는 1장에 수 MB라 Redis(무료 25MB)에 두지 않고 서버 메모리에 최근 몇 장만 잠깐 보관한다
const GIF_CACHE_LIMIT = 3;
const GIF_CACHE_TTL_MS = 10 * 60 * 1000;
// GIF 렌더링은 CPU를 오래 쓴다 — 워커 스레드에서 한 장씩만 만들어 소켓·타이머가 멈추지 않게 한다
const gifQueue = new PQueue({ concurrency: 1 });

const gifCache = new Map<string, { buf: Buffer; expiresAt: number }>();
const inFlight = new Map<string, Promise<Buffer>>();

function metaKey(sheetId: string): string {
  return `replay:${sheetId}:meta`;
}

// sheetId(= 원조자 userId)는 스키마상 @@index만 있고 @unique는 아님(같은 유저가 다른 게임에서 다시 원조자가 될 수 있음)
// → 매 게임마다 새 row를 create하고, 조회는 최신(createdAt desc) 1건만 사용
async function createReplay(sheet: ReplaySheet, roomCode: string, expiresAt: Date): Promise<void> {
  const gifUrl = `/replays/${sheet.sheetId}/gif`;
  await prisma.gameReplay.create({
    data: {
      sheetId: sheet.sheetId,
      roomCode,
      ownerId: sheet.ownerId,
      participantIds: sheet.participantIds,
      steps: sheet.steps as unknown as Prisma.InputJsonValue,
      gifUrl,
      expiresAt,
    },
  });
  const meta: ReplayMeta = { participantIds: sheet.participantIds, gifUrl };
  await redis.set(metaKey(sheet.sheetId), JSON.stringify(meta), 'EX', REPLAY_TTL_SECONDS);
}

// D-10: 공개식 시작 시 시트를 기록만 한다 — GIF는 누군가 저장을 누를 때 getReplayGif가 만든다
export async function saveReplays(code: string, sheets: ReplaySheet[]): Promise<void> {
  const expiresAt = new Date(Date.now() + REPLAY_TTL_SECONDS * 1000);
  for (const sheet of sheets) await createReplay(sheet, code, expiresAt);
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

function createGifWorker(options: RevealToGifOptions): Worker {
  const ext = path.extname(fileURLToPath(import.meta.url));
  const workerUrl = new URL(`./gif.worker${ext}`, import.meta.url);
  if (ext !== '.ts') return new Worker(workerUrl, { workerData: options });
  // 개발(tsx watch): 워커 스레드에는 tsx 로더가 없어 '.js' import를 '.ts' 소스로 못 찾는다 — 워커 안에서 등록 후 불러온다
  const bootstrap = `import('tsx/esm/api').then(({ register }) => { register(); return import(${JSON.stringify(workerUrl.href)}); });`;
  return new Worker(bootstrap, { eval: true, workerData: options });
}

function spawnGifWorker(options: RevealToGifOptions): Promise<Buffer> {
  const worker = createGifWorker(options);
  return new Promise<Buffer>((resolve, reject) => {
    worker.once('message', (bytes: Uint8Array) =>
      resolve(Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength)),
    );
    worker.once('error', reject);
    worker.once('exit', exitCode => {
      if (exitCode !== 0) reject(new Error(`gif worker exited with code ${exitCode}`));
    });
  });
}

function readCache(replayId: string): Buffer | null {
  const hit = gifCache.get(replayId);
  if (!hit) return null;
  if (hit.expiresAt < Date.now()) {
    gifCache.delete(replayId);
    return null;
  }
  return hit.buf;
}

function writeCache(replayId: string, buf: Buffer): void {
  gifCache.delete(replayId);
  gifCache.set(replayId, { buf, expiresAt: Date.now() + GIF_CACHE_TTL_MS });
  // Map은 삽입 순서를 유지한다 — 가장 오래된 것부터 버린다
  while (gifCache.size > GIF_CACHE_LIMIT) {
    const oldest = gifCache.keys().next().value;
    if (oldest === undefined) break;
    gifCache.delete(oldest);
  }
}

async function renderReplay(replayId: string, steps: Mode2StepContent[], participantIds: string[]): Promise<Buffer> {
  const users = await prisma.user.findMany({
    where: { id: { in: participantIds } },
    select: { id: true, nickname: true, characterId: true },
  });
  const players: RevealGifPlayer[] = users.map(u => ({ id: u.id, nickname: u.nickname, characterId: u.characterId }));
  const buf = await gifQueue.add(() => spawnGifWorker({ steps, players }));
  writeCache(replayId, buf);
  return buf;
}

// 가장 최근 게임의 시트 GIF — 같은 시트를 여러 명이 동시에 저장해도 한 번만 만든다
export async function getReplayGif(sheetId: string): Promise<Buffer | null> {
  const replay = await prisma.gameReplay.findFirst({ where: { sheetId }, orderBy: { createdAt: 'desc' } });
  if (!replay || replay.expiresAt.getTime() < Date.now()) return null;

  const cached = readCache(replay.id);
  if (cached) return cached;

  const pending = inFlight.get(replay.id);
  if (pending) return pending;

  const task = renderReplay(replay.id, replay.steps as unknown as Mode2StepContent[], replay.participantIds).finally(
    () => inFlight.delete(replay.id),
  );
  inFlight.set(replay.id, task);
  return task;
}
