import { useRef, useState } from 'react';
import { isPenaltyLoserCountValid, PENALTY_PRESET, type RoomPenalty } from '@sketch-catch/shared';
import { ApiError } from '@/shared/api';

type Options = {
  playerCountMax: number;
  roundCount: number;
  drawTimer: number;
  setRoundCount: (value: number) => void;
  setDrawTimer: (value: number) => void;
};

/**
 * 방 생성·방 설정 공용 벌칙 입력 상태.
 * 켜면 스피디한 단판 프리셋(턴·타이머)을 적용하고, 끄면 켜기 전 값으로 되돌린다.
 */
export function usePenaltyForm({ playerCountMax, roundCount, drawTimer, setRoundCount, setDrawTimer }: Options) {
  const [enabled, setEnabled] = useState(false);
  const [loserCount, setLoserCount] = useState<1 | 2>(1);
  const [text, setText] = useState('');
  const beforePreset = useRef<{ roundCount: number; drawTimer: number } | null>(null);

  const canPickTwo = isPenaltyLoserCountValid(2, playerCountMax);
  // 최대 인원을 줄여 꼴찌 2명이 불가능해지면 1명으로 본다 (저장 시에도 이 값이 나간다)
  const effectiveLoserCount = canPickTwo ? loserCount : 1;
  const trimmedText = text.trim();
  const isValid = !enabled || trimmedText.length > 0;
  const penalty: RoomPenalty | null = enabled ? { loserCount: effectiveLoserCount, text: trimmedText } : null;

  const toggle = (next: boolean): void => {
    setEnabled(next);
    if (next) {
      beforePreset.current = { roundCount, drawTimer };
      setRoundCount(PENALTY_PRESET.roundCount);
      setDrawTimer(PENALTY_PRESET.drawTimer);
      return;
    }
    if (beforePreset.current) {
      setRoundCount(beforePreset.current.roundCount);
      setDrawTimer(beforePreset.current.drawTimer);
      beforePreset.current = null;
    }
  };

  // 방 설정 모달을 열 때 현재 방의 벌칙으로 맞춘다 (프리셋은 적용하지 않음)
  const reset = (initial?: RoomPenalty): void => {
    setEnabled(initial !== undefined);
    setLoserCount(initial?.loserCount ?? 1);
    setText(initial?.text ?? '');
    beforePreset.current = null;
  };

  return {
    enabled,
    loserCount: effectiveLoserCount,
    text,
    canPickTwo,
    isValid,
    penalty,
    toggle,
    reset,
    setLoserCount,
    setText,
  };
}

export type PenaltyForm = ReturnType<typeof usePenaltyForm>;

// 방 생성·설정 저장 실패 안내 — 벌칙 내용 비속어 거부는 따로 알린다
export function getRoomSaveErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.code === 'PROFANE_PENALTY') return '벌칙 내용에 쓸 수 없는 말이 있어요!';
  return fallback;
}
