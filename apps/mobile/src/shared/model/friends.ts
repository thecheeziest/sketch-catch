export type PresenceStatus = 'ONLINE' | 'OFFLINE' | 'IN_LOBBY' | 'IN_GAME';

export type FriendRoom = {
  code: string;
  title: string;
  playerCount: number;
  playerCountMax: number;
  locked: boolean;
  hasPassword: boolean;
  joinable: boolean;
};

export type Friend = {
  friendshipId: string;
  userId: string;
  nickname: string;
  friendCode: string;
  characterId: string;
  presenceStatus: PresenceStatus;
  room?: FriendRoom;
};

export type FriendRequestSender = {
  id: string;
  nickname: string;
  friendCode: string;
  characterId: string;
};

export type FriendRequest = {
  id: string;
  sender: FriendRequestSender;
  createdAt: string;
};

export type SentRequest = {
  id: string;
  receiver: FriendRequestSender;
  createdAt: string;
};
