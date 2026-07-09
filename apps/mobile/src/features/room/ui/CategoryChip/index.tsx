import { Text, View } from 'dripsy'
import { Pressable, StyleSheet } from 'react-native'
import { colors, spacing } from '@/shared/config'
import { PixelFrame } from '@/shared/ui/PixelFrame'

type Props = {
  label: string
  active: boolean
  onPress: () => void
}

export function CategoryChip({ label, active, onPress }: Props) {
  const borderColor = active ? colors.SECONDARY_400 : colors.BLACK
  const backgroundColor = active ? colors.SECONDARY_100 : colors.SECONDARY_300

  return (
    <Pressable onPress={onPress}>
      {/* absoluteFill: Pressable 크기가 정해진 뒤 배경을 pixel corner로 clip */}
      <PixelFrame borderColor={borderColor} borderWidth={2} style={StyleSheet.absoluteFillObject}>
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor }]} />
      </PixelFrame>
      {/* normal flow: Pressable 너비/높이 결정, z-order상 PixelFrame 위 */}
      <View style={styles.content}>
        <Text variants={['bold', 'B3']} sx={{ color: colors.ACCENT_300 }}>
          {label}
        </Text>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  content: { height: 36, paddingHorizontal: spacing.MD, alignItems: 'center', justifyContent: 'center' },
})
