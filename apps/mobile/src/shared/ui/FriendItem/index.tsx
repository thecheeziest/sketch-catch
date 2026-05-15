import React from 'react'
import { Pressable, View, Text, StyleSheet } from 'react-native'
import { colors, typography, fontFamily } from '@/shared/config/theme'
import { PresenceDot } from '@/shared/ui/PresenceDot'

type Friend = {
  friendshipId: string
  userId: string
  nickname: string
  friendCode: string
  characterId: string
  presenceStatus: 'ONLINE' | 'OFFLINE' | 'IN_GAME'
}

type Props = { friend: Friend; onLongPress: () => void }

export function FriendItem({ friend, onLongPress }: Props): React.JSX.Element {
  return (
    <Pressable
      style={styles.row}
      onLongPress={onLongPress}
      delayLongPress={500}
    >
      {/* 캐릭터 아이콘 영역 */}
      <View style={styles.iconWrapper}>
        <View style={styles.iconPlaceholder} />
        <View style={styles.dotWrapper}>
          <PresenceDot status={friend.presenceStatus} />
        </View>
      </View>

      {/* 텍스트 영역 */}
      <View style={styles.textArea}>
        <Text style={styles.nickname} allowFontScaling={false}>
          {friend.nickname}
        </Text>
        <Text style={styles.code} allowFontScaling={false}>
          {friend.nickname}#{friend.friendCode}
        </Text>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  row: {
    height: 64,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  iconWrapper: {
    position: 'relative',
    width: 40,
    height: 40,
  },
  iconPlaceholder: {
    width: 40,
    height: 40,
    backgroundColor: colors.accentSecondary,
  },
  dotWrapper: {
    position: 'absolute',
    bottom: 0,
    right: 0,
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
})
