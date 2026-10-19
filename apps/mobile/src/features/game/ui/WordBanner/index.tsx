import { Text, View } from 'dripsy';
import { StyleSheet } from 'react-native';
import { colors, spacing, textSizes } from '@/shared/config';
import { PixelFrame } from '@/shared/ui/PixelFrame';

type Props = {
  word: string;
};

export function WordBanner({ word }: Props) {
  return (
    <View>
      <PixelFrame borderColor={colors.PRIMARY_400} style={StyleSheet.absoluteFill}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.DARK_300 }]} />
      </PixelFrame>
      <View sx={{ paddingVertical: spacing.SM, paddingHorizontal: spacing.MD }}>
        <Text sx={{ ...textSizes.T1, color: colors.LIGHT_100, textAlign: 'center' }}>
          {word || '제출된 제시어가 없어요'}
        </Text>
      </View>
    </View>
  );
}
