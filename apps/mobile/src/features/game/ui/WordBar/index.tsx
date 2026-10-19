import { type ReactNode } from 'react';
import { Text, View } from 'dripsy';
import { fontFamily } from '@/shared/config';
import { gameSurface } from '@/features/game/config';

const SIDE_WIDTH = 40;

type Props = {
  word: string | null;
  color: string;
  /** 제시어 오른쪽 슬롯 (예: 남은 시간) */
  right?: ReactNode;
  /** 좌우 슬롯 폭 — 오른쪽 슬롯에 버튼까지 들어가면 넓힌다 (제시어 가운데 정렬 유지) */
  sideWidth?: number;
};

// 높이를 고정해 제시어 유무에 따라 스케치북 크기가 흔들리지 않게 한다.
// 왼쪽에 같은 폭의 빈 칸을 둬 오른쪽 슬롯이 있어도 제시어가 가운데에 온다.
export function WordBar({ word, color, right, sideWidth = SIDE_WIDTH }: Props) {
  return (
    <View sx={{ height: 40, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, backgroundColor: gameSurface.SUBPANEL }}>
      <View sx={{ width: sideWidth }} />
      <Text
        sx={{ flex: 1, fontFamily: fontFamily.REGULAR, fontSize: 22, lineHeight: 28, letterSpacing: 2, color, textAlign: 'center' }}
        numberOfLines={1}
      >
        {word ?? ''}
      </Text>
      <View sx={{ width: sideWidth, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
        {right}
      </View>
    </View>
  );
}
