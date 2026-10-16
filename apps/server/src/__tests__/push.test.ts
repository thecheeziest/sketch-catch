import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  isExpoPushToken: vi.fn(),
  chunkPushNotifications: vi.fn(),
  sendPushNotificationsAsync: vi.fn(),
}));

vi.mock('expo-server-sdk', () => ({
  Expo: class {
    static isExpoPushToken = mocks.isExpoPushToken;
    chunkPushNotifications = mocks.chunkPushNotifications;
    sendPushNotificationsAsync = mocks.sendPushNotificationsAsync;
  },
}));

vi.mock('../db/redis.js', () => ({
  redis: { set: vi.fn() },
}));

vi.mock('../db/prisma.js', () => ({
  prisma: { user: { updateMany: vi.fn() } },
}));

const { redis } = await import('../db/redis.js');
const { prisma } = await import('../db/prisma.js');
const { sendPush, shouldSend } = await import('../services/push.service.js');

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
