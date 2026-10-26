import type { FastifyPluginAsync } from 'fastify';
import { authenticate } from '../middleware/authenticate.js';
import { getReplayGif, getReplayMeta } from '../services/replay.service.js';

// GIF-02: 시트 참여자만 GIF를 조회/저장할 수 있음. 비참여자는 403으로 거부한다.
export const replaysRoutes: FastifyPluginAsync = async app => {
  app.get('/replays/:sheetId/gif', { preHandler: authenticate }, async (req, reply) => {
    const { sheetId } = req.params as { sheetId: string };

    const meta = await getReplayMeta(sheetId);
    if (!meta) return reply.status(404).send({ error: 'REPLAY_NOT_FOUND' });
    if (!meta.participantIds.includes(req.userId!)) return reply.status(403).send({ error: 'FORBIDDEN' });

    // 저장을 누른 시점에 만든다 (D-10) — 같은 시트의 동시 요청은 한 번만 렌더링된다
    const buf = await getReplayGif(sheetId);
    if (!buf) return reply.status(404).send({ error: 'REPLAY_EXPIRED' });

    return reply.header('content-type', 'image/gif').send(buf);
  });
};
