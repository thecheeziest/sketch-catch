import { InviteModal, PlayerProfileDialog, RoomEditModal, SlotCard } from '@/features/room/ui';
import { colors, spacing, textSizes } from '@/shared/config';
import { useAuthStore, useRoomStore, useToastStore } from '@/shared/model';
import { copyToClipboard, useHardwareBack } from '@/shared/lib';
import { Button, FlatList, Icon, SketchbookLoadingSpinner } from '@/shared/ui';
import type { Player } from '@sketch-catch/shared';
import { CLIENT_EVENT, MODE2_PLAYER_MIN, ROOM_PLAYER_MIN } from '@sketch-catch/shared';
import { Text, View } from 'dripsy';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { type ListRenderItem, Alert, ImageBackground, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
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
  const joinError = useRoomStore((s) => s.joinError);
  const myId = useAuthStore.getState().user?.id;
  const wasHostRef = useRef(false);
  const rejoinedRef = useRef(false);
  const [editVisible, setEditVisible] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [profileTarget, setProfileTarget] = useState<Player | null>(null);

  const goHome = (): void => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)' as never);
  };

  // 대기실 이탈(헤더 뒤로가기·Android 하드웨어 뒤로가기)은 확인 후 퇴장 — 방 만들기 화면이 아니라 홈으로 간다
  // (iOS 스와이프는 레이아웃에서 차단)
  const handleExitAttempt = (): void => {
    Alert.alert('대기실 나가기', '대기실에서 나가시겠어요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '나가기',
        style: 'destructive',
        onPress: () => {
          socket?.emit(CLIENT_EVENT.ROOM_LEAVE);
          goHome();
        },
      },
    ]);
  };
  useHardwareBack(handleExitAttempt);

  // MODE1_ROUND_START 시 게임 화면으로, MODE2_PROMPT_PHASE 시 모드2 화면으로 전환
  useEffect(() => {
    if (roomState?.status === 'MODE1_ROUND_START') {
      router.replace(`/room/${code}/game` as never);
    } else if (roomState?.mode === 2 && roomState?.status === 'MODE2_PROMPT_PHASE') {
      router.replace(`/room/${code}/mode2` as never);
    }
  }, [roomState?.status, roomState?.mode, code, router]);

  // 입장이 거절되면(진행 중인 방·없는 방 등) 안내 토스트(소켓 에러)와 함께 홈으로
  useEffect(() => {
    if (!joinError) return;
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)' as never);
  }, [joinError, router]);

  // 시상식 만료 직후 [한번 더!]로 들어온 경우 등 대기실 명단에 내가 없으면 1회 재입장
  const isMember = roomState?.players.some((p) => p.id === myId) ?? false;
  useEffect(() => {
    if (!roomState || isMember || rejoinedRef.current || roomState.status !== 'LOBBY') return;
    rejoinedRef.current = true;
    socket?.emit(CLIENT_EVENT.ROOM_JOIN, { code });
  }, [roomState, isMember, socket, code]);

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
  // 다른 참가자가 아직 시상식에 있는 동안(status=AWARD)은 준비·시작 불가
  const isAwardInProgress = roomState?.status === 'AWARD';
  const connectedPlayerCount = roomState?.players.filter((p) => p.connected).length ?? 0;
  const minPlayers = roomState?.mode === 2 ? MODE2_PLAYER_MIN : ROOM_PLAYER_MIN;
  const hasEnoughPlayers = connectedPlayerCount >= minPlayers;
  const canStartGame = allReady && hasEnoughPlayers && !isAwardInProgress;
  const startButtonLabel = (() => {
    if (isAwardInProgress) return '시상 진행 중..';
    if (!hasEnoughPlayers) return `최소 ${minPlayers}명 필요`;
    return '게임 시작';
  })();

  const handleCopyCode = (): Promise<void> => copyToClipboard(code ?? '', '코드가 복사되었습니다');

  const renderItem: ListRenderItem<SlotItem> = ({ item }) => {
    const isMe = item?.id === myId;
    return (
      <SlotCard
        player={item}
        isMe={isMe}
        cardWidth={cardWidth}
        onPress={item && !isMe ? () => setProfileTarget(item) : undefined}
      />
    );
  };

  const keyExtractor = (item: SlotItem, index: number): string => item?.id ?? `empty-${index}`;

  // 내가 포함된 room:state를 받기 전까지는 빈 대기실 대신 입장 중 안내
  if (!roomState || !isMember) {
    return (
      <ImageBackground source={roomBackground} style={{ flex: 1 }} resizeMode="cover">
        <View sx={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.MD }}>
          <SketchbookLoadingSpinner size={200} accessibilityLabel="대기실 입장 중" />
          <Text sx={{ ...textSizes.B2, color: colors.LIGHT_100 }}>대기실에 입장하고 있어요...</Text>
        </View>
      </ImageBackground>
    );
  }

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
            <Pressable onPress={handleExitAttempt} hitSlop={8} style={styles.backBtn}>
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
            disabled={isAwardInProgress}
            onPress={() => socket?.emit(CLIENT_EVENT.ROOM_READY, { ready: false })}
          />
        ) : (
          <Button
            label={isAwardInProgress ? '시상 진행 중..' : '준비 완료'}
            color="primary"
            disabled={isAwardInProgress}
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

      <PlayerProfileDialog player={profileTarget} onClose={() => setProfileTarget(null)} />
    </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.SM },
  backBtn: { marginRight: 4 },
});
