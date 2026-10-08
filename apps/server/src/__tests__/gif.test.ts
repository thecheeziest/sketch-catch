import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import type { Stroke } from '@sketch-catch/shared';
import { createCanvas, loadImage } from '@napi-rs/canvas';

// ---- gif generation: sheetToGif 실제 렌더링 (napi-rs/canvas — mock 없음, 로컬 darwin 바이너리) ----

const { sheetToGif } = await import('../services/gif.service.js');

const sampleStroke: Stroke = {
  id: 'stroke-1',
  authorId: 'u2',
  color: '#222222',
  width: 0.02,
  points: [
    { x: 0.1, y: 0.1, t: 0 },
    { x: 0.5, y: 0.5, t: 500 },
    { x: 0.9, y: 0.2, t: 1000 },
  ],
  startTime: 0,
};

describe('gif generation', () => {
  it('페인트 영역을 GIF에 색칠하고 바깥은 보존한다', async () => {
    const buf = await sheetToGif({
      width: 32,
      height: 32,
      fps: 10,
      drawFrameDurationMs: 100,
      steps: [
        {
          kind: 'DRAW',
          authorId: 'u2',
          strokes: [
            {
              id: 'fill',
              authorId: 'u2',
              color: '#FFD21F',
              width: 0,
              points: [],
              startTime: 100,
              paintSpans: [{ x: 0.25, y: 0.25, width: 0.5, height: 0.5 }],
            },
          ],
        },
      ],
    });
    const decoded = await loadImage(buf);
    const ctx = createCanvas(32, 32).getContext('2d');
    ctx.drawImage(decoded, 0, 0);
    expect(Array.from(ctx.getImageData(16, 16, 1, 1).data)).toEqual([255, 210, 31, 255]);
    expect(Array.from(ctx.getImageData(0, 0, 1, 1).data)).toEqual([255, 255, 255, 255]);
  });
  it('sheetToGif가 GIF89a 매직 바이트로 시작하는 Buffer를 반환한다', async () => {
    const buf = await sheetToGif({
      steps: [
        { kind: 'PROMPT', authorId: 'u1', text: '강아지' },
        { kind: 'DRAW', authorId: 'u2', strokes: [sampleStroke] },
      ],
      width: 480,
      height: 480,
      fps: 12,
    });

    expect(buf.length).toBeGreaterThan(0);
    expect(buf.subarray(0, 6).toString('ascii')).toBe('GIF89a');
  }, 15_000);

  it('텍스트 단계 2개 + 그림 단계 1개 조합 시 텍스트 프레임과 그림 프레임이 모두 포함된다', async () => {
    const textOnly = await sheetToGif({
      steps: [{ kind: 'PROMPT', authorId: 'u1', text: '강아지' }],
      width: 480,
      height: 480,
      fps: 12,
    });

    const mixed = await sheetToGif({
      steps: [
        { kind: 'PROMPT', authorId: 'u1', text: '강아지' },
        { kind: 'ANSWER', authorId: 'u3', text: '멍멍이' },
        { kind: 'DRAW', authorId: 'u2', strokes: [sampleStroke] },
      ],
      width: 480,
      height: 480,
      fps: 12,
    });

    expect(mixed.length).toBeGreaterThan(0);
    // 그림 단계는 다수 프레임(D-14 배속 재생)으로 확장되고 텍스트 프레임도 2개 추가되므로
    // 텍스트 1개짜리 GIF보다 훨씬 큰 바이트 크기를 갖는다 — 두 종류 프레임 모두 합성됐음을 검증
    expect(mixed.length).toBeGreaterThan(textOnly.length);
  }, 15_000);
});

// ---- gif access control: GET /replays/:sheetId/gif 권한 검증 ----

vi.mock('../services/replay.service.js', () => ({
  getReplayMeta: vi.fn(),
  getReplayGif: vi.fn(),
}));
vi.mock('../db/redis.js', () => ({
  redis: { get: vi.fn(), set: vi.fn(), del: vi.fn() },
  setPresence: vi.fn().mockResolvedValue(undefined),
  getPresence: vi.fn().mockResolvedValue('OFFLINE'),
}));

const { redis } = await import('../db/redis.js');
const { signTokens } = await import('../auth/jwt.js');
const { getReplayMeta, getReplayGif } = await import('../services/replay.service.js');
const { replaysRoutes } = await import('../routes/replays.js');

async function buildApp() {
  const app = Fastify();
  await app.register(replaysRoutes);
  return app;
}

describe('gif access control', () => {
  beforeEach(() => vi.clearAllMocks());

  it('참여자(u1) 토큰으로 요청 시 200 + content-type image/gif', async () => {
    const { accessToken } = await signTokens('u1');
    vi.mocked(redis.get).mockResolvedValue(accessToken);
    vi.mocked(getReplayMeta).mockResolvedValue({ participantIds: ['u1', 'u2'], gifUrl: '/replays/s1/gif' });
    vi.mocked(getReplayGif).mockResolvedValue(Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]));

    const app = await buildApp();
    const res = await app.inject({
      method: 'GET',
      url: '/replays/s1/gif',
      headers: { authorization: `Bearer ${accessToken}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('image/gif');
  });

  it('비참여자(u3) 토큰으로 동일 요청 시 403', async () => {
    const { accessToken } = await signTokens('u3');
    vi.mocked(redis.get).mockResolvedValue(accessToken);
    vi.mocked(getReplayMeta).mockResolvedValue({ participantIds: ['u1', 'u2'], gifUrl: '/replays/s1/gif' });

    const app = await buildApp();
    const res = await app.inject({
      method: 'GET',
      url: '/replays/s1/gif',
      headers: { authorization: `Bearer ${accessToken}` },
    });

    expect(res.statusCode).toBe(403);
  });

  it('존재하지 않는 sheetId 요청 시 404', async () => {
    const { accessToken } = await signTokens('u1');
    vi.mocked(redis.get).mockResolvedValue(accessToken);
    vi.mocked(getReplayMeta).mockResolvedValue(null);

    const app = await buildApp();
    const res = await app.inject({
      method: 'GET',
      url: '/replays/unknown/gif',
      headers: { authorization: `Bearer ${accessToken}` },
    });

    expect(res.statusCode).toBe(404);
  });
});
