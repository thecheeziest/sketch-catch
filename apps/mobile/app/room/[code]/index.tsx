import { RoomEditModal, SlotCard } from '@/features/room/ui';
import { colors, spacing } from '@/shared/config';
import { useAuthStore, useRoomStore } from '@/shared/model';
import { copyToClipboard } from '@/shared/lib';
import { Button, Icon } from '@/shared/ui';
import type { Player } from '@sketch-catch/shared';
import { CLIENT_EVENT } from '@sketch-catch/shared';
import { FlatList, Text, View } from 'dripsy';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { type ListRenderItem, ImageBackground, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import roomBackground from '@assets/room-background.png';
import { SafeAreaView } from 'react-native-safe-area-context';

function getNumColumns(maxPlayers: number): number {
  if (maxPlayers <= 4) return 2;
  if (maxPlayers <= 9) return 3;
  return 4;
}

type SlotItem = Player | null;

export default function LobbyScreen() {
  const router = useRouter();
  const { code } = useLocalSearchParams<{ code: string }>();
  const { connect, disconnect, socket, roomState } = useRoomStore();
  const myId = useAuthStore.getState().user?.id;
  const wasHostRef = useRef(false);
  const [editVisible, setEditVisible] = useState(false);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  // MODE1_ROUND_START 시 게임 화면으로 전환
  useEffect(() => {
    if (roomState?.status === 'MODE1_ROUND_START') {
      router.replace(`/room/${code}/game` as never);
    }
  }, [roomState?.status, code, router]);

  useEffect(() => {
    if (!socket || !code) return;
    const handleConnect = (): void => {
      socket.emit(CLIENT_EVENT.ROOM_JOIN, { code });
    };
    if (socket.connected) {
      socket.emit(CLIENT_EVENT.ROOM_JOIN, { code });
      return;
    }
    socket.on('connect', handleConnect);
    return () => {
      socket.off('connect', handleConnect);
    };
  }, [socket, code]);

  useEffect(() => {
    const isHost = roomState?.hostId === myId;
    const hasJoined = Boolean(roomState?.players.find((p) => p.id === myId));
    if (isHost && hasJoined && !wasHostRef.current) {
      useToastStore.getState().show('방장이 되었습니다');
    }
    wasHostRef.current = isHost ?? false;
  }, [roomState?.hostId, myId, roomState?.players]);

  const { width: screenWidth } = useWindowDimensions();
  const maxPlayers = roomState?.config.playerCountMax ?? 6;
  const numColumns = getNumColumns(maxPlayers);
  const cardWidth = Math.floor(
    (screenWidth - spacing.MD * 2 - spacing.XS * 2 * numColumns - spacing.SM * (numColumns - 1)) /
      numColumns,
  );

  const slots: SlotItem[] = Array.from({ length: maxPlayers }, (_, i) => {
    return roomState?.players.find((p) => p.slot === i) ?? null;
  });

  const me = roomState?.players.find((p) => p.id === myId);
  const isHost = me?.isHost ?? false;
  const allReady = roomState?.allReady ?? false;

  const handleCopyCode = (): Promise<void> => copyToClipboard(code ?? '', '코드가 복사되었습니다');

  const renderItem: ListRenderItem<SlotItem> = ({ item }) => (
    <SlotCard player={item} isMe={item?.id === myId} cardWidth={cardWidth} />
  );

  const keyExtractor = (_: unknown, index: number): string => String(index);

  return (
    <ImageBackground source={roomBackground} style={{ flex: 1 }} resizeMode="cover">
    <SafeAreaView
      style={{ flex: 1 }}
      edges={['top', 'bottom', 'left', 'right']}
    >
      <View sx={{ paddingHorizontal: spacing.MD, paddingTop: spacing.MD }}>
        <View sx={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View
            sx={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.XS,
              flex: 1,
              marginRight: spacing.SM,
            }}
          >
            <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
              <Icon name="BACK" size={24} />
            </Pressable>
            <Text
              variant="T2"
              sx={{ color: colors.LIGHT_100, flexShrink: 1 }}
              numberOfLines={1}
            >
              {roomState?.title ?? ''}
            </Text>
            <Icon name={roomState?.locked ? 'LOCK' : 'LOCK_OPEN'} size={14} />
          </View>
          <View sx={{ flexDirection: 'row', alignItems: 'center', gap: spacing.SM }}>
            <Text sx={{ color: colors.GRAY }}>
              {code}
            </Text>
            <Icon name="COPY" size={16} onPress={handleCopyCode} />
            {isHost && <Icon name="SETTINGS" size={16} onPress={() => setEditVisible(true)} />}
          </View>
        </View>
        <View
          sx={{
            borderBottomWidth: 1,
            borderBottomColor: colors.LIGHT_300,
            marginTop: spacing.SM,
            marginBottom: spacing.MD,
          }}
        />
      </View>

      <FlatList
        data={slots}
        keyExtractor={keyExtractor}
        renderItem={renderItem as ListRenderItem<unknown>}
        numColumns={numColumns}
        key={numColumns}
        contentContainerStyle={{ paddingHorizontal: spacing.MD }}
        columnWrapperStyle={numColumns > 1 ? styles.row : undefined}
        style={{ flex: 1 }}
      />

      <View
        sx={{ paddingHorizontal: spacing.MD, paddingTop: spacing.MD, paddingBottom: spacing.LG }}
      >
        {isHost ? (
          <Button
            label="게임 시작"
            color={allReady ? 'primary' : 'light'}
            disabled={!allReady}
            onPress={() => socket?.emit(CLIENT_EVENT.ROOM_START)}
          />
        ) : me?.isReady ? (
          <Button
            label="준비 취소"
            color="light"
            onPress={() => socket?.emit(CLIENT_EVENT.ROOM_READY, { ready: false })}
          />
        ) : (
          <Button
            label="준비 완료"
            color="primary"
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
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.SM },
  backBtn: { marginRight: 4 },
});
