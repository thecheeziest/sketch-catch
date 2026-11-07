// 차단·신고 — 앱스토어 사용자 생성 콘텐츠 정책(신고·차단 수단) 대응

export type ReportReason = 'ABUSE' | 'SEXUAL' | 'SPAM' | 'OTHER';

// GET /blocks 항목 — 설정의 차단 목록에 보여 줄 공개 정보만
export type BlockedUser = {
  userId: string;
  nickname: string;
  friendCode: string;
  characterId: string;
  blockedAt: string; // ISO
};
