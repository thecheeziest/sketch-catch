export type DrawStage = 'top' | 'bottom';

export type DrawSlot = {
  stage: DrawStage;
  // 캐릭터 중심 x, 발이 닿는 단상 윗면 y
  centerX: number;
  stageY: number;
  size: number;
  boxWidth: number;
};

export type DrawGroups = {
  safeIds: string[];
  // 추첨 없이 이미 꼴등으로 확정된 사람 (경계 점수보다 낮음)
  sureLoserIds: string[];
  candidateIds: string[];
  pickedIds: string[];
  survivorIds: string[];
};

export type DrawGeometry = {
  topStage: { x: number; y: number; width: number };
  bottomStage: { x: number; y: number; width: number };
};

const STAGE_INSET = { TOP: 24, BOTTOM: 16 } as const;
const BASE_SIZE = { top: 56, bottom: 68 } as const;
const MIN_SIZE = 28;
const MAX_BOX_WIDTH = 84;
export const DRAW_STAGE_HEIGHT = 36;
// 캐릭터 머리 위 닉네임·점수 영역 높이
export const DRAW_LABEL_HEIGHT = 34;

// 서버 판정 결과를 화면 그룹으로 나눈다 — 순서는 ranking 순서를 따른다
export function groupDrawPlayers(orderedIds: string[], candidateIds: string[], loserIds: string[]): DrawGroups {
  const candidates = new Set(candidateIds);
  const losers = new Set(loserIds);
  return {
    safeIds: orderedIds.filter(id => !candidates.has(id) && !losers.has(id)),
    sureLoserIds: orderedIds.filter(id => losers.has(id) && !candidates.has(id)),
    candidateIds: orderedIds.filter(id => candidates.has(id)),
    pickedIds: orderedIds.filter(id => candidates.has(id) && losers.has(id)),
    survivorIds: orderedIds.filter(id => candidates.has(id) && !losers.has(id)),
  };
}

export function getDrawGeometry(width: number, height: number): DrawGeometry {
  return {
    topStage: { x: STAGE_INSET.TOP, y: Math.round(height * 0.42), width: width - STAGE_INSET.TOP * 2 },
    bottomStage: { x: STAGE_INSET.BOTTOM, y: Math.round(height * 0.86), width: width - STAGE_INSET.BOTTOM * 2 },
  };
}

function placeRow(ids: string[], stage: DrawStage, geometry: DrawGeometry, slots: Map<string, DrawSlot>): void {
  const rect = stage === 'top' ? geometry.topStage : geometry.bottomStage;
  const slotWidth = rect.width / Math.max(ids.length, 1);
  const size = Math.max(MIN_SIZE, Math.min(BASE_SIZE[stage], slotWidth - 14));
  ids.forEach((id, i) => {
    slots.set(id, {
      stage,
      centerX: rect.x + slotWidth * (i + 0.5),
      stageY: rect.y,
      size,
      boxWidth: Math.min(MAX_BOX_WIDTH, slotWidth),
    });
  });
}

// 생존자 이동 전(promoted=false)·후의 캐릭터 자리
export function layoutDrawSlots(groups: DrawGroups, geometry: DrawGeometry, promoted: boolean): Map<string, DrawSlot> {
  const slots = new Map<string, DrawSlot>();
  if (promoted) {
    placeRow([...groups.safeIds, ...groups.survivorIds], 'top', geometry, slots);
    placeRow([...groups.sureLoserIds, ...groups.pickedIds], 'bottom', geometry, slots);
  } else {
    placeRow(groups.safeIds, 'top', geometry, slots);
    placeRow([...groups.sureLoserIds, ...groups.candidateIds], 'bottom', geometry, slots);
  }
  return slots;
}
