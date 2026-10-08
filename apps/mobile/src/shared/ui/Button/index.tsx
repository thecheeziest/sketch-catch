import { colors, spacing, textSizes } from '@/shared/config';
import { PixelFrame } from '@/shared/ui/PixelFrame';
import { PixelLoadingSpinner } from '@/shared/ui/PixelLoadingSpinner';
import { Image, Text, View } from 'dripsy';
import { type ImageSourcePropType, Pressable, type PressableProps, StyleSheet } from 'react-native';

export type ButtonColor = 'light' | 'primary' | 'secondary' | 'dark';
type FontVariant = 'REGULAR' | 'BOLD';

type Props = Omit<PressableProps, 'children'> & {
  label?: string;
  icon?: ImageSourcePropType;
  color?: ButtonColor;
  height?: number;
  fontVariant?: FontVariant;
  pressedTextColor?: string;
  // 요청 처리 중 — 라벨 대신 원형 스피너를 보이고 연타를 막는다
  loading?: boolean;
};

type ColorTokens = {
  bg: string;
  border: string;
  text: string;
  pressedBg: string;
  pressedBorder: string;
  disabledBg: string;
  disabledText: string;
  disabledBorder: string;
};

const COLOR_MAP: Record<ButtonColor, ColorTokens> = {
  light: {
    bg: colors.LIGHT_500,
    border: colors.BLACK,
    text: colors.DARK_500,
    pressedBg: colors.LIGHT_100,
    pressedBorder: colors.LIGHT_500,
    disabledBg: colors.LIGHT_300,
    disabledText: colors.LIGHT_500,
    disabledBorder: colors.LIGHT_400,
  },
  dark: {
    bg: colors.DARK_500,
    border: colors.LIGHT_100,
    text: colors.LIGHT_100,
    pressedBg: colors.DARK_300,
    pressedBorder: colors.LIGHT_500,
    disabledBg: colors.DARK_100,
    disabledText: colors.DARK_200,
    disabledBorder: colors.DARK_200,
  },
  primary: {
    bg: colors.PRIMARY_500,
    border: colors.BLACK,
    text: colors.LIGHT_100,
    pressedBg: '#940044',
    pressedBorder: colors.PRIMARY_400,
    disabledBg: colors.PRIMARY_300,
    disabledText: colors.PRIMARY_200,
    disabledBorder: colors.PRIMARY_500,
  },
  secondary: {
    bg: colors.SECONDARY_400,
    border: colors.BLACK,
    text: colors.LIGHT_100,
    pressedBg: colors.SECONDARY_500,
    pressedBorder: colors.SECONDARY_400,
    disabledBg: colors.SECONDARY_300,
    disabledText: colors.SECONDARY_200,
    disabledBorder: colors.SECONDARY_500,
  },
};

// height ≥ 56 → T3(18), ≥ 48 → B1(16), ≥ 40 → B2(14), < 40 → B3(12)
function getTextSize(h: number) {
  if (h >= 56) return textSizes.T3;
  if (h >= 48) return textSizes.B1;
  if (h >= 40) return textSizes.B2;
  return textSizes.B3;
}

const ICON_SIZE_RATIO = 0.42;

export function Button({
  label,
  icon,
  color = 'primary',
  height = 48,
  fontVariant = 'BOLD',
  pressedTextColor,
  style,
  disabled,
  loading = false,
  ...rest
}: Props) {
  const tokens = COLOR_MAP[color];
  const textSize = getTextSize(height);
  const iconSize = Math.round(height * ICON_SIZE_RATIO);
  const iconOnly = !label && !!icon;

  const getBg = (pressed: boolean) => (disabled ? tokens.disabledBg : pressed ? tokens.pressedBg : tokens.bg);
  const getBorderColor = (pressed: boolean) =>
    disabled ? tokens.disabledBorder : pressed ? tokens.pressedBorder : tokens.border;
  const getTextColor = (pressed: boolean) => {
    if (disabled) return tokens.disabledText;
    if (pressed && pressedTextColor) return pressedTextColor;
    return tokens.text;
  };

  return (
    <Pressable
      disabled={disabled || loading}
      accessibilityState={{ disabled: !!disabled || loading, busy: loading }}
      style={({ pressed }) => [
        iconOnly ? { width: height, height } : { height },
        typeof style === 'function' ? style({ pressed }) : style,
      ]}
      {...rest}
    >
      {({ pressed }) => (
        <>
          <PixelFrame borderColor={getBorderColor(pressed)} style={StyleSheet.absoluteFill}>
            <View style={[StyleSheet.absoluteFill, { backgroundColor: getBg(pressed) }]} />
          </PixelFrame>
          {loading ? (
            <View style={styles.centerContent}>
              <PixelLoadingSpinner size={Math.round(height * 0.5)} accessibilityLabel="처리 중" />
            </View>
          ) : (
            <View style={iconOnly ? styles.centerContent : styles.rowContent}>
              {icon && (
                <Image
                  source={icon}
                  sx={{ width: iconSize, height: iconSize }}
                  resizeMode="contain"
                  style={{ tintColor: getTextColor(pressed) }}
                />
              )}
              {label && (
                <Text
                  variants={fontVariant === 'BOLD' ? ['bold'] : undefined}
                  sx={{ ...textSize, color: getTextColor(pressed) }}
                >
                  {label}
                </Text>
              )}
            </View>
          )}
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  centerContent: {
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowContent: {
    height: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.MD,
    gap: spacing.XS,
  },
});
