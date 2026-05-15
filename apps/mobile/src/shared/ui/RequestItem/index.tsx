import React from 'react'
import { Pressable, View, Text, StyleSheet } from 'react-native'
import { colors, typography, fontFamily } from '@/shared/config/theme'

type Request = {
  id: string
  sender: { id: string; nickname: string; friendCode: string; characterId: string }
  createdAt: string
}

type Props = {
  request: Request
  onAccept: () => void
  onReject: () => void
  isLoading?: boolean
}

export function RequestItem({ request, onAccept, onReject, isLoading = false }: Props): React.JSX.Element {
  const { sender } = request

  return (
    <View style={styles.row}>
      {/* 캐릭터 아이콘 영역 (presence dot 없음) */}
      <View style={styles.iconPlaceholder} />

      {/* 텍스트 영역 */}
      <View style={styles.textArea}>
        <Text style={styles.nickname} allowFontScaling={false}>
          {sender.nickname}
        </Text>
        <Text style={styles.code} allowFontScaling={false}>
          {sender.nickname}#{sender.friendCode}
        </Text>
      </View>

      {/* 수락/거절 버튼 영역 */}
      <View style={styles.buttonArea}>
        <Pressable
          style={[styles.acceptButton, isLoading && styles.disabledButton]}
          onPress={onAccept}
          disabled={isLoading}
        >
          <Text style={styles.acceptLabel} allowFontScaling={false}>수락</Text>
        </Pressable>
        <Pressable
          style={[styles.rejectButton, isLoading && styles.disabledButton]}
          onPress={onReject}
          disabled={isLoading}
        >
          <Text style={styles.rejectLabel} allowFontScaling={false}>거절</Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    height: 64,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  iconPlaceholder: {
    width: 40,
    height: 40,
    backgroundColor: colors.accentSecondary,
  },
  textArea: {
    flex: 1,
  },
  nickname: {
    fontFamily: fontFamily.regular,
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    color: colors.textPrimary,
  },
  code: {
    fontFamily: fontFamily.regular,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    color: colors.textSecondary,
  },
  buttonArea: {
    flexDirection: 'row',
    gap: 8,
  },
  acceptButton: {
    height: 36,
    minWidth: 56,
    backgroundColor: colors.accentSecondary,
    borderWidth: 2,
    borderColor: colors.textPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  rejectButton: {
    height: 36,
    minWidth: 56,
    backgroundColor: colors.destructive,
    borderWidth: 2,
    borderColor: colors.textPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  acceptLabel: {
    fontFamily: fontFamily.regular,
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    color: colors.textPrimary,
  },
  rejectLabel: {
    fontFamily: fontFamily.regular,
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    color: colors.background,
  },
  disabledButton: {
    opacity: 0.6,
  },
})
