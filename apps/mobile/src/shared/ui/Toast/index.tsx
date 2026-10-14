import { Text, View } from 'dripsy'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useToastStore } from '@/shared/model'
import { colors, spacing } from '@/shared/config'

export function ToastHost() {
  const toasts = useToastStore((s) => s.toasts)
  const insets = useSafeAreaInsets()
  const topToasts = toasts.filter((t) => t.position === 'top')
  const bottomToasts = toasts.filter((t) => t.position !== 'top')

  const renderToast = (t: (typeof toasts)[number]) => (
    <View key={t.id} sx={{ ...sxStyles.bubble, backgroundColor: t.kind === 'error' ? colors.ERROR_500 : colors.DARK_100 }}>
      <Text variant="B4" sx={{ color: colors.LIGHT_100 }}>{t.message}</Text>
    </View>
  )

  return (
    <>
      <View sx={{ ...sxStyles.host, top: insets.top + spacing.MD }} pointerEvents="none">
        {topToasts.map(renderToast)}
      </View>
      <View sx={{ ...sxStyles.host, bottom: insets.bottom + spacing.LG }} pointerEvents="none">
        {bottomToasts.map(renderToast)}
      </View>
    </>
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
