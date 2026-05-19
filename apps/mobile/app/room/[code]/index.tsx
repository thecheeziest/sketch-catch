import React, { useEffect, useRef, useState } from 'react'
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
import { RoomEditModal } from '@/features/room/ui/RoomEditModal'
import { colors, spacing, typography, fontFamily } from '@/shared/config/theme'

function getNumColumns(maxPlayers: number): number {
  if (maxPlayers <= 4) return 2
  if (maxPlayers <= 9) return 3
  return 4
}

type SlotItem = Player | null

export default function LobbyScreen(): React.JSX.Element {
  const { code } = useLocalSearchParams<{ code: string }>()
  const { connect, disconnect, socket, roomState } = useRoomStore()
  const myId = useAuthStore.getState().user?.id
  const wasHostRef = useRef(false)
  const [editVisible, setEditVisible] = useState(false)

  useEffect(() => {
    connect()
    return () => disconnect()
  }, [connect, disconnect])

  // 소켓 connect 이벤트 이후 room:join emit (타이밍 버그 수정)
  useEffect(() => {
    if (!socket || !code) return
    const handleConnect = (): void => {
      socket.emit(CLIENT_EVENT.ROOM_JOIN, { code })
    }
    if (socket.connected) {
      socket.emit(CLIENT_EVENT.ROOM_JOIN, { code })
      return
    }
    socket.on('connect', handleConnect)
    return () => { socket.off('connect', handleConnect) }
  }, [socket, code])

  // 방장 승계 Toast
  useEffect(() => {
    const isHost = roomState?.hostId === myId
    const hasJoined = Boolean(roomState?.players.find((p) => p.id === myId))
    if (isHost && hasJoined && !wasHostRef.current) {
      useToastStore.getState().show('방장이 되었습니다')
    }
    wasHostRef.current = isHost ?? false
  }, [roomState?.hostId, myId, roomState?.players])

  const maxPlayers = roomState?.config.playerCountMax ?? 6
  const numColumns = getNumColumns(maxPlayers)

  const slots: SlotItem[] = Array.from({ length: maxPlayers }, (_, i) => {
    return roomState?.players.find((p) => p.slot === i) ?? null
  })

  const me = roomState?.players.find((p) => p.id === myId)
  const isHost = me?.isHost ?? false
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
      {/* 헤더: 방제목+자물쇠(왼쪽) | 방코드+복사+설정(오른쪽) */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.titleGroup}>
            <Text style={styles.title} allowFontScaling={false} numberOfLines={1}>
              {roomState?.title ?? ''}
            </Text>
            <Ionicons
              name={roomState?.locked ? 'lock-closed' : 'lock-open'}
              size={14}
              color={colors.textSecondary}
            />
          </View>
          <View style={styles.codeGroup}>
            <Text style={styles.codeText} allowFontScaling={false}>{code}</Text>
            <Pressable onPress={handleCopyCode} hitSlop={8}>
              <Ionicons name="copy-outline" size={16} color={colors.accentPrimary} />
            </Pressable>
            {isHost && (
              <Pressable onPress={() => setEditVisible(true)} hitSlop={8}>
                <Ionicons name="settings-outline" size={16} color={colors.textSecondary} />
              </Pressable>
            )}
          </View>
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

      <RoomEditModal
        visible={editVisible}
        onClose={() => setEditVisible(false)}
        roomCode={code ?? ''}
      />
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flex: 1,
    marginRight: spacing.sm,
  },
  title: {
    fontFamily: fontFamily.regular,
    fontSize: typography.heading.fontSize,
    lineHeight: typography.heading.lineHeight,
    color: colors.textPrimary,
    flexShrink: 1,
  },
  codeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  codeText: {
    fontFamily: fontFamily.regular,
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    color: colors.textSecondary,
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
