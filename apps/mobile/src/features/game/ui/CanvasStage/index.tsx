import { type ReactNode, useCallback, useState } from 'react';
import { View } from 'dripsy';
import { type LayoutChangeEvent } from 'react-native';
import { CANVAS_ASPECT_RATIO } from '@/features/game/config';

type Props = {
  children: ReactNode;
};

type Size = { width: number; height: number };

// 가용 영역(키보드 제외) 안에 고정 비율 스케치북을 가운데 정렬로 최대한 크게 맞춘다.
export function fitCanvasSize(area: Size, aspectRatio: number): Size {
  if (area.width <= 0 || area.height <= 0) return { width: 0, height: 0 };
  const width = Math.min(area.width, area.height * aspectRatio);
  return { width: Math.floor(width), height: Math.floor(width / aspectRatio) };
}

export function CanvasStage({ children }: Props) {
  const [area, setArea] = useState<Size>({ width: 0, height: 0 });

  const handleLayout = useCallback((e: LayoutChangeEvent): void => {
    const { width, height } = e.nativeEvent.layout;
    setArea(prev => (prev.width === width && prev.height === height ? prev : { width, height }));
  }, []);

  const size = fitCanvasSize(area, CANVAS_ASPECT_RATIO);

  return (
    <View sx={{ flex: 1, alignItems: 'center', justifyContent: 'center' }} onLayout={handleLayout}>
      {size.width > 0 && <View style={{ width: size.width, height: size.height }}>{children}</View>}
    </View>
  );
}
