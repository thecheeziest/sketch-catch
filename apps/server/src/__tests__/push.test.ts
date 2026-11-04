import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  isExpoPushToken: vi.fn(),
  chunkPushNotifications: vi.fn(),
  sendPushNotificationsAsync: vi.fn(),
  chunkPushNotificationReceiptIds: vi.fn(),
  getPushNotificationReceiptsAsync: vi.fn(),
}));

vi.mock('expo-server-sdk', () => ({
  Expo: class {
    static isExpoPushToken = mocks.isExpoPushToken;
    chunkPushNotifications = mocks.chunkPushNotifications;
    sendPushNotificationsAsync = mocks.sendPushNotificationsAsync;
    chunkPushNotificationReceiptIds = mocks.chunkPushNotificationReceiptIds;
    getPushNotificationReceiptsAsync = mocks.getPushNotificationReceiptsAsync;
  },
}));

vi.mock('../lib/logger.js', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock('../db/redis.js', () => ({
  redis: { set: vi.fn() },
}));

vi.mock('../db/prisma.js', () => ({
  prisma: { user: { updateMany: vi.fn() } },
}));

const { redis } = await import('../db/redis.js');
const { prisma } = await import('../db/prisma.js');
const { logger } = await import('../lib/logger.js');
const { sendPush, shouldSend, checkReceipts, RECEIPT_CHECK_DELAY_MS } = await import('../services/push.service.js');

describe('sendPush', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('유효 토큰 하나 + 무효 토큰 하나 중 유효 토큰만 sendPushNotificationsAsync로 전달', async () => {
    mocks.isExpoPushToken.mockImplementation((t: string) => t === 'ExponentPushToken[valid]');
    mocks.chunkPushNotifications.mockImplementation((msgs: unknown[]) => [msgs]);
    mocks.sendPushNotificationsAsync.mockResolvedValue([]);

    await sendPush(['ExponentPushToken[valid]', 'invalid-token'], { title: '제목', body: '본문' });

    expect(mocks.chunkPushNotifications).toHaveBeenCalledWith([
      expect.objectContaining({ to: 'ExponentPushToken[valid]' }),
    ]);
    expect(mocks.chunkPushNotifications).toHaveBeenCalledWith(
      expect.not.arrayContaining([expect.objectContaining({ to: 'invalid-token' })])
    );
    expect(mocks.sendPushNotificationsAsync).toHaveBeenCalledTimes(1);
  });

  it('유효 토큰이 하나도 없으면 발송을 시도하지 않음', async () => {
    mocks.isExpoPushToken.mockReturnValue(false);

    await sendPush(['invalid-1', 'invalid-2'], { title: '제목', body: '본문' });

    expect(mocks.chunkPushNotifications).not.toHaveBeenCalled();
    expect(mocks.sendPushNotificationsAsync).not.toHaveBeenCalled();
  });
});

describe('sendPush 티켓 처리', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isExpoPushToken.mockReturnValue(true);
    mocks.chunkPushNotifications.mockImplementation((msgs: unknown[]) => [msgs]);
  });

  it('DeviceNotRegistered 티켓이면 해당 토큰을 null로 정리', async () => {
    mocks.sendPushNotificationsAsync.mockResolvedValue([
      { status: 'error', message: 'gone', details: { error: 'DeviceNotRegistered' } },
    ]);

    await sendPush(['ExponentPushToken[dead]'], { title: '제목', body: '본문' });

    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: { pushToken: 'ExponentPushToken[dead]' },
      data: { pushToken: null },
    });
  });

  it('그 외 에러 티켓은 토큰을 건드리지 않음', async () => {
    mocks.sendPushNotificationsAsync.mockResolvedValue([
      { status: 'error', message: 'bad creds', details: { error: 'InvalidCredentials' } },
    ]);

    await sendPush(['ExponentPushToken[a]'], { title: '제목', body: '본문' });

    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });
});

