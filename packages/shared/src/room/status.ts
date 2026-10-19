import type { RoomStatus } from '../types/room.js';

// 게임이 진행 중인 상태 (대기실·시상식 제외) — 재입장 거부, 퇴장 라우팅, 연결 끊김 유예 판정에 공통으로 쓴다
export function isGameInProgressStatus(status: RoomStatus): boolean {
  return (
    status === 'MODE1_ROUND_START' ||
    status === 'MODE1_ROUND_END' ||
    status === 'MODE2_PROMPT_PHASE' ||
    status === 'MODE2_DRAW_PHASE' ||
    status === 'MODE2_ANSWER_PHASE' ||
    status === 'MODE2_REVIEW'
  );
}
