import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import type { Stroke } from '@sketch-catch/shared';
import { createCanvas, loadImage } from '@napi-rs/canvas';

// ---- gif generation: revealToGif 실제 렌더링 (napi-rs/canvas — mock 없음, 로컬 darwin 바이너리) ----

const { revealToGif } = await import('../services/gif.service.js');

const sampleStroke: Stroke = {
  id: 'stroke-1',
  authorId: 'u1',
  color: '#222222',
  width: 0.02,
  points: [
    { x: 0.1, y: 0.1, t: 0 },
    { x: 0.5, y: 0.5, t: 500 },
    { x: 0.9, y: 0.2, t: 1000 },
  ],
  startTime: 0,
};

const players = [
  { id: 'u1', nickname: '원조', characterId: 'cat' },
  { id: 'u2', nickname: '추측', characterId: 'frog' },
];

// 360 기준 레이아웃: 스케치북은 (12, 122)에서 336×336
const SKETCH = { x: 12, y: 122, size: 336 };

async function decodeFirstFrame(buf: Buffer): Promise<ReturnType<ReturnType<typeof createCanvas>['getContext']>> {
  const decoded = await loadImage(buf);
  const ctx = createCanvas(decoded.width, decoded.height).getContext('2d');
  ctx.drawImage(decoded, 0, 0);
  return ctx;
}

describe('gif generation', () => {
  it('GIF89a 매직 바이트로 시작하는 공개식 GIF를 만든다', async () => {
    const buf = await revealToGif({
      players,
      steps: [
        { kind: 'PROMPT', authorId: 'u1', text: '강아지' },
        { kind: 'DRAW', authorId: 'u1', strokes: [sampleStroke] },
      ],
    });

    expect(buf.length).toBeGreaterThan(0);
    expect(buf.subarray(0, 6).toString('ascii')).toBe('GIF89a');
    const decoded = await loadImage(buf);
    expect(decoded.width).toBe(360);
  }, 15_000);

  it('첫 프레임은 원조자 앞말 단계라 스케치북이 비어 있다', async () => {
    const buf = await revealToGif({
      players,
      steps: [
        { kind: 'PROMPT', authorId: 'u1', text: '노랑' },
        {
          kind: 'DRAW',
          authorId: 'u1',
          strokes: [
            {
              id: 'fill',
              authorId: 'u1',
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
    // GIF 디코딩은 첫 프레임만 돌려준다 — 그림 재생 전이므로 페인트 영역도 아직 비어 있어야 한다
    const ctx = await decodeFirstFrame(buf);
    const center = SKETCH.x + SKETCH.size / 2;
    expect(Array.from(ctx.getImageData(center, SKETCH.y + SKETCH.size / 2, 1, 1).data)).toEqual([255, 255, 255, 255]);
  }, 15_000);

  it('맞히는 사람의 발표가 이어지면 프레임이 늘어난다', async () => {
    const ownerOnly = await revealToGif({
      players,
      steps: [
        { kind: 'PROMPT', authorId: 'u1', text: '강아지' },
        { kind: 'DRAW', authorId: 'u1', strokes: [sampleStroke] },
      ],
    });
    const withGuesser = await revealToGif({
      players,
      steps: [
        { kind: 'PROMPT', authorId: 'u1', text: '강아지' },
        { kind: 'DRAW', authorId: 'u1', strokes: [sampleStroke] },
        { kind: 'ANSWER', authorId: 'u2', text: '멍멍이' },
        { kind: 'DRAW', authorId: 'u2', strokes: [] },
      ],
    });

    expect(withGuesser.length).toBeGreaterThan(ownerOnly.length);
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