describe('sendPush 메시지 옵션', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isExpoPushToken.mockReturnValue(true);
    mocks.chunkPushNotifications.mockImplementation((msgs: unknown[]) => [msgs]);
    mocks.sendPushNotificationsAsync.mockResolvedValue([]);
  });

  it('Android 즉시 전달을 위해 high 우선순위와 default 채널로 보낸다', async () => {
    await sendPush(['ExponentPushToken[a]'], { title: '제목', body: '본문' });

    expect(mocks.chunkPushNotifications).toHaveBeenCalledWith([
      expect.objectContaining({ priority: 'high', channelId: 'default' }),
    ]);
  });
});

describe('sendPush receipt 예약', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mocks.isExpoPushToken.mockReturnValue(true);
    mocks.chunkPushNotifications.mockImplementation((msgs: unknown[]) => [msgs]);
    mocks.chunkPushNotificationReceiptIds.mockImplementation((ids: string[]) => [ids]);
    mocks.getPushNotificationReceiptsAsync.mockResolvedValue({});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('성공 티켓의 id로 지연 후 receipt를 조회한다', async () => {
    mocks.sendPushNotificationsAsync.mockResolvedValue([{ status: 'ok', id: 'r1' }]);

    await sendPush(['ExponentPushToken[a]'], { title: '제목', body: '본문' });
    expect(mocks.getPushNotificationReceiptsAsync).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(RECEIPT_CHECK_DELAY_MS);
    expect(mocks.getPushNotificationReceiptsAsync).toHaveBeenCalledWith(['r1']);
  });

  it('성공 티켓이 없으면 receipt 조회를 예약하지 않는다', async () => {
    mocks.sendPushNotificationsAsync.mockResolvedValue([
      { status: 'error', message: 'bad creds', details: { error: 'InvalidCredentials' } },
    ]);

    await sendPush(['ExponentPushToken[a]'], { title: '제목', body: '본문' });
    await vi.advanceTimersByTimeAsync(RECEIPT_CHECK_DELAY_MS);

    expect(mocks.getPushNotificationReceiptsAsync).not.toHaveBeenCalled();
  });
});

describe('checkReceipts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.chunkPushNotificationReceiptIds.mockImplementation((ids: string[]) => [ids]);
  });

  it('InvalidCredentials receipt는 경고 로그를 남기고 토큰은 건드리지 않는다', async () => {
    mocks.getPushNotificationReceiptsAsync.mockResolvedValue({
      r1: {
        status: 'error',
        message: 'no creds',
        details: { error: 'InvalidCredentials', expoPushToken: 'ExponentPushToken[a]' },
      },
    });

    await checkReceipts(['r1']);

    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ receiptId: 'r1', error: 'InvalidCredentials' }),
      'push receipt error',
    );
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });

  it('DeviceNotRegistered receipt면 해당 토큰을 null로 정리', async () => {
    mocks.getPushNotificationReceiptsAsync.mockResolvedValue({
      r1: {
        status: 'error',
        message: 'gone',
        details: { error: 'DeviceNotRegistered', expoPushToken: 'ExponentPushToken[dead]' },
      },
      r2: { status: 'ok' },
    });

    await checkReceipts(['r1', 'r2']);

    expect(prisma.user.updateMany).toHaveBeenCalledTimes(1);
    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: { pushToken: 'ExponentPushToken[dead]' },
      data: { pushToken: null },
    });
  });

  it('receipt 조회가 실패해도 예외를 던지지 않는다', async () => {
    mocks.getPushNotificationReceiptsAsync.mockRejectedValue(new Error('network'));

    await expect(checkReceipts(['r1'])).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalled();
  });
});

describe('shouldSend', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('첫 호출 → true (SETNX 성공)', async () => {
    vi.mocked(redis.set).mockResolvedValue('OK' as any);

    await expect(shouldSend('notif1')).resolves.toBe(true);
    expect(redis.set).toHaveBeenCalledWith('push:dedupe:notif1', '1', 'EX', 3600, 'NX');
  });

  it('TTL 내 중복 호출 → false (SETNX 실패)', async () => {
    vi.mocked(redis.set).mockResolvedValue(null);

    await expect(shouldSend('notif1')).resolves.toBe(false);
  });
});
