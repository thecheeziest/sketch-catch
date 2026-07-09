import React from 'react';
import { View } from 'dripsy';
import { spacing } from '@/shared/config';
import { Button } from '@/shared/ui';

function formatMMSS(sec: number): string {
  return String(Math.floor(sec / 60)).padStart(2, '0') + ':' + String(sec % 60).padStart(2, '0');
}

type Props = {
  count: number;
  seconds: number;
  onCancel: () => void;
};

export function MatchingStatus({ count, seconds, onCancel }: Props) {
  return (
    <View sx={{ gap: spacing.MD }}>
      <Button label={`${count}인 랜덤 매칭 중.. ${formatMMSS(seconds)}`} color="light" disabled />
      <Button label={`${count}인 랜덤 매칭 취소`} color="dark" onPress={onCancel} />
    </View>
  );
}
