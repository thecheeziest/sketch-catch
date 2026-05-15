import { CHARACTER_IDS as SHARED_CHARACTER_IDS, type CharacterId } from '@sketch-catch/shared';

export const CHARACTER_IDS = SHARED_CHARACTER_IDS;
export type { CharacterId };

// 캐릭터 PNG 경로 헬퍼 — 실 에셋 미존재 시 require가 throw하지 않도록 try-catch 래핑
// 에셋 추가 전까지는 null 반환 → 컴포넌트는 색 블록으로 폴백
export function getCharacterImageSource(_id: string): number | null {
  try {
    // 동적 require는 Metro에서 지원되지 않으므로 정적 매핑이 필요하지만,
    // 에셋 미존재 단계에서는 null로 통일 — 실 에셋 추가 시 이 함수를 매핑 테이블로 교체.
    return null;
  } catch {
    return null;
  }
}
