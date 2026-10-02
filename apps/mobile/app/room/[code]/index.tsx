import { InviteModal, RoomEditModal, SlotCard } from '@/features/room/ui';
import { colors, spacing } from '@/shared/config';
import { useAuthStore, useRoomStore, useToastStore } from '@/shared/model';
import { copyToClipboard } from '@/shared/lib';
import { Button, FlatList, Icon } from '@/shared/ui';
import type { Player } from '@sketch-catch/shared';
import { CLIENT_EVENT, MODE2_PLAYER_MIN } from '@sketch-catch/shared';
import { Text, View } from 'dripsy';
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
  const socket = useRoomStore((s) => s.socket);
  const roomState = useRoomStore((s) => s.roomState);
  const myId = useAuthStore.getState().user?.id;
  const wasHostRef = useRef(false);
  const [editVisible, setEditVisible] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);

  // MODE1_ROUND_START 시 게임 화면으로, MODE2_PROMPT_PHASE 시 모드2 화면으로 전환
  useEffect(() => {
    if (roomState?.status === 'MODE1_ROUND_START') {
      router.replace(`/room/${code}/game` as never);
    } else if (roomState?.mode === 2 && roomState?.status === 'MODE2_PROMPT_PHASE') {
      router.replace(`/room/${code}/mode2` as never);
    }
  }, [roomState?.status, roomState?.mode, code, router]);

  useEffect(() => {
    if (!socket || !code) return;
    const handleConnect = (): void => {
      socket.emit(CLIENT_EVENT.ROOM_JOIN, { code });
    };
    socket.on('connect', handleConnect);
    if (socket.connected) handleConnect();
    return () => {
      socket.off('connect', handleConnect);
    };
  }, [socket, code]);

  useEffect(() => {
    const isHost = roomState?.hostId === myId;
    if (isHost && !wasHostRef.current) {
      useToastStore.getState().show('방장이 되었습니다');
      wasHostRef.current = true;
    }
  }, [roomState?.hostId, myId]);

  const { width: screenWidth } = useWindowDimensions();
  const maxPlayers = roomState?.config.playerCountMax ?? 6;
  const numColumns = getNumColumns(maxPlayers);
  const cardWidth = Math.floor(
    (screenWidth - spacing.MD * 2 - spacing.XS * 2 * numColumns - spacing.SM * (numColumns - 1)) /
      numColumns,
  );

  const connectedPlayers = roomState?.players ?? [];
  const slots: SlotItem[] = [
    ...connectedPlayers,
    ...Array<null>(Math.max(0, maxPlayers - connectedPlayers.length)).fill(null),
  ];

  const me = roomState?.players.find((p) => p.id === myId);
  const isHost = me?.isHost ?? false;
  const allReady = roomState?.allReady ?? false;
  const connectedPlayerCount = roomState?.players.filter((p) => p.connected).length ?? 0;
  const hasEnoughMode2Players = roomState?.mode !== 2 || connectedPlayerCount >= MODE2_PLAYER_MIN;
  const canStartGame = allReady && hasEnoughMode2Players;
  const startButtonLabel = (() => {
    if (roomState?.mode === 2 && !hasEnoughMode2Players) {
      return `최소 ${MODE2_PLAYER_MIN}명 필요`;
    }
    return '게임 시작';
  })();

  const handleCopyCode = (): Promise<void> => copyToClipboard(code ?? '', '코드가 복사되었습니다');

  const renderItem: ListRenderItem<SlotItem> = ({ item }) => (
    <SlotCard player={item} isMe={item?.id === myId} cardWidth={cardWidth} />
  );

  const keyExtractor = (item: SlotItem, index: number): string => item?.id ?? `empty-${index}`;

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
            <Pressable
              onPress={() => {
                socket?.emit(CLIENT_EVENT.ROOM_LEAVE);
                router.back();
              }}
              hitSlop={8}
              style={styles.backBtn}
            >
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
            {roomState?.status === 'LOBBY' && (
              <Pressable onPress={() => setInviteOpen(true)} hitSlop={12}>
                <Icon name="INVITE" size={20} color={colors.LIGHT_100} />
              </Pressable>
            )}
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
            label={startButtonLabel}
            color={canStartGame ? 'primary' : 'light'}
            disabled={!canStartGame}
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

      <InviteModal
        visible={inviteOpen}
        onClose={() => setInviteOpen(false)}
        code={code ?? ''}
      />
    </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.SM },
  backBtn: { marginRight: 4 },
});
