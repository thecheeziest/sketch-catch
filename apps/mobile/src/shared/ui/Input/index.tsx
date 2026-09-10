import { Text, TextInput, View } from 'dripsy'
import { colors, fontFamily, spacing, textSizes } from '@/shared/config';
import { useState } from 'react';
import type { StyleProp, TextInputProps, TextStyle } from 'react-native';
import { PixelFrame } from '../PixelFrame';

type InputColor = 'PRIMARY' | 'SECONDARY' | 'LIGHT' | 'DARK' | 'WARNING' | 'INFO' | 'SUCCESS';

type Props = {
  label?: string;
  hint?: string;
  error?: string;
  value: string;
  onChangeText: (text: string) => void;
  maxLength?: number;
  showCounter?: boolean;
  placeholder?: string;
  fadedValue?: boolean;
  autoCapitalize?: TextInputProps['autoCapitalize'];
  secureTextEntry?: boolean;
  onBlur?: () => void;
  color?: InputColor;
  style?: StyleProp<TextStyle>;
  textColor?: string;
};

const BORDER_COLORS: Record<InputColor, { default: string; focus: string }> = {
  PRIMARY: { default: colors.PRIMARY_200, focus: colors.PRIMARY_300 },
  SECONDARY: { default: colors.SECONDARY_200, focus: colors.SECONDARY_300 },
  LIGHT: { default: colors.LIGHT_200, focus: colors.LIGHT_300 },
  DARK: { default: colors.DARK_200, focus: colors.DARK_300 },
  WARNING: { default: colors.WARNING_200, focus: colors.WARNING_300 },
  INFO: { default: colors.INFO_200, focus: colors.INFO_300 },
  SUCCESS: { default: colors.SUCCESS_200, focus: colors.SUCCESS_300 },
};

export function AppInput(props: Props) {
  const [focused, setFocused] = useState(false);

  const colorScheme = BORDER_COLORS[props.color ?? 'SECONDARY'];
  const borderColor = props.error
    ? colors.ERROR_400
    : focused
      ? colorScheme.focus
      : colorScheme.default;

  const handleBlur = (): void => {
    setFocused(false);
    props.onBlur?.();
  };

  return (
    <View sx={{ gap: spacing.SM }}>
      {props.label ? (
        <Text sx={{ color: colors.LIGHT_500 }}>
          {props.label}
        </Text>
      ) : null}
      <PixelFrame borderColor={borderColor} borderWidth={2} style={{ height: 48 }}>
        <TextInput
          sx={{
            ...sxStyles.field,
            opacity: props.fadedValue ? 0.35 : 1,
            color: props.textColor ?? colors.ACCENT_300,
          }}
          style={props.style}
          value={props.value}
          onChangeText={props.onChangeText}
          maxLength={props.maxLength}
          placeholder={props.placeholder}
          placeholderTextColor={colors.GRAY}
          autoCapitalize={props.autoCapitalize ?? 'none'}
          secureTextEntry={props.secureTextEntry}
          onFocus={() => setFocused(true)}
          onBlur={handleBlur}
        />
      </PixelFrame>
      <View sx={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View sx={{ flex: 1 }}>
          {props.error ? (
            <Text variant="B4" sx={{ color: colors.ERROR_400 }}>
              {props.error}
            </Text>
          ) : props.hint ? (
            <Text variant="B4" sx={{ color: colors.GRAY }}>
              {props.hint}
            </Text>
          ) : null}
        </View>
        {props.showCounter && props.maxLength ? (
          <Text variant="B4" sx={{ color: colors.GRAY }}>
            {props.value.length} / {props.maxLength}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const sxStyles = {
  field: {
    flex: 1,
    backgroundColor: colors.DARK_100,
    paddingHorizontal: spacing.MD,
    fontFamily: fontFamily.REGULAR,
    fontSize: textSizes.B1.fontSize,
  },
};
