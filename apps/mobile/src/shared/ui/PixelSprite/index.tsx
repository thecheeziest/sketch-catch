import { useMemo } from 'react';
import { Canvas, Rect } from '@shopify/react-native-skia';
import { getSpritePixels, getSpriteSize, type PixelSpriteData } from '@sketch-catch/shared';

type Props = {
  sprite: PixelSpriteData;
  /** 도트 1칸의 크기(pt) */
  pixelSize?: number;
};

// shared 도트 데이터를 그대로 찍는 픽셀 아트 — 서버 GIF와 같은 모양을 보장한다
export function PixelSprite({ sprite, pixelSize = 3 }: Props) {
  const { width, height } = getSpriteSize(sprite);
  const pixels = useMemo(() => getSpritePixels(sprite), [sprite]);

  return (
    <Canvas style={{ width: width * pixelSize, height: height * pixelSize }}>
      {pixels.map(pixel => (
        <Rect
          key={`${pixel.x}-${pixel.y}`}
          x={pixel.x * pixelSize}
          y={pixel.y * pixelSize}
          width={pixelSize}
          height={pixelSize}
          color={pixel.color}
        />
      ))}
    </Canvas>
  );
}
