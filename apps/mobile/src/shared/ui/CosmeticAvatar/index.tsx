import { Image, View } from 'dripsy';
import { StyleSheet } from 'react-native';
import { getBackgroundItem, getCharacterImageSource, getFrameDecoSprite, getFrameItem } from '@/shared/config';
import { CosmeticBackground } from '../CosmeticBackground';
import { PixelFrame } from '../PixelFrame';
import { PixelSprite } from '../PixelSprite';

type Props = {
  characterId: string;
  frameId?: string | null;
  backgroundId?: string | null;
  size: number;
  /** 테두리를 장착하지 않았을 때의 테두리 색 — 없으면 테두리 없이 그린다 */
  defaultBorderColor?: string;
  /** 배경을 장착하지 않았을 때의 칸 색 */
  defaultBackgroundColor?: string;
  dimmed?: boolean;
};

const CHARACTER_RATIO = 0.8;

// 캐릭터 + 장착한 테두리·배경·장식. 장식(고양이 귀·왕관 등)은 칸 위로 삐져나와 그려진다.
export function CosmeticAvatar({
  characterId,
  frameId,
  backgroundId,
  size,
  defaultBorderColor,
  defaultBackgroundColor,
  dimmed = false,
}: Props) {
  const frame = getFrameItem(frameId);
  const background = getBackgroundItem(backgroundId);
  const borderColor = frame?.color ?? defaultBorderColor;
  const imageSource = getCharacterImageSource(characterId);
  const characterSize = Math.round(size * CHARACTER_RATIO);
  const decoPixel = Math.max(1, Math.round(size / 24));
  const decoSprite = frame?.deco ? getFrameDecoSprite(frame.deco, frame.color) : null;

  // 배경만 테두리(MaskedView) 안에서 잘라 그리고, 캐릭터는 그 위 별도 레이어에 둔다
  // (MaskedView 안에 캐릭터를 넣으면 배경이 없을 때 위치가 어긋난다)
  const backgroundLayer = (() => {
    if (background) {
      return (
        <View style={StyleSheet.absoluteFill}>
          <CosmeticBackground pattern={background.pattern} size={size} />
        </View>
      );
    }
    if (defaultBackgroundColor) {
      return <View style={[StyleSheet.absoluteFill, { backgroundColor: defaultBackgroundColor }]} />;
    }
    return null;
  })();

  return (
    <View style={{ width: size, height: size }}>
      {borderColor ? (
        <PixelFrame
          borderColor={borderColor}
          borderWidth={size >= 60 ? 3 : 2}
          notchSize={size >= 60 ? 6 : 4}
          style={StyleSheet.absoluteFill}
        >
          {backgroundLayer}
        </PixelFrame>
      ) : (
        backgroundLayer
      )}
      <View style={styles.center} pointerEvents="none">
        {imageSource !== null && (
          <Image
            source={imageSource}
            sx={{ width: characterSize, height: characterSize }}
            resizeMode="contain"
            style={dimmed ? styles.dimmed : undefined}
          />
        )}
      </View>

      {decoSprite && frame?.deco === 'CAT_EAR' && (
        <>
          <View style={[styles.deco, { top: -decoPixel * 3, left: size * 0.1 }]} pointerEvents="none">
            <PixelSprite sprite={decoSprite} pixelSize={decoPixel} />
          </View>
          <View style={[styles.deco, { top: -decoPixel * 3, right: size * 0.1 }]} pointerEvents="none">
            <PixelSprite sprite={decoSprite} pixelSize={decoPixel} />
          </View>
        </>
      )}
      {decoSprite && frame?.deco === 'RIBBON' && (
        <View style={[styles.deco, { top: -decoPixel * 2, right: -decoPixel * 3 }]} pointerEvents="none">
          <PixelSprite sprite={decoSprite} pixelSize={decoPixel} />
        </View>
      )}
      {decoSprite && (frame?.deco === 'CROWN' || frame?.deco === 'SPROUT') && (
        <View style={[styles.deco, styles.decoCenter, { top: -decoPixel * 4 }]} pointerEvents="none">
          <PixelSprite sprite={decoSprite} pixelSize={decoPixel} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  deco: { position: 'absolute', zIndex: 2 },
  decoCenter: { left: 0, right: 0, alignItems: 'center' },
  dimmed: { opacity: 0.35 },
});
