import type { FastifyPluginAsync } from 'fastify';
import type { RoomPreview } from '@sketch-catch/shared';
import { authenticate } from '../middleware/authenticate.js';
import {
  createRoomSchema,
  isPenaltyLoserCountValid,
  roomCategoriesSchema,
  roomCodeSchema,
  roomPasswordSchema,
  roomPenaltySchema,
  SOCKET_NAMESPACE,
  SERVER_EVENT,
} from '@sketch-catch/shared';
import { isPenaltyTextClean } from '../services/penalty.js';
import {
  createRoom,
  getRoomState,
  saveRoomState,
  assertJoinable,
  listRooms,
  getRoomPassword,
  setRoomPassword,
  clearRoomPassword,
  RoomFullError,
  RoomLockedError,
  WrongPasswordError,
} from '../services/rooms.service.js';
import { toPlayerProfile } from '../lib/playerProfile.js';
import { getBlockRelatedIds, hasBlockedMember } from '../services/moderation.service.js';
import { getUserRoom, setPresence, setUserRoom } from '../db/redis.js';
import { runInRoom } from '../services/roomQueue.js';
import { countSeatedPlayers } from '../services/roomRules.js';
import { broadcastPresenceUpdate } from '../socket/presence.namespace.js';
import { prisma } from '../db/prisma.js';
import { logger } from '../lib/logger.js';
import { canUseReviewRoom } from '../services/reviewRooms.js';
import { destroyRoom } from '../socket/handlers/award.js';

