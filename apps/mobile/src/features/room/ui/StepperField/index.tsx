import React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { colors, spacing, typography, fontFamily } from '@/shared/config/theme'

type Props = {
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (n: number) => void
}

export function StepperField({ label, value, min, max, step = 1, onChange }: Props): React.JSX.Element {
  const canDecrement = value > min
  const canIncrement = value < max

  return (
    <View style={styles.row}>
      <Text style={styles.label} allowFontScaling={false}>{label}</Text>
      <View style={styles.stepper}>
        <Pressable
          style={[styles.btn, !canDecrement && styles.btnDisabled]}
          onPress={() => canDecrement && onChange(value - step)}
          disabled={!canDecrement}
        >
          <Text style={styles.btnLabel} allowFontScaling={false}>-</Text>
        </Pressable>
        <Text style={styles.value} allowFontScaling={false}>{value}</Text>
        <Pressable
          style={[styles.btn, !canIncrement && styles.btnDisabled]}
          onPress={() => canIncrement && onChange(value + step)}
          disabled={!canIncrement}
        >
          <Text style={styles.btnLabel} allowFontScaling={false}>+</Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    flex: 1,
    fontFamily: fontFamily.regular,
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    color: colors.textPrimary,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  btn: {
    width: 40,
    height: 40,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: {
    opacity: 0.3,
  },
  btnLabel: {
    fontFamily: fontFamily.regular,
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    color: colors.textPrimary,
  },
  value: {
    fontFamily: fontFamily.regular,
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    color: colors.textPrimary,
    minWidth: 32,
    textAlign: 'center',
  },
})
