import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'dripsy';
import { StyleSheet } from 'react-native';
import { colors, spacing } from '@/shared/config';
import { PixelFrame } from '../PixelFrame';

type Provider = 'KAKAO' | 'APPLE';

type Props = {
  provider: Provider;
  account: string;
};

// 카카오 브랜드 아이콘은 벡터 아이콘셋(FontAwesome/Ionicons)에 없어 View로 심볼을 직접 구현
function KakaoSymbol() {
  return (
    <View sx={sxStyles.kakaoCircle}>
      <View sx={sxStyles.kakaoBubble} />
    </View>
  );
}

function ProviderIcon({ provider }: { provider: Provider }) {
  if (provider === 'APPLE') {
    return <Ionicons name="logo-apple" size={16} color={colors.LIGHT_100} />;
  }
  return <KakaoSymbol />;
}

export function PlatformBadge({ provider, account }: Props) {
  return (
    <View style={styles.container}>
      <PixelFrame
        borderColor={colors.DARK_100}
        borderWidth={1}
        notchSize={3}
        style={StyleSheet.absoluteFill}
      >
        <View style={StyleSheet.absoluteFill} />
      </PixelFrame>
      <View sx={sxStyles.content}>
        <ProviderIcon provider={provider} />
        <Text sx={{ fontSize: 13, color: colors.LIGHT_100 }}>|</Text>
        <Text sx={{ fontSize: 13, color: colors.LIGHT_100 }}>{account}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { height: 36 },
});

const sxStyles = {
  content: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.SM,
    paddingHorizontal: spacing.MD,
  },
  kakaoCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FEE500',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  kakaoBubble: {
    width: 8,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#191919',
  },
};
