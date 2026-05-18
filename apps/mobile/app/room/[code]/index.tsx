import React, { useEffect, useRef } from 'react'
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  type ListRenderItem,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as Clipboard from 'expo-clipboard'
import type { Player } from '@sketch-catch/shared'
import { CLIENT_EVENT } from '@sketch-catch/shared'
import { useRoomStore } from '@/shared/model/room'
import { useAuthStore } from '@/shared/model/auth'
import { useToastStore } from '@/shared/model/toast'
import { PixelButton } from '@/shared/ui/PixelButton'
import { SlotCard } from '@/features/room/ui/SlotCard'
import { colors, spacing, typography, fontFamily } from '@/shared/config/theme'

function getNumColumns(maxPlayers: number): number {
  if (maxPlayers <= 4) return 2
  if (maxPlayers <= 6) return 3
  if (maxPlayers <= 9) return 3
  return 4
}

type SlotItem = Player | null

export default function LobbyScreen(): React.JSX.Element {
  const { code } = useLocalSearchParams<{ code: string }>()
  const { connect, disconnect, socket, roomState } = useRoomStore()
  const myId = useAuthStore.getState().user?.id

  // 방장 승계 감지를 위한 이전 hostId ref
  const wasHostRef = useRef(false)

  // 소켓 연결 라이프사이클
  useEffect(() => {
    connect()
    return () => disconnect()
  }, [connect, disconnect])

  // 소켓 연결 후 room:join emit
  useEffect(() => {
    if (socket?.connected && code) {
      socket.emit(CLIENT_EVENT.ROOM_JOIN, { code })
    }
  }, [socket, code])

  // 방장 승계 Toast
  useEffect(() => {
    const isHost = roomState?.hostId === myId
    if (isHost && roomState?.players.find((p) => p.id === myId) && !wasHostRef.current) {
      useToastStore.getState().show('방장이 되었습니다')
    }
    wasHostRef.current = isHost ?? false
  }, [roomState?.hostId, myId])

  const maxPlayers = roomState?.config.playerCountMax ?? 6
  const numColumns = getNumColumns(maxPlayers)

  // 슬롯 배열: maxPlayers 길이, index = slot 번호
  const slots: SlotItem[] = Array.from({ length: maxPlayers }, (_, i) => {
    return roomState?.players.find((p) => p.slot === i) ?? null
  })

  const me = roomState?.players.find((p) => p.id === myId)
  const isHost = me?.isHost ?? false
  // 서버 권위 — 클라이언트 단독 계산 금지
  const allReady = roomState?.allReady ?? false

  const handleCopyCode = async (): Promise<void> => {
    await Clipboard.setStringAsync(code ?? '')
    useToastStore.getState().show('코드가 복사되었습니다')
  }

  const renderItem: ListRenderItem<SlotItem> = ({ item }) => (
    <SlotCard player={item} isMe={item?.id === myId} />
  )

  const keyExtractor = (_: SlotItem, index: number): string => String(index)

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Text style={styles.title} allowFontScaling={false} numberOfLines={1}>
          {roomState?.title ?? ''}
        </Text>

        <View style={styles.codeRow}>
          <Text style={styles.codeText} allowFontScaling={false}>
            {code}
          </Text>
          <Pressable onPress={handleCopyCode} hitSlop={8}>
            <Text style={styles.copyButton} allowFontScaling={false}>
              복사
            </Text>
          </Pressable>
          <Ionicons
            name={roomState?.locked ? 'lock-closed' : 'lock-open'}
            size={16}
            color={colors.textSecondary}
          />
        </View>

        <View style={styles.divider} />
      </View>

      {/* 슬롯 그리드 */}
      <FlatList
        data={slots}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        numColumns={numColumns}
        key={numColumns}
        contentContainerStyle={styles.grid}
        columnWrapperStyle={numColumns > 1 ? styles.row : undefined}
        style={styles.list}
      />

      {/* 하단 액션 버튼 */}
      <View style={styles.actionArea}>
        {isHost ? (
          allReady ? (
            <PixelButton
              label="게임 시작"
              variant="primary"
              onPress={() => socket?.emit(CLIENT_EVENT.ROOM_START)}
            />
          ) : (
            <PixelButton
              label="모두 준비 완료 후 시작 가능"
              variant="secondary"
              disabled
            />
          )
        ) : me?.isReady ? (
          <PixelButton
            label="준비 취소"
            variant="secondary"
            onPress={() => socket?.emit(CLIENT_EVENT.ROOM_READY, { ready: false })}
          />
        ) : (
          <PixelButton
            label="준비 완료"
            variant="primary"
            onPress={() => socket?.emit(CLIENT_EVENT.ROOM_READY, { ready: true })}
          />
        )}
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  title: {
    fontFamily: fontFamily.regular,
    fontSize: typography.heading.fontSize,
    lineHeight: typography.heading.lineHeight,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  codeText: {
    fontFamily: fontFamily.regular,
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    color: colors.textSecondary,
  },
  copyButton: {
    fontFamily: fontFamily.regular,
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    color: colors.accentPrimary,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  list: {
    flex: 1,
  },
  grid: {
    paddingHorizontal: spacing.md,
  },
  row: {
    gap: spacing.sm,
  },
  actionArea: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
})
