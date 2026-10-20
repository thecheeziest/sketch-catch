import { FeedbackPressable } from '@/shared/ui/FeedbackPressable';
import { useChatSender } from '@/features/game/api/useChatSender';
import { ChatInputBar } from '@/features/game/ui';
import { useRoomChatStore } from '@/features/room/model/useRoomChatStore';
import { InviteModal, LobbyChatLog, PlayerProfileDialog, RoomEditModal, SlotCard } from '@/features/room/ui';
import { colors, getChatTextColor, spacing, textSizes } from '@/shared/config';
import { useAuthStore, useRoomStore, useToastStore } from '@/shared/model';
import { copyToClipboard, useHardwareBack } from '@/shared/lib';
import { Button, FlatList, Icon, PixelFrame, SketchbookLoadingSpinner } from '@/shared/ui';
import type { ChatMessage, Player } from '@sketch-catch/shared';
import { CLIENT_EVENT, MODE2_PLAYER_MIN, ROOM_PLAYER_MIN } from '@sketch-catch/shared';
import { Text, View } from 'dripsy';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { type ListRenderItem, Alert, ImageBackground, KeyboardAvoidingView, Platform, StyleSheet, useWindowDimensions } from 'react-native';
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
  const socket = useRoomStore(s => s.socket);
  const roomState = useRoomStore(s => s.roomState);
  const joinError = useRoomStore(s => s.joinError);
  const myId = useAuthStore.getState().user?.id;
  const wasHostRef = useRef(false);
  const rejoinedRef = useRef(false);
  const [editVisible, setEditVisible] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [profileTarget, setProfileTarget] = useState<Player | null>(null);
  const lobbyMessages = useRoomChatStore(s => s.lobbyMessages);
  const { sendChat } = useChatSender();

  const goHome = (): void => {
    router.replace('/(tabs)/' as never);
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
    router.replace('/(tabs)/' as never);
  }, [joinError, router]);

  // 시상식 만료 직후 [한번 더!]로 들어온 경우 등 대기실 명단에 내가 없으면 1회 재입장
  const isMember = roomState?.players.some(p => p.id === myId) ?? false;
  useEffect(() => {
    if (!roomState || isMember || rejoinedRef.current || roomState.status !== 'LOBBY') return;
    rejoinedRef.current = true;
    socket?.emit(CLIENT_EVENT.ROOM_JOIN, { code });
  }, [roomState, isMember, socket, code]);

  useEffect(() => {
    const hostId = roomState?.hostId;
    if (!hostId) return;
    const isHost = hostId === myId;
    if (isHost && !wasHostRef.current) {
      useToastStore.getState().show('방장이 되었습니다');
    }
    // 방장을 넘긴 뒤 다시 돌려받을 때도 안내되도록 현재 상태를 그대로 기억한다
    wasHostRef.current = isHost;
  }, [roomState?.hostId, myId]);

  const { width: screenWidth } = useWindowDimensions();
  const maxPlayers = roomState?.config.playerCountMax ?? 6;
  const penalty = roomState?.config.penalty;
  const numColumns = getNumColumns(maxPlayers);
  const cardWidth = Math.floor(
    (screenWidth - spacing.MD * 2 - spacing.XS * 2 * numColumns - spacing.SM * (numColumns - 1)) / numColumns,
  );

  // 시상식에 남은 방장은 흐리게 표시해 슬롯에 남긴다 (재촉하기 대상)
  const connectedPlayers = roomState?.players.filter(p => !p.inAward || p.id === roomState.hostId) ?? [];
  const slots: SlotItem[] = [
    ...connectedPlayers,
    ...Array<null>(Math.max(0, maxPlayers - connectedPlayers.length)).fill(null),
  ];

  const me = roomState?.players.find(p => p.id === myId);
  const isHost = me?.isHost ?? false;
  const allReady = roomState?.allReady ?? false;
  // 다른 참가자가 아직 시상식에 있는 동안(status=AWARD)은 준비·시작 불가
  const isAwardInProgress = roomState?.status === 'AWARD';
  const connectedPlayerCount = roomState?.players.filter(p => p.connected && !p.inAward).length ?? 0;
  const minPlayers = roomState?.mode === 2 ? MODE2_PLAYER_MIN : ROOM_PLAYER_MIN;
  const hasEnoughPlayers = connectedPlayerCount >= minPlayers;
  const canStartGame = allReady && hasEnoughPlayers && !isAwardInProgress;
  const startButtonLabel = '게임 시작';
  // 방장이 아직 시상식에 있으면 대기실에서는 시작할 수 없다 (방장이 한번 더를 누르거나 나가면 해소)
  const isHostInAward = roomState?.players.some(p => p.id === roomState.hostId && p.inAward === true) ?? false;
  // 메시지에 담긴 보낸 시점의 모습을 우선한다 — 나간 유저는 players에 없다
  const characterIdOf = (message: ChatMessage): string =>
    message.characterId ?? roomState?.players.find(p => p.id === message.userId)?.characterId ?? '';
  const chatColorOf = (message: ChatMessage): string | null =>
    getChatTextColor(
      message.chatColorId !== undefined
        ? message.chatColorId
        : roomState?.players.find(p => p.id === message.userId)?.chatColorId,
    );

  const handleNudge = (): void => {
    socket?.emit(CLIENT_EVENT.ROOM_NUDGE);
  };

  const canTransferHost = isHost && roomState?.status === 'LOBBY';
  const handleTransferHost = (player: Player): void => {
    socket?.emit(CLIENT_EVENT.ROOM_HOST_TRANSFER, { targetId: player.id });
  };

  const handleCopyCode = (): Promise<void> => copyToClipboard(code ?? '', '코드가 복사되었습니다');

  const renderItem: ListRenderItem<SlotItem> = ({ item }) => {
    const isMe = item?.id === myId;
    return (
      <SlotCard
        player={item}
        isMe={isMe}
        cardWidth={cardWidth}
        onPress={item && !isMe ? () => setProfileTarget(item) : undefined}
        onNudge={item?.inAward === true && item.isHost ? handleNudge : undefined}
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
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom', 'left', 'right']}>
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
              <FeedbackPressable onPress={handleExitAttempt} hitSlop={8} style={styles.backBtn} feedback="cancel">
                <Icon name="BACK" size={24} />
              </FeedbackPressable>
              <Text variant="T2" sx={{ color: colors.LIGHT_100, flexShrink: 1 }} numberOfLines={1}>
                {roomState?.title ?? ''}
              </Text>
              <Icon name={roomState?.locked ? 'LOCK' : 'LOCK_OPEN'} size={14} />
            </View>
            <View sx={{ flexDirection: 'row', alignItems: 'center', gap: spacing.SM }}>
              <Text sx={{ color: colors.GRAY }}>{code}</Text>
              <Icon name="COPY" size={16} onPress={handleCopyCode} />
              {roomState?.status === 'LOBBY' && (
                <FeedbackPressable onPress={() => setInviteOpen(true)} hitSlop={12}>
                  <Icon name="INVITE" size={20} color={colors.LIGHT_100} />
                </FeedbackPressable>
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
          {penalty && (
            <View sx={{ marginBottom: spacing.MD }}>
              <PixelFrame borderColor={colors.WARNING_300} borderWidth={2} style={StyleSheet.absoluteFill}>
                <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.BLACK }]} />
              </PixelFrame>
              <View sx={{ flexDirection: 'row', alignItems: 'center', gap: spacing.SM, padding: spacing.SM }}>
                <Text variants={['bold', 'B3']} sx={{ color: colors.WARNING_300 }}>
                  벌칙 · 꼴찌 {penalty.loserCount}명
                </Text>
                <Text sx={{ ...textSizes.B3, color: colors.LIGHT_100, flex: 1 }} numberOfLines={1}>
                  {penalty.text}
                </Text>
              </View>
            </View>
          )}
        </View>

        <FlatList
          data={slots}
          keyExtractor={keyExtractor}
          renderItem={renderItem as ListRenderItem<unknown>}
          numColumns={numColumns}
          key={numColumns}
          contentContainerStyle={{ paddingHorizontal: spacing.MD }}
          columnWrapperStyle={numColumns > 1 ? styles.row : undefined}
          style={styles.slotList}
        />

        <LobbyChatLog messages={lobbyMessages} characterIdOf={characterIdOf} chatColorOf={chatColorOf} />

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {isHostInAward && !isHost && (
            <Text sx={{ ...textSizes.B3, color: colors.LIGHT_100, textAlign: 'center', paddingTop: spacing.XS }}>
              방장이 시상식에서 돌아오면 시작할 수 있어요
            </Text>
          )}

          <View sx={{ paddingHorizontal: spacing.MD, paddingTop: spacing.SM, paddingBottom: spacing.SM }}>
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
                feedback={false}
                color="light"
                disabled={isAwardInProgress}
                onPress={() => socket?.emit(CLIENT_EVENT.ROOM_READY, { ready: false })}
              />
            ) : (
              <Button
                label={isAwardInProgress ? '시상 진행 중..' : '준비 완료'}
                feedback={false}
                color="primary"
                disabled={isAwardInProgress}
                onPress={() => socket?.emit(CLIENT_EVENT.ROOM_READY, { ready: true })}
              />
            )}
          </View>

          <View sx={{ paddingHorizontal: spacing.MD, paddingBottom: spacing.MD }}>
            <ChatInputBar isDrawer={false} onSend={sendChat} placeholder="채팅을 입력하세요" />
          </View>
        </KeyboardAvoidingView>

        <RoomEditModal visible={editVisible} onClose={() => setEditVisible(false)} roomCode={code ?? ''} />

        <InviteModal visible={inviteOpen} onClose={() => setInviteOpen(false)} code={code ?? ''} />

        <PlayerProfileDialog
          player={profileTarget}
          onClose={() => setProfileTarget(null)}
          onTransferHost={canTransferHost ? handleTransferHost : undefined}
        />
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.SM },
  slotList: { flexGrow: 0, flexShrink: 1 },
  backBtn: { marginRight: 4 },
});
