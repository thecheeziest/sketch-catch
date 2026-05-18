import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { Player } from '@sketch-catch/shared'
import { colors, spacing, typography, fontFamily } from '@/shared/config/theme'
import { getCharacterImageSource } from '@/shared/config/characters'
import { Image } from 'react-native'

type Props = {
  player: Player | null
  isMe: boolean
}

export function SlotCard({ player, isMe }: Props): React.JSX.Element {
  if (player === null) {
    return (
      <View style={styles.cardWrapper}>
        <View style={[styles.card, styles.emptyCard, isMe && styles.meBorder]} />
      </View>
    )
  }

  const cardStyle = player.isReady ? styles.readyCard : styles.waitingCard
  const borderStyle = isMe ? styles.meBorder : null

  const imageSource = getCharacterImageSource(player.characterId)

  return (
    <View style={styles.cardWrapper}>
      <View style={[styles.card, cardStyle, borderStyle]}>
        {/* 캐릭터 이미지 or placeholder */}
        <View style={styles.avatarWrapper}>
          {imageSource !== null ? (
            <Image source={imageSource} style={styles.avatar} resizeMode="contain" />
          ) : (
            <View style={[styles.avatar, { backgroundColor: colors.accentSecondary }]} />
          )}
        </View>

        {/* 닉네임 (방장 crown 아이콘 포함) */}
        <View style={styles.nicknameRow}>
          {player.isHost && (
            <Ionicons
              name="ribbon"
              size={16}
              color={colors.accentPrimary}
              style={styles.crownIcon}
            />
          )}
          <Text style={styles.nickname} allowFontScaling={false} numberOfLines={1}>
            {player.nickname}
          </Text>
        </View>

        {/* 준비 상태 */}
        <Text style={styles.readyStatus} allowFontScaling={false}>
          {player.isReady ? '준비 완료' : '대기 중'}
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  cardWrapper: {
    flex: 1,
    aspectRatio: 0.85,
    margin: spacing.xs,
    minWidth: 72,
    minHeight: 88,
  },
  card: {
    flex: 1,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  emptyCard: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    // dashed 미지원 환경 → solid fallback
    borderStyle: 'dashed',
  },
  waitingCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderStyle: 'solid',
  },
  readyCard: {
    backgroundColor: colors.accentPrimary,
    borderColor: colors.textPrimary,
    borderStyle: 'solid',
  },
  meBorder: {
    borderWidth: 3,
    borderColor: colors.textPrimary,
  },
  avatarWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 48,
    height: 48,
  },
  nicknameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  crownIcon: {
    marginRight: 2,
  },
  nickname: {
    fontFamily: fontFamily.regular,
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  readyStatus: {
    fontFamily: fontFamily.regular,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    color: colors.textPrimary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
})
