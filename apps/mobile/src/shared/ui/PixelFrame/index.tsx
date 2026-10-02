import MaskedView from '@react-native-masked-view/masked-view';
import { View } from 'dripsy';
import { type ReactNode } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';

type SideStyles = {
  top: StyleProp<ViewStyle>;
  right: StyleProp<ViewStyle>;
  bottom: StyleProp<ViewStyle>;
  left: StyleProp<ViewStyle>;
};

type Props = {
  children: ReactNode;
  borderColor: string;
  borderWidth?: number;
  notchSize?: number;
  style?: StyleProp<ViewStyle>;
  /** 단일 animated style — 4면 모두 같은 색으로 애니메이션 */
  animatedBorderStyle?: StyleProp<ViewStyle>;
  /** 면별 animated style — 제공 시 animatedBorderStyle보다 우선 적용 */
  sideAnimatedStyles?: SideStyles;
};

/**
 * 픽셀 아트 스타일 테두리 + MaskedView 클리핑.
 *
 * 사용 패턴:
 * - 고정 크기 부모 (Button, Input 등): 콘텐츠를 PixelFrame 안에 배치
 * - 자동 크기 부모 (Chip, Badge 등): PixelFrame을 absoluteFill로 두고
 *   콘텐츠를 PixelFrame 밖 normal flow에 배치 → 부모가 콘텐츠 크기를 결정
 */
export function PixelFrame({
  children,
  borderColor,
  borderWidth = 3,
  notchSize = 6,
  style,
  animatedBorderStyle,
  sideAnimatedStyles,
}: Props) {
  const bw = borderWidth;
  const n = notchSize;
  const fallback = (animatedBorderStyle ?? { backgroundColor: borderColor }) as StyleProp<ViewStyle>;

  const T = sideAnimatedStyles?.top ?? fallback;
  const R = sideAnimatedStyles?.right ?? fallback;
  const B = sideAnimatedStyles?.bottom ?? fallback;
  const L = sideAnimatedStyles?.left ?? fallback;

  const borderLines = (
    <>
      {/* 4면 */}
      <Animated.View style={[{ position: 'absolute', top: 0, left: n, right: n, height: bw }, T]} />
      <Animated.View style={[{ position: 'absolute', bottom: 0, left: n, right: n, height: bw }, B]} />
      <Animated.View style={[{ position: 'absolute', top: n, left: 0, bottom: n, width: bw }, L]} />
      <Animated.View style={[{ position: 'absolute', top: n, right: 0, bottom: n, width: bw }, R]} />

      {/* top-left corner */}
      <View style={{ position: 'absolute', top: 0, left: 0, width: n, height: n }}>
        <Animated.View style={[{ position: 'absolute', top: 0, right: 0, width: bw, height: n }, T]} />
        <Animated.View style={[{ position: 'absolute', bottom: 0, left: 0, height: bw, width: n }, L]} />
      </View>

      {/* top-right corner */}
      <View style={{ position: 'absolute', top: 0, right: 0, width: n, height: n }}>
        <Animated.View style={[{ position: 'absolute', top: 0, left: 0, width: bw, height: n }, T]} />
        <Animated.View style={[{ position: 'absolute', bottom: 0, left: 0, height: bw, width: n }, R]} />
      </View>

      {/* bottom-left corner */}
      <View style={{ position: 'absolute', bottom: 0, left: 0, width: n, height: n }}>
        <Animated.View style={[{ position: 'absolute', top: 0, right: 0, width: bw, height: n }, L]} />
        <Animated.View style={[{ position: 'absolute', top: 0, left: 0, height: bw, width: n }, B]} />
      </View>

      {/* bottom-right corner */}
      <View style={{ position: 'absolute', bottom: 0, right: 0, width: n, height: n }}>
        <Animated.View style={[{ position: 'absolute', top: 0, left: 0, width: bw, height: n }, R]} />
        <Animated.View style={[{ position: 'absolute', top: 0, left: 0, height: bw, width: n }, B]} />
      </View>
    </>
  );

  return (
    <View style={style}>
      <MaskedView
        style={StyleSheet.absoluteFill}
        maskElement={
          <View style={styles.maskRoot}>
            <View style={{ position: 'absolute', top: n, left: 0, right: 0, bottom: n, backgroundColor: 'white' }} />
            <View style={{ position: 'absolute', top: 0, left: n, right: n, bottom: 0, backgroundColor: 'white' }} />
          </View>
        }
      >
        {children}
      </MaskedView>
      {borderLines}
    </View>
  );
}

const styles = StyleSheet.create({
  maskRoot: { flex: 1, backgroundColor: 'transparent' },
});
