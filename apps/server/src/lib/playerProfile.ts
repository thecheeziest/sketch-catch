// 방 플레이어로 보여줄 유저 정보 — 꾸미기(테두리·배경·글자색)도 함께 실어 다른 참가자에게 보인다
export const PLAYER_PROFILE_SELECT = {
  nickname: true,
  characterId: true,
  friendCode: true,
  frameId: true,
  backgroundId: true,
  chatColorId: true,
} as const;

export type PlayerProfile = {
  nickname: string;
  characterId: string;
  friendCode: string;
  frameId: string | null;
  backgroundId: string | null;
  chatColorId: string | null;
};

export function toPlayerProfile(u: PlayerProfile): PlayerProfile {
  return {
    nickname: u.nickname,
    characterId: u.characterId,
    friendCode: u.friendCode,
    frameId: u.frameId,
    backgroundId: u.backgroundId,
    chatColorId: u.chatColorId,
  };
}

export const EMPTY_PROFILE: PlayerProfile = {
  nickname: '',
  characterId: '',
  friendCode: '',
  frameId: null,
  backgroundId: null,
  chatColorId: null,
};
