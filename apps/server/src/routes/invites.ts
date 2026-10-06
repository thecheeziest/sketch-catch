import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { roomCodeSchema } from '@sketch-catch/shared';
import { authenticate } from '../middleware/authenticate.js';
import { getRoomState } from '../services/rooms.service.js';
import { getPresence } from '../db/redis.js';
import { sendPush, shouldSend } from '../services/push.service.js';
import { prisma } from '../db/prisma.js';
import { logger } from '../lib/logger.js';

const inviteBodySchema = z.object({ target: z.string().min(1) });

export const invitesRoutes: FastifyPluginAsync = async (app) => {
  app.post('/rooms/:code/invite', { preHandler: authenticate }, async (req, reply) => {
    const codeParsed = roomCodeSchema.safeParse((req.params as { code: string }).code);
    if (!codeParsed.success) return reply.status(400).send({ error: 'INVALID_CODE' });

    const bodyParsed = inviteBodySchema.safeParse(req.body);
    if (!bodyParsed.success) return reply.status(400).send({ error: 'INVALID_INPUT' });

    try {
      const state = await getRoomState(codeParsed.data);
      if (!state) return reply.status(404).send({ error: 'ROOM_NOT_FOUND' });

      // D-12: 서버가 진실의 출처 — 발신자 측 LOBBY 상태 재검증 (클라이언트 버튼 비활성화만 신뢰하지 않음)
      if (state.status !== 'LOBBY') {
        return reply.status(403).send({ error: 'GAME_IN_PROGRESS' });
      }

      // 이미 대기실·게임에 있는 유저는 초대하지 않는다 — 초대를 받아도 반응할 수 없고 방 이동 시 기존 게임이 깨진다
      const targetPresence = await getPresence(bodyParsed.data.target);
      if (targetPresence === 'IN_LOBBY' || targetPresence === 'IN_GAME') {
        return reply.status(409).send({ error: 'TARGET_BUSY' });
      }

      const target = await prisma.user.findUnique({
        where: { id: bodyParsed.data.target },
        select: { pushToken: true },
      });
      if (!target) return reply.status(404).send({ error: 'USER_NOT_FOUND' });
      if (!target.pushToken) return reply.send({ ok: true });

      const notificationId = `game-invite:${req.userId!}:${bodyParsed.data.target}:${state.code}`;
      if (await shouldSend(notificationId)) {
        const inviter = await prisma.user.findUnique({ where: { id: req.userId! }, select: { nickname: true } });
        await sendPush([target.pushToken], {
          title: '게임 초대',
          body: `${inviter?.nickname ?? '친구'}님이 게임에 초대했어요.`,
          data: { roomCode: state.code },
        });
      }

      return reply.send({ ok: true });
    } catch (err) {
      logger.error({ err }, 'POST /rooms/:code/invite failed');
      return reply.status(500).send({ error: 'INTERNAL' });
    }
  });
};
