import { Text, View } from 'dripsy'
import { Pressable, StyleSheet } from 'react-native'
import { colors, spacing } from '@/shared/config'
import { Icon } from '@/shared/ui/Icon'

type Props = {
  label: string
  value: string
  onPress: () => void
  disabled?: boolean
}

export function ProfileRow({ label, value, onPress, disabled = false }: Props) {
  return (
    <Pressable
      disabled={disabled}
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [
        styles.row,
        disabled && { opacity: 0.4 },
        !disabled && pressed && { opacity: 0.7 },
      ]}
    >
      <Text sx={{ color: colors.LIGHT_100 }}>{label}</Text>
      <View sx={{ flexDirection: 'row', alignItems: 'center', gap: spacing.XS }}>
        <Text variant="B4" sx={{ color: colors.GRAY }}>{value}</Text>
        {!disabled && <Icon name="CHEVRON_RIGHT" size={16} />}
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  row: {
    height: 56,
    paddingHorizontal: spacing.MD,
    backgroundColor: colors.DARK_200,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
})
