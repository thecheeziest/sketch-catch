// DEVELOPER.md §3 — User 모델 기반 클라이언트/서버 공통 표현
export type Provider = 'KAKAO' | 'APPLE';

export type UserPublic = {
  id: string;
  nickname: string;
  friendCode: string;
  characterId: string;
};

// 장착한 꾸미기 — null은 기본 모습
export type Cosmetics = {
  frameId: string | null;
  backgroundId: string | null;
  chatColorId: string | null;
};

export type UserPrivate = UserPublic &
  Cosmetics & {
    provider: Provider;
    createdAt: string; // ISO
    nicknameChangedAt: string | null;
    coins: number;
    ownedItemIds: string[]; // 보유 아이템 (캐릭터 포함)
  };

export type FriendStatus = 'ONLINE' | 'OFFLINE' | 'IN_GAME';

export type Friend = UserPublic & {
  status: FriendStatus;
};
