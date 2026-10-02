import { Text, View } from 'dripsy'
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { colors } from '@/shared/config';
import { PixelFrame } from '../PixelFrame';

type Props = {
  label: string;
  animatedColorStyle?: StyleProp<ViewStyle>;
  color?: string;
};

export function Badge({ label, animatedColorStyle, color = colors.PRIMARY_100 }: Props) {
  const bgStyle = (animatedColorStyle ?? { backgroundColor: color }) as StyleProp<ViewStyle>;

  return (
    <View>
      <PixelFrame borderColor={colors.DARK_100} borderWidth={1} notchSize={3} style={StyleSheet.absoluteFill}>
        <Animated.View style={[StyleSheet.absoluteFill, bgStyle]} />
      </PixelFrame>
      <View style={styles.content}>
        <Text sx={{ fontSize: 9, lineHeight: 13, color: colors.DARK_100 }}>{label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingVertical: 2, paddingHorizontal: 5 },
});
