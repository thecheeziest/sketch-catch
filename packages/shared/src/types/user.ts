// DEVELOPER.md §3 — User 모델 기반 클라이언트/서버 공통 표현
export type Provider = 'KAKAO' | 'APPLE';

export type UserPublic = {
  id: string;
  nickname: string;
  friendCode: string;
  characterId: string;
};

export type UserPrivate = UserPublic & {
  provider: Provider;
  createdAt: string; // ISO
  nicknameChangedAt: string | null;
};

export type FriendStatus = 'ONLINE' | 'OFFLINE' | 'IN_GAME';

export type Friend = UserPublic & {
  status: FriendStatus;
};
