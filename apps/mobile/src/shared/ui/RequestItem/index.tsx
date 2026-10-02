import { Text, View } from 'dripsy'
import { Pressable, StyleSheet } from 'react-native'
import { colors } from '@/shared/config'
import type { FriendRequest } from '@/shared/model'

type Props = {
  request: FriendRequest
  onAccept: () => void
  onReject: () => void
  isLoading?: boolean
  index?: number
}

// FriendItem과 동일한 교차 배경 — light tint 위에서 행 구분이 보이도록
const ROW_BG = [`${colors.WHITE}70`, `${colors.PRIMARY_300}70`] as const

export function RequestItem({ request, onAccept, onReject, isLoading = false, index }: Props) {
  const { sender } = request
  const bgColor = index !== undefined ? ROW_BG[index % 2] : 'transparent'

  return (
    <View sx={sxStyles.row} style={{ backgroundColor: bgColor }}>
      <View sx={{ width: 40, height: 40, backgroundColor: colors.SECONDARY_400 }} />
      <View sx={{ flex: 1 }}>
        <Text sx={{ color: colors.LIGHT_100 }}>{sender.nickname}</Text>
        <Text variant="B4" sx={{ color: colors.GRAY }}>{sender.nickname}#{sender.friendCode}</Text>
      </View>
      <View sx={{ flexDirection: 'row', gap: 8 }}>
        <Pressable style={[styles.acceptButton, isLoading && styles.disabledButton]} onPress={onAccept} disabled={isLoading}>
          <Text sx={{ color: colors.WHITE }}>수락</Text>
        </Pressable>
        <Pressable style={[styles.rejectButton, isLoading && styles.disabledButton]} onPress={onReject} disabled={isLoading}>
          <Text sx={{ color: colors.WHITE }}>거절</Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  acceptButton: { height: 36, minWidth: 56, backgroundColor: colors.SECONDARY_400, borderWidth: 2, borderColor: colors.DARK_100, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  rejectButton: { height: 36, minWidth: 56, backgroundColor: colors.WARNING_400, borderWidth: 2, borderColor: colors.DARK_100, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  disabledButton: { opacity: 0.6 },
})

const sxStyles = {
  row: { height: 64, paddingHorizontal: 16, flexDirection: 'row' as const, alignItems: 'center' as const, gap: 16, borderBottomWidth: 1, borderBottomColor: colors.BLACK },
}
