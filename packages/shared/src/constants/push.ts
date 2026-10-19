// 푸시 알림 data.type — 앱이 탭/수신 시 어떤 화면·쿼리를 갱신할지 구분한다
export const PUSH_TYPE = {
  FRIEND_REQUEST: 'FRIEND_REQUEST',
  FRIEND_ACCEPT: 'FRIEND_ACCEPT',
  GAME_INVITE: 'GAME_INVITE',
} as const;

export type PushType = (typeof PUSH_TYPE)[keyof typeof PUSH_TYPE];

// 같은 친구를 같은 방에 다시 초대할 수 있기까지의 대기 시간 (서버 중복 발송 방지 TTL과 앱 버튼 쿨다운 공용)
export const INVITE_RESEND_COOLDOWN_SEC = 30;
