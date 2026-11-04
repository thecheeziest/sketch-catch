import { Expo, type ExpoPushMessage, type ExpoPushReceiptId, type ExpoPushTicket } from 'expo-server-sdk';
import { prisma } from '../db/prisma.js';
import { redis } from '../db/redis.js';
import { logger } from '../lib/logger.js';

const expo = new Expo();

// DEVELOPER.md §10.4 — 동일 트리거 중복 발송 방지, TTL 1시간
const PUSH_DEDUPE_TTL_SEC = 3600;

// 실제 전달 결과(receipt)는 발송 직후에는 없다 — 진단용으로 빨리 보려고 1분 뒤 조회하고, 그때 없는 receipt는 건너뛴다
export const RECEIPT_CHECK_DELAY_MS = 60_000;

// 앱이 만든 MAX 중요도 채널 — registerForPushNotificationsAsync의 채널 id와 같아야 한다
const ANDROID_CHANNEL_ID = 'default';

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
  const messages: ExpoPushMessage[] = tokens
    .filter(t => Expo.isExpoPushToken(t))
    .map(to => ({
      to,
      sound: 'default',
      // Android 절전(Doze) 중에도 바로 전달되고 헤드업 배너가 뜨도록 높은 우선순위 + MAX 채널로 보낸다
      priority: 'high',
      channelId: ANDROID_CHANNEL_ID,
      title: notif.title,
      body: notif.body,
      data: notif.data,
    }));
  if (messages.length === 0) return;

  const receiptIds: ExpoPushReceiptId[] = [];
  const chunks = expo.chunkPushNotifications(messages);
  for (const chunk of chunks) {
    try {
      const tickets = await expo.sendPushNotificationsAsync(chunk);
      receiptIds.push(...(await handleTickets(chunk, tickets)));
    } catch (err) {
      logger.error({ err }, 'sendPushNotificationsAsync failed');
    }
  }

  if (receiptIds.length > 0) scheduleReceiptCheck(receiptIds);
}

async function clearDeadToken(token: string): Promise<void> {
  await prisma.user.updateMany({ where: { pushToken: token }, data: { pushToken: null } });
}

// 티켓은 chunk와 같은 순서로 반환된다 — 실패 사유를 남기고 만료 토큰은 정리한다. 성공 티켓의 receipt id를 돌려준다
async function handleTickets(chunk: ExpoPushMessage[], tickets: ExpoPushTicket[]): Promise<ExpoPushReceiptId[]> {
  const receiptIds: ExpoPushReceiptId[] = [];
  for (const [index, ticket] of tickets.entries()) {
    if (ticket.status === 'ok') {
      receiptIds.push(ticket.id);
      continue;
    }

    const to = chunk[index]?.to;
    logger.warn({ to, message: ticket.message, error: ticket.details?.error }, 'push ticket error');

    if (ticket.details?.error === 'DeviceNotRegistered' && typeof to === 'string') {
      await clearDeadToken(to);
    }
  }
  return receiptIds;
}

// 서버 종료를 붙잡지 않도록 unref — 재시작으로 조회를 놓쳐도 발송 자체에는 영향이 없다
function scheduleReceiptCheck(receiptIds: ExpoPushReceiptId[]): void {
  setTimeout(() => {
    checkReceipts(receiptIds).catch(err => logger.error({ err }, 'push receipt check failed'));
  }, RECEIPT_CHECK_DELAY_MS).unref();
}

// APNs·FCM 자격증명 누락(InvalidCredentials) 같은 실제 전달 실패는 ticket이 아니라 receipt에만 나온다
export async function checkReceipts(receiptIds: ExpoPushReceiptId[]): Promise<void> {
  for (const idChunk of expo.chunkPushNotificationReceiptIds(receiptIds)) {
    try {
      const receipts = await expo.getPushNotificationReceiptsAsync(idChunk);
      for (const [receiptId, receipt] of Object.entries(receipts)) {
        if (receipt.status === 'ok') continue;

        const error = receipt.details?.error;
        const token = receipt.details?.expoPushToken;
        logger.warn({ receiptId, to: token, message: receipt.message, error }, 'push receipt error');

        if (error === 'DeviceNotRegistered' && token) {
          await clearDeadToken(token);
        }
      }
    } catch (err) {
      logger.error({ err }, 'getPushNotificationReceiptsAsync failed');
    }
  }
}
