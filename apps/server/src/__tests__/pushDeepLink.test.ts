import { describe, expect, it } from 'vitest';
import { buildPushDeepLink, parsePushDeepLink } from '@sketch-catch/shared';

describe('push deep link', () => {
  it('초대·친구 링크를 만들고 다시 해석한다', () => {
    const invite = buildPushDeepLink({ kind: 'invite', roomCode: 'F657FD' });
    expect(invite).toBe('sketchcatch:///invite/F657FD');
    expect(parsePushDeepLink(invite)).toEqual({ kind: 'invite', roomCode: 'F657FD' });
    expect(parsePushDeepLink(buildPushDeepLink({ kind: 'friends' }))).toEqual({ kind: 'friends' });
  });

  it('호스트형 URL과 경로만 있는 형태도 같은 링크로 본다', () => {
    expect(parsePushDeepLink('sketchcatch://invite/F657FD')).toEqual({ kind: 'invite', roomCode: 'F657FD' });
    expect(parsePushDeepLink('/friends?from=push')).toEqual({ kind: 'friends' });
  });

  it('형식이 틀린 방 코드나 모르는 경로는 무시한다', () => {
    expect(parsePushDeepLink('sketchcatch:///invite/abc')).toBeNull();
    expect(parsePushDeepLink('sketchcatch:///invite')).toBeNull();
    expect(parsePushDeepLink('sketchcatch:///room/F657FD')).toBeNull();
    expect(parsePushDeepLink('/')).toBeNull();
  });
});