export const roomsRoutes: FastifyPluginAsync = async (app) => {
  app.post('/rooms', { preHandler: authenticate }, async (req, reply) => {
    const parsed = createRoomSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'INVALID_INPUT' });
    if (parsed.data.review && !canUseReviewRoom(req.userId!)) {
      return reply.status(403).send({ error: 'FORBIDDEN' });
    }

    const { mode, playerCountMax, roundCount, drawTimer, answerTimer, categories, title, locked, password, penalty } =
      parsed.data;
    if (penalty && !isPenaltyTextClean(penalty.text)) return reply.status(400).send({ error: 'PROFANE_PENALTY' });

    try {
      return await runInRoom(`create:${req.userId!}`, async () => {
        const user = await prisma.user.findUnique({ where: { id: req.userId! } });
        if (!user) return reply.status(401).send({ error: 'USER_NOT_FOUND' });

        const defaultTitle = title ?? `${user.nickname}님의 방`;
        if (parsed.data.review) {
          const previousCode = await getUserRoom(req.userId!);
          if (previousCode) {
            await runInRoom(previousCode, async () => {
              const previous = await getRoomState(previousCode);
              if (previous?.reviewOwnerId === req.userId) await destroyRoom(previousCode);
            });
          }
        }

        const state = await createRoom({
          hostId: req.userId!,
          reviewOwnerId: parsed.data.review ? req.userId : undefined,
          userIds: [req.userId!],
          config: parsed.data.review
            ? { roundCount: 1, drawTimer: 40, answerTimer: 15, categories: ['ANIMAL'], playerCountMax: 3 }
            : { roundCount, drawTimer, answerTimer: answerTimer ?? 10, categories, playerCountMax, penalty },
          title: parsed.data.review ? '봇 2명과 체험하기' : defaultTitle,
          locked,
          password,
          mode,
          userMeta: {
            [req.userId!]: toPlayerProfile(user),
          },
        });

        // 소켓 연결 전에 presence를 즉시 설정
        await Promise.all([setPresence(req.userId!, 'IN_LOBBY'), setUserRoom(req.userId!, state.code)]);
        broadcastPresenceUpdate(req.userId!, 'IN_LOBBY');

        return reply.status(201).send({ code: state.code });
      });
    } catch (err) {
      logger.error({ err }, 'POST /rooms failed');
      return reply.status(500).send({ error: 'INTERNAL' });
    }
  });

  app.patch('/rooms/:code', { preHandler: authenticate }, async (req, reply) => {
    const codeParsed = roomCodeSchema.safeParse((req.params as { code: string }).code);
    if (!codeParsed.success) return reply.status(400).send({ error: 'INVALID_CODE' });

    const code = codeParsed.data;
    // 소켓 이벤트·타이머와 같은 방 작업 줄에서 처리 — 게임 시작과 설정 변경이 엇갈리지 않도록
    return runInRoom(code, async () => {
      const state = await getRoomState(code);
      if (!state) return reply.status(404).send({ error: 'ROOM_NOT_FOUND' });
      if (state.hostId !== req.userId) return reply.status(403).send({ error: 'FORBIDDEN' });
      if (state.reviewOwnerId) return reply.status(403).send({ error: 'REVIEW_ROOM_FIXED' });
      // 진행 중인 게임의 설정(라운드 수·타이머 등)이 바뀌면 진행 로직이 깨지므로 대기실에서만 허용
      if (state.status !== 'LOBBY') return reply.status(409).send({ error: 'GAME_IN_PROGRESS' });

      const body = req.body as Record<string, unknown>;
      // 카테고리를 전부 빼면 제시어를 뽑을 수 없다 — 1개 이상, 정의된 값만 허용
      const categories = body.categories === undefined ? undefined : roomCategoriesSchema.safeParse(body.categories);
      if (categories && !categories.success) return reply.status(400).send({ error: 'INVALID_INPUT' });
      // 벌칙: 객체 = 켜기/수정, null = 끄기, 미전달 = 유지
      const penalty = body.penalty == null ? undefined : roomPenaltySchema.safeParse(body.penalty);
      if (penalty && !penalty.success) return reply.status(400).send({ error: 'INVALID_INPUT' });
      if (penalty?.success && state.mode !== 1) return reply.status(400).send({ error: 'INVALID_INPUT' });
      if (penalty?.success && !isPenaltyTextClean(penalty.data.text)) {
        return reply.status(400).send({ error: 'PROFANE_PENALTY' });
      }
      const nextPenalty = (() => {
        if (body.penalty === null) return undefined;
        if (penalty?.success) return penalty.data;
        return state.config.penalty;
      })();
      const nextPlayerCountMax =
        typeof body.playerCountMax === 'number' ? body.playerCountMax : state.config.playerCountMax;
      if (nextPenalty && !isPenaltyLoserCountValid(nextPenalty.loserCount, nextPlayerCountMax)) {
        return reply.status(400).send({ error: 'INVALID_INPUT' });
      }

      // 잠금 방은 비밀번호가 반드시 있어야 한다 — 새로 잠그면 비밀번호 필수, 이미 잠긴 방은 비우면 기존 비밀번호 유지
      const password = body.password === undefined ? undefined : roomPasswordSchema.safeParse(body.password);
      if (password && !password.success) return reply.status(400).send({ error: 'INVALID_INPUT' });
      const nextLocked = typeof body.locked === 'boolean' ? body.locked : (state.locked ?? false);
      if (nextLocked && !password && (await getRoomPassword(code)) === null) {
        return reply.status(400).send({ error: 'INVALID_INPUT' });
      }

      if (nextLocked && password) await setRoomPassword(code, password.data);
      if (state.locked && !nextLocked) await clearRoomPassword(code);

      if (typeof body.title === 'string') state.title = body.title.trim() || state.title;
      if (typeof body.locked === 'boolean') state.locked = body.locked;
      if (typeof body.playerCountMax === 'number') state.config.playerCountMax = body.playerCountMax;
      if (typeof body.roundCount === 'number') state.config.roundCount = body.roundCount;
      if (typeof body.drawTimer === 'number') state.config.drawTimer = body.drawTimer;
      if (categories?.success) state.config.categories = categories.data;
      if (nextPenalty) state.config.penalty = nextPenalty;
      else delete state.config.penalty;

      await saveRoomState(state);

      // 대기실 참가자 전체에게 변경된 room:state 브로드캐스트
      req.server.io.of(SOCKET_NAMESPACE).to(`room:${code}`).emit(SERVER_EVENT.ROOM_STATE, state);

      return reply.send(state);
    });
  });

  // 초대 푸시를 누른 사람에게 입장 확인 전 방 제목·상태를 보여 준다 — 초대 입장은 비밀번호를 묻지 않으므로 잠금 검사도 하지 않는다
  app.get('/rooms/:code/preview', { preHandler: authenticate }, async (req, reply) => {
    const codeParsed = roomCodeSchema.safeParse((req.params as { code: string }).code);
    if (!codeParsed.success) return reply.status(400).send({ error: 'INVALID_CODE' });

    const state = await getRoomState(codeParsed.data);
    if (!state) return reply.status(404).send({ error: 'ROOM_NOT_FOUND' });
    if (state.reviewOwnerId && state.reviewOwnerId !== req.userId) {
      return reply.status(404).send({ error: 'ROOM_NOT_FOUND' });
    }
    // 차단 관계인 사람이 있는 방은 초대로도 들어갈 수 없다 — 차단 사실은 드러내지 않는다
    if (hasBlockedMember(state, await getBlockRelatedIds(req.userId!))) {
      return reply.status(403).send({ error: 'ROOM_UNAVAILABLE' });
    }

    const preview: RoomPreview = {
      code: state.code,
      title: state.title ?? '게임 방',
      status: state.status,
      full: countSeatedPlayers(state) >= state.config.playerCountMax,
    };
    return reply.send(preview);
  });

  app.get('/rooms', { preHandler: authenticate }, async (req, reply) => {
    try {
      return reply.send(await listRooms(await getBlockRelatedIds(req.userId!)));
    } catch (err) {
      logger.error({ err }, 'GET /rooms failed');
      return reply.status(500).send({ error: 'INTERNAL' });
    }
  });

  app.get('/rooms/:code', { preHandler: authenticate }, async (req, reply) => {
    const codeParsed = roomCodeSchema.safeParse((req.params as { code: string }).code);
    if (!codeParsed.success) return reply.status(400).send({ error: 'INVALID_CODE' });

    const state = await getRoomState(codeParsed.data);
    if (!state) return reply.status(404).send({ error: 'ROOM_NOT_FOUND' });
    if (state.reviewOwnerId && state.reviewOwnerId !== req.userId) {
      return reply.status(404).send({ error: 'ROOM_NOT_FOUND' });
    }
    // 진행 중·시상식 중인 방은 입장 불가 — 소켓 입장 단계에서도 거부하지만 화면 이동 전에 미리 알린다
    if (state.status !== 'LOBBY') return reply.status(409).send({ error: 'GAME_IN_PROGRESS' });
    if (hasBlockedMember(state, await getBlockRelatedIds(req.userId!))) {
      return reply.status(403).send({ error: 'ROOM_UNAVAILABLE' });
    }

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
