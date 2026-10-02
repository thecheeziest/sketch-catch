import React from 'react';
import { View } from 'dripsy';
import { spacing } from '@/shared/config';
import { Button } from '@/shared/ui';

function formatMMSS(sec: number): string {
  return String(Math.floor(sec / 60)).padStart(2, '0') + ':' + String(sec % 60).padStart(2, '0');
}

type Props = {
  count: number;
  min: number;
  seconds: number; // 카운트다운 중일 때만 의미 있음 — isCountingDown이 false면 표시 안 함
  isCountingDown: boolean;
  onCancel: () => void;
};

export function MatchingStatus({ count, min, seconds, isCountingDown, onCancel }: Props) {
  const label = isCountingDown
    ? `${count}명 모임 · ${formatMMSS(seconds)} 후 시작`
    : `${count}/${min}명 모으는 중..`;

  return (
    <View sx={{ gap: spacing.MD }}>
      <Button label={label} color="light" disabled />
      <Button label="랜덤 매칭 취소" color="dark" onPress={onCancel} />
    </View>
  );
}
