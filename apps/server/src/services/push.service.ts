import { Expo } from 'expo-server-sdk';
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
export async function shouldSend(notificationId: string): Promise<boolean> {
  const result = await redis.set(`push:dedupe:${notificationId}`, '1', 'EX', PUSH_DEDUPE_TTL_SEC, 'NX');
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
      await expo.sendPushNotificationsAsync(chunk);
    } catch (err) {
      logger.error({ err }, 'sendPushNotificationsAsync failed');
    }
  }
}
