import { Text, View } from 'dripsy';
import { colors, spacing, textSizes } from '@/shared/config';
import { PixelFrame } from '@/shared/ui/PixelFrame';

type Props = {
  word: string;
};

export function WordBanner({ word }: Props) {
  return (
    <PixelFrame borderColor={colors.PRIMARY_400}>
      <View sx={{ backgroundColor: colors.DARK_300, paddingVertical: spacing.SM, paddingHorizontal: spacing.MD }}>
        <Text sx={{ ...textSizes.T1, fontFamily: 'Galmuri11', color: colors.LIGHT_100, textAlign: 'center' }}>
          {word}
        </Text>
      </View>
    </PixelFrame>
  );
}
