import { type ReactNode } from 'react';
import { View } from 'dripsy';
import { StyleSheet } from 'react-native';
import { PixelFrame } from '@/shared/ui/PixelFrame';
import { chatStream } from '@/features/game/config';

// 결과 슬래브 / 정답 슬래브 — ink 4px 프레임 + 하단 3px 발판(foot)으로 3D 키캡 느낌
export function PixelSlab({
  bg,
  footColor,
  footHeight,
  paddingH,
  paddingV,
  children,
}: {
  bg: string;
  footColor: string;
  footHeight: number;
  paddingH: number;
  paddingV: number;
  children: ReactNode;
}) {
  return (
    <View>
      <View sx={{ position: 'relative' }}>
        <PixelFrame borderColor={chatStream.BORDER} borderWidth={4} notchSize={0} style={StyleSheet.absoluteFill}>
          <View style={[StyleSheet.absoluteFill, { backgroundColor: bg }]} />
        </PixelFrame>
        <View sx={{ paddingHorizontal: paddingH, paddingVertical: paddingV, alignItems: 'center' }}>{children}</View>
      </View>
      <View style={{ height: footHeight, backgroundColor: footColor }} />
    </View>
  );
}

// 점수 칩 / 메타 칩 — ink 3px 프레임만 (발판 없음)
export function PixelChip({
  bg,
  paddingH,
  paddingV,
  children,
}: {
  bg: string;
  paddingH: number;
  paddingV: number;
  children: ReactNode;
}) {
  return (
    <View sx={{ position: 'relative' }}>
      <PixelFrame borderColor={chatStream.BORDER} borderWidth={3} notchSize={0} style={StyleSheet.absoluteFill}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: bg }]} />
      </PixelFrame>
      <View sx={{ paddingHorizontal: paddingH, paddingVertical: paddingV }}>{children}</View>
    </View>
  );
}
