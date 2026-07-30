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

const { redis } = await import('../db/redis.js');
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
