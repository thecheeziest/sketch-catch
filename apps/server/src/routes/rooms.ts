import type { FastifyPluginAsync } from 'fastify';
import { authenticate } from '../middleware/authenticate.js';
import { createRoomSchema, roomCodeSchema, SOCKET_NAMESPACE, SERVER_EVENT, type Category } from '@sketch-catch/shared';
import {
  createRoom,
  getRoomState,
  saveRoomState,
  assertJoinable,
  RoomFullError,
  RoomLockedError,
  WrongPasswordError,
} from '../services/rooms.service.js';
import { setPresence, setUserRoom } from '../db/redis.js';
import { broadcastPresenceUpdate } from '../socket/presence.namespace.js';
import { prisma } from '../db/prisma.js';
import { logger } from '../lib/logger.js';

export const roomsRoutes: FastifyPluginAsync = async (app) => {
  app.post('/rooms', { preHandler: authenticate }, async (req, reply) => {
    const parsed = createRoomSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'INVALID_INPUT' });

    const { mode, playerCountMax, roundCount, drawTimer, answerTimer, categories, title, locked } = parsed.data;

    try {
      const user = await prisma.user.findUnique({ where: { id: req.userId! } });
      if (!user) return reply.status(401).send({ error: 'USER_NOT_FOUND' });

      const defaultTitle = title ?? `${user.nickname}님의 방`;

      const { password } = parsed.data as { password?: string };
      const state = await createRoom({
        hostId: req.userId!,
        userIds: [req.userId!],
        config: { roundCount, drawTimer, answerTimer: answerTimer ?? 10, categories, playerCountMax },
        title: defaultTitle,
        locked,
        password,
        mode,
        userMeta: { [req.userId!]: { nickname: user.nickname, characterId: user.characterId } },
      });

      // 소켓 연결 전에 presence를 즉시 설정 — 이전 게임의 IN_GAME 상태를 덮어씀
      await Promise.all([
        setPresence(req.userId!, 'IN_LOBBY'),
        setUserRoom(req.userId!, state.code),
      ]);
      broadcastPresenceUpdate(req.userId!, 'IN_LOBBY');

      return reply.status(201).send({ code: state.code });
    } catch (err) {
      logger.error({ err }, 'POST /rooms failed');
      return reply.status(500).send({ error: 'INTERNAL' });
    }
  });

  app.patch('/rooms/:code', { preHandler: authenticate }, async (req, reply) => {
    const codeParsed = roomCodeSchema.safeParse((req.params as { code: string }).code);
    if (!codeParsed.success) return reply.status(400).send({ error: 'INVALID_CODE' });

    const state = await getRoomState(codeParsed.data);
    if (!state) return reply.status(404).send({ error: 'ROOM_NOT_FOUND' });
    if (state.hostId !== req.userId) return reply.status(403).send({ error: 'FORBIDDEN' });

    const body = req.body as Record<string, unknown>;
    if (typeof body.title === 'string') state.title = body.title.trim() || state.title;
    if (typeof body.locked === 'boolean') state.locked = body.locked;
    if (typeof body.playerCountMax === 'number') state.config.playerCountMax = body.playerCountMax;
    if (typeof body.roundCount === 'number') state.config.roundCount = body.roundCount;
    if (typeof body.drawTimer === 'number') state.config.drawTimer = body.drawTimer;
    if (Array.isArray(body.categories)) state.config.categories = body.categories as Category[];

    await saveRoomState(state);

    // 대기실 참가자 전체에게 변경된 room:state 브로드캐스트
    req.server.io.of(SOCKET_NAMESPACE).to(`room:${codeParsed.data}`).emit(SERVER_EVENT.ROOM_STATE, state);

    return reply.send(state);
  });

  app.get('/rooms/:code', { preHandler: authenticate }, async (req, reply) => {
    const codeParsed = roomCodeSchema.safeParse((req.params as { code: string }).code);
    if (!codeParsed.success) return reply.status(400).send({ error: 'INVALID_CODE' });

    const state = await getRoomState(codeParsed.data);
    if (!state) return reply.status(404).send({ error: 'ROOM_NOT_FOUND' });

    const { password } = (req.query as Record<string, string | undefined>);
    try {
      await assertJoinable(state, password);
    } catch (err) {
      if (err instanceof RoomFullError) return reply.status(409).send({ error: 'ROOM_FULL' });
      if (err instanceof RoomLockedError) return reply.status(403).send({ error: 'ROOM_LOCKED' });
      if (err instanceof WrongPasswordError) return reply.status(403).send({ error: 'WRONG_PASSWORD' });
      return reply.status(500).send({ error: 'INTERNAL' });
    }

    return reply.send(state);
  });
};
