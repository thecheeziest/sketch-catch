import React from 'react'
import { Pressable, StyleSheet, Text } from 'react-native'
import { colors, spacing, fontFamily, typography } from '@/shared/config/theme'

type Props = {
  label: string
  active: boolean
  onPress: () => void
}

export function CategoryChip({ label, active, onPress }: Props): React.JSX.Element {
  return (
    <Pressable
      style={[styles.chip, active ? styles.chipActive : styles.chipInactive]}
      onPress={onPress}
    >
      <Text
        style={[styles.label, active ? styles.labelActive : styles.labelInactive]}
        allowFontScaling={false}
      >
        {label}
      </Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  chip: {
    height: 36,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  chipActive: {
    backgroundColor: colors.accentSecondary,
    borderColor: colors.textPrimary,
  },
  chipInactive: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  label: {
    fontFamily: fontFamily.regular,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
  },
  labelActive: {
    color: colors.background,
  },
  labelInactive: {
    color: colors.textPrimary,
  },
})
