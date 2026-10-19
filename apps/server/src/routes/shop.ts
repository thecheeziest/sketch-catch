import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import { equipSchema, purchaseSchema } from '@sketch-catch/shared';
import { authenticate } from '../middleware/authenticate.js';
import {
  AlreadyOwnedError,
  InsufficientCoinsError,
  ItemNotFoundError,
  ItemNotOwnedError,
  equipItem,
  purchaseItem,
} from '../services/coin.service.js';
import { toUserPrivate } from '../lib/userPrivate.js';
import { logger } from '../lib/logger.js';

function sendShopError(reply: FastifyReply, err: unknown, label: string) {
  if (err instanceof ItemNotFoundError) return reply.status(404).send({ error: err.code });
  if (err instanceof AlreadyOwnedError) return reply.status(409).send({ error: err.code });
  if (err instanceof InsufficientCoinsError) return reply.status(402).send({ error: err.code });
  if (err instanceof ItemNotOwnedError) return reply.status(403).send({ error: err.code });
  logger.error({ err }, `${label} failed`);
  return reply.status(500).send({ error: 'INTERNAL' });
}

export const shopRoutes: FastifyPluginAsync = async app => {
  // 구매 성공 시 갱신된 내 정보(잔액·보유·장착)를 돌려준다
  app.post('/shop/purchase', { preHandler: authenticate }, async (request, reply) => {
    const parsed = purchaseSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'INVALID_INPUT' });
    try {
      const user = await purchaseItem(request.userId!, parsed.data.itemId, parsed.data.equip);
      return reply.send(toUserPrivate(user));
    } catch (err) {
      return sendShopError(reply, err, 'POST /shop/purchase');
    }
  });

  app.patch('/me/equip', { preHandler: authenticate }, async (request, reply) => {
    const parsed = equipSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'INVALID_INPUT' });
    try {
      const user = await equipItem(request.userId!, parsed.data);
      return reply.send(toUserPrivate(user));
    } catch (err) {
      return sendShopError(reply, err, 'PATCH /me/equip');
    }
  });
};
