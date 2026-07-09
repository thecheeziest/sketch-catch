import { Text, View } from 'dripsy'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useToastStore } from '@/shared/model'
import { colors, spacing } from '@/shared/config'

export function ToastHost() {
  const toasts = useToastStore((s) => s.toasts)
  const insets = useSafeAreaInsets()
  return (
    <View
      sx={{ ...sxStyles.host, bottom: insets.bottom + spacing.LG }}
      pointerEvents="none"
    >
      {toasts.map((t) => (
        <View key={t.id} sx={sxStyles.bubble}>
          <Text variant="B4" sx={{ color: colors.LIGHT_100 }}>{t.message}</Text>
        </View>
      ))}
    </View>
  )
}

const sxStyles = {
  host: {
    position: 'absolute' as const,
    left: 0,
    right: 0,
    alignItems: 'center' as const,
    gap: spacing.SM,
  },
  bubble: {
    backgroundColor: colors.DARK_100,
    paddingVertical: spacing.SM,
    paddingHorizontal: spacing.MD,
  },
}
