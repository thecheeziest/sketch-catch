import { Image, type ImageStyle } from 'expo-image';
import type { StyleProp } from 'react-native';

// Pitfall 3 예외: dripsy Image(RN Image 래핑)는 Android에서 애니메이션 GIF 자동 재생을 지원하지 않는다.
// FlatList와 동일한 typed wrapper 예외 패턴 — 프로젝트 유일 expo-image 사용처.
type Props = {
  uri: string;
  headers?: Record<string, string>;
  style?: StyleProp<ImageStyle>;
};

export function GifPreviewPlayer({ uri, headers, style }: Props) {
  return (
    <Image
      source={{ uri, headers, isAnimated: true }}
      style={style ?? { flex: 1 }}
      contentFit="contain"
      autoplay
    />
  );
}
