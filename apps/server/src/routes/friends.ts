import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../middleware/authenticate.js';
import {
  sendFriendRequest, getFriends, getFriendRequests, getSentFriendRequests, respondToRequest, deleteFriend,
  InvalidFormatError, SelfRequestError, UserNotFoundError, AlreadyFriendsError, DuplicateRequestError,
  RequestNotFoundError, ForbiddenError,
} from '../services/friends.service.js';
import { logger } from '../lib/logger.js';

const sendRequestSchema = z.object({ target: z.string().refine((v) => v.includes('#'), { message: 'target must include #' }) });
const respondSchema = z.object({ action: z.enum(['ACCEPT', 'REJECT']) });

export const friendsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/friends', { preHandler: authenticate }, async (req, reply) => {
    const friends = await getFriends(req.userId!);
    return reply.send(friends);
  });

  app.post('/friends/requests', { preHandler: authenticate }, async (req, reply) => {
    const parsed = sendRequestSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'INVALID_FORMAT' });
    try {
      await sendFriendRequest(req.userId!, parsed.data.target);
      return reply.status(201).send({ ok: true });
    } catch (err) {
      if (err instanceof InvalidFormatError) return reply.status(400).send({ error: err.code });
      if (err instanceof SelfRequestError) return reply.status(400).send({ error: err.code });
      if (err instanceof UserNotFoundError) return reply.status(404).send({ error: err.code });
      if (err instanceof AlreadyFriendsError) return reply.status(409).send({ error: err.code });
      if (err instanceof DuplicateRequestError) return reply.status(409).send({ error: err.code });
      logger.error({ err }, 'POST /friends/requests failed');
      return reply.status(500).send({ error: 'INTERNAL' });
    }
  });

  app.get('/friends/requests', { preHandler: authenticate }, async (req, reply) => {
    const requests = await getFriendRequests(req.userId!);
    return reply.send(requests);
  });

  app.get('/friends/requests/sent', { preHandler: authenticate }, async (req, reply) => {
    const requests = await getSentFriendRequests(req.userId!);
    return reply.send(requests);
  });

  app.patch('/friends/requests/:id', { preHandler: authenticate }, async (req, reply) => {
    const parsed = respondSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'INVALID_INPUT' });
    const { id } = req.params as { id: string };
    try {
      await respondToRequest(req.userId!, id, parsed.data.action);
      return reply.send({ ok: true });
    } catch (err) {
      if (err instanceof RequestNotFoundError) return reply.status(404).send({ error: err.code });
      if (err instanceof ForbiddenError) return reply.status(403).send({ error: err.code });
      logger.error({ err }, 'PATCH /friends/requests/:id failed');
      return reply.status(500).send({ error: 'INTERNAL' });
    }
  });

  app.delete('/friends/:userId', { preHandler: authenticate }, async (req, reply) => {
    const { userId: friendId } = req.params as { userId: string };
    try {
      await deleteFriend(req.userId!, friendId);
      return reply.status(204).send();
    } catch (err) {
      if (err instanceof RequestNotFoundError) return reply.status(404).send({ error: 'NOT_FOUND' });
      logger.error({ err }, 'DELETE /friends/:userId failed');
      return reply.status(500).send({ error: 'INTERNAL' });
    }
  });
};
