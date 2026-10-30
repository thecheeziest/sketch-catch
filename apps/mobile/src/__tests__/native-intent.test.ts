import { beforeEach, describe, expect, it, vi } from 'vitest';
import { redirectSystemPath } from '@/../app/+native-intent';
import { openPushDeepLink } from '@/features/push/lib/openPushDeepLink';

vi.mock('@/features/push/lib/openPushDeepLink', () => ({ openPushDeepLink: vi.fn() }));

beforeEach(() => vi.clearAllMocks());

describe('외부 링크 라우팅', () => {
  it.each([
    'kakao4ac106e05b38f8ae3856df1ffe534420://oauth?code=test-code',
    'kakao4ac106e05b38f8ae3856df1ffe534420://oauth?error=access_denied',
    'sketchcatch://oauth?code=test-code',
    'sketchcatch:///oauth?code=test-code',
    '/oauth?code=test-code',
  ])('인증 콜백은 화면 이동 없이 SDK에서 처리한다: %s', path => {
    expect(redirectSystemPath({ path, initial: false })).toBeNull();
    expect(redirectSystemPath({ path, initial: true })).toBe('/');
    expect(openPushDeepLink).not.toHaveBeenCalled();
  });

  it.each([
    ['sketchcatch:///invite/ABC123', { kind: 'invite', roomCode: 'ABC123' }],
    ['sketchcatch://friends', { kind: 'friends' }],
  ])('초대·친구 링크는 기존 대기 흐름으로 전달한다: %s', (path, link) => {
    expect(redirectSystemPath({ path, initial: false })).toBeNull();
    expect(openPushDeepLink).toHaveBeenCalledWith(link);
    expect(redirectSystemPath({ path, initial: true })).toBe('/');
  });

  it.each(['/settings', 'sketchcatch://oauth/other', 'https://example.com/oauth?code=test-code'])(
    '다른 경로는 그대로 전달한다: %s',
    path => {
      expect(redirectSystemPath({ path, initial: false })).toBe(path);
      expect(openPushDeepLink).not.toHaveBeenCalled();
    },
  );
});
