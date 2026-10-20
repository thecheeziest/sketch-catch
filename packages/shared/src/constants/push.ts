import { roomCodeSchema } from '../schemas/room.js';

// 푸시 알림 data.type — 앱이 탭/수신 시 어떤 화면·쿼리를 갱신할지 구분한다
export const PUSH_TYPE = {
  FRIEND_REQUEST: 'FRIEND_REQUEST',
  FRIEND_ACCEPT: 'FRIEND_ACCEPT',
  GAME_INVITE: 'GAME_INVITE',
} as const;

export type PushType = (typeof PUSH_TYPE)[keyof typeof PUSH_TYPE];

// 같은 친구를 같은 방에 다시 초대할 수 있기까지의 대기 시간 (서버 중복 발송 방지 TTL과 앱 버튼 쿨다운 공용)
export const INVITE_RESEND_COOLDOWN_SEC = 30;

// 푸시를 눌렀을 때 이동할 곳 — data.url로 함께 보내고 앱이 직접 해석해 대기실·게임 중 가드를 거친다
// (라우터에 그대로 넘기면 /room/CODE가 입장 확인 없이 열리므로 실제 화면 경로와 분리한다)
export const APP_LINK_SCHEME = 'sketchcatch';

export type PushDeepLink = { kind: 'friends' } | { kind: 'invite'; roomCode: string };

export function buildPushDeepLink(link: PushDeepLink): string {
  const path = link.kind === 'invite' ? `invite/${encodeURIComponent(link.roomCode)}` : 'friends';
  return `${APP_LINK_SCHEME}:///${path}`;
}

// `sketchcatch:///invite/CODE`, `sketchcatch://invite/CODE`, `/invite/CODE` 모두 같은 링크로 본다
export function parsePushDeepLink(url: string): PushDeepLink | null {
  const withoutScheme = url.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '');
  const path = withoutScheme.split(/[?#]/)[0] ?? '';
  const segments = path.split('/').filter(Boolean);
  if (segments.length === 1 && segments[0] === 'friends') return { kind: 'friends' };
  if (segments.length === 2 && segments[0] === 'invite') {
    const roomCode = decodeURIComponent(segments[1]!);
    return roomCodeSchema.safeParse(roomCode).success ? { kind: 'invite', roomCode } : null;
  }
  return null;
}
