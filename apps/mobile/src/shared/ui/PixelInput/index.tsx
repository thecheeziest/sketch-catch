import React, { useState } from 'react'
import { View, Text, TextInput } from 'dripsy'
import type { TextInputProps } from 'react-native'
import { colors, spacing, textSizes, fontFamily } from '@/shared/config'

type Props = {
  label?: string
  hint?: string
  error?: string
  value: string
  onChangeText: (text: string) => void
  maxLength?: number
  showCounter?: boolean
  placeholder?: string
  fadedValue?: boolean
  autoCapitalize?: TextInputProps['autoCapitalize']
  autoCorrect?: boolean
  onBlur?: () => void
}

type InputState = 'default' | 'focus' | 'error'

const BORDER_COLOR: Record<InputState, string> = {
  error: colors.WARNING_400,
  focus: colors.PRIMARY_400,
  default: colors.SECONDARY_300,
}

export function PixelInput(props: Props) {
  const [focused, setFocused] = useState(false)
  const state: InputState = props.error ? 'error' : focused ? 'focus' : 'default'

  const handleBlur = (): void => {
    setFocused(false)
    props.onBlur?.()
  }

  return (
    <View sx={{ gap: spacing.XS }}>
      {props.label ? (
        <Text sx={sxStyles.label} allowFontScaling={false}>{props.label}</Text>
      ) : null}
      <TextInput
        sx={{ ...sxStyles.field, borderColor: BORDER_COLOR[state], opacity: props.fadedValue ? 0.35 : 1 }}
        value={props.value}
        onChangeText={props.onChangeText}
        maxLength={props.maxLength}
        placeholder={props.placeholder}
        placeholderTextColor={colors.GRAY}
        autoCapitalize={props.autoCapitalize ?? 'none'}
        autoCorrect={props.autoCorrect ?? false}
        onFocus={() => setFocused(true)}
        onBlur={handleBlur}
        allowFontScaling={false}
      />
      <View sx={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View sx={{ flex: 1 }}>
          {props.error ? (
            <Text sx={sxStyles.errorText} allowFontScaling={false}>{props.error}</Text>
          ) : props.hint ? (
            <Text sx={sxStyles.hintText} allowFontScaling={false}>{props.hint}</Text>
          ) : null}
        </View>
        {props.showCounter && props.maxLength ? (
          <Text sx={sxStyles.hintText} allowFontScaling={false}>
            {props.value.length} / {props.maxLength}
          </Text>
        ) : null}
      </View>
    </View>
  )
}

const sxStyles = {
  label: {
    fontFamily: fontFamily.REGULAR,
    ...textSizes.B1,
    color: colors.LIGHT_100,
  },
  field: {
    height: 48,
    borderWidth: 2,
    backgroundColor: colors.DARK_100,
    paddingHorizontal: spacing.MD,
    color: colors.LIGHT_100,
    fontFamily: fontFamily.REGULAR,
    fontSize: textSizes.B1.fontSize,
  },
  hintText: {
    fontFamily: fontFamily.REGULAR,
    ...textSizes.B4,
    color: colors.GRAY,
  },
  errorText: {
    fontFamily: fontFamily.REGULAR,
    ...textSizes.B4,
    color: colors.WARNING_400,
  },
}
