import { Expo, type ExpoPushMessage, type ExpoPushTicket } from 'expo-server-sdk';
import { prisma } from '../db/prisma.js';
import { redis } from '../db/redis.js';
import { logger } from '../lib/logger.js';

const expo = new Expo();

// DEVELOPER.md §10.4 — 동일 트리거 중복 발송 방지, TTL 1시간
const PUSH_DEDUPE_TTL_SEC = 3600;

export type PushNotif = {
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

// Redis SETNX 가드 — 첫 호출 true, TTL 내 중복 호출 false
export async function shouldSend(notificationId: string, ttlSec = PUSH_DEDUPE_TTL_SEC): Promise<boolean> {
  const result = await redis.set(`push:dedupe:${notificationId}`, '1', 'EX', ttlSec, 'NX');
  return result === 'OK';
}

// DEVELOPER.md §10.2 그대로 — 유효 토큰 필터 → 청크 → 발송
export async function sendPush(tokens: string[], notif: PushNotif): Promise<void> {
  const messages = tokens
    .filter((t) => Expo.isExpoPushToken(t))
    .map((to) => ({ to, sound: 'default' as const, title: notif.title, body: notif.body, data: notif.data }));
  if (messages.length === 0) return;

  const chunks = expo.chunkPushNotifications(messages);
  for (const chunk of chunks) {
    try {
      const tickets = await expo.sendPushNotificationsAsync(chunk);
      await handleTickets(chunk, tickets);
    } catch (err) {
      logger.error({ err }, 'sendPushNotificationsAsync failed');
    }
  }
}

// 티켓은 chunk와 같은 순서로 반환된다 — 실패 사유를 남기고 만료 토큰은 정리한다
async function handleTickets(chunk: ExpoPushMessage[], tickets: ExpoPushTicket[]): Promise<void> {
  for (const [index, ticket] of tickets.entries()) {
    if (ticket.status === 'ok') continue;

    const to = chunk[index]?.to;
    logger.warn({ to, message: ticket.message, error: ticket.details?.error }, 'push ticket error');

    if (ticket.details?.error === 'DeviceNotRegistered' && typeof to === 'string') {
      await prisma.user.updateMany({ where: { pushToken: to }, data: { pushToken: null } });
    }
  }
}
