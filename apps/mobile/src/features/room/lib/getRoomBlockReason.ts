import type { RoomListItem } from '@sketch-catch/shared';

// 방 찾기 목록에서 바로 입장할 수 없는 이유 — null이면 입장 시도 가능
export function getRoomBlockReason(room: RoomListItem): string | null {
  if (room.status === 'PLAYING') return '게임이 진행 중인 방이에요!';
  if (room.inviteOnly) return '초대로만 들어갈 수 있는 방이에요!';
  if (room.playerCount >= room.playerCountMax) return '방이 꽉 찼어요! 다른 방을 찾아볼까요?';
  return null;
}
