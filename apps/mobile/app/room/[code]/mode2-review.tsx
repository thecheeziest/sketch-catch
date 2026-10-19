import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Keyboard, KeyboardAvoidingView, Linking, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, View } from 'dripsy';
import { useLocalSearchParams } from 'expo-router';
import { colors, fontFamily, getChatTextColor, spacing, textSizes } from '@/shared/config';
import { useAuthStore, useRoomStore, useToastStore } from '@/shared/model';
import { Button } from '@/shared/ui/Button';
import { Dialog } from '@/shared/ui/Dialog';
import { gameSurface } from '@/features/game/config';
import { useChatSender } from '@/features/game/api/useChatSender';
import { CanvasStage, ChatInputBar, ChatStream } from '@/features/game/ui';
import { useRoomChatStore } from '@/features/room/model/useRoomChatStore';
import { useAwardSession } from '@/features/room/lib';
import { CoinRewardChip, useCoinRewardStore } from '@/features/shop';
import { ReferenceCanvas, useGifDownload, useMode2Store } from '@/features/mode2';
import { useRevealPlayback } from '@/features/mode2/lib/useRevealPlayback';
import { PixelSpeechBubble } from '@/features/mode2/ui/PixelSpeechBubble';
import { RevealCharacterRow, type RevealSaveState } from '@/features/mode2/ui/RevealCharacterRow';
import { RevealGuesser } from '@/features/mode2/ui/RevealGuesser';
import { RevealPainter } from '@/features/mode2/ui/RevealPainter';
import { ReplayGuideTooltip } from '@/features/mode2/ui/ReplayGuideTooltip';

// 맞히는 사람 영역 높이 고정 — 원조자 발표 중에 비어 있어도 스케치북 크기가 흔들리지 않게 한다
const GUESSER_AREA_HEIGHT = 112;

// 모드 2의 시상식 = 정답 공개식. 실시간으로 함께 본 뒤(AWARD), 캐릭터를 눌러 다시 보고 GIF로 저장한다.
export default function Mode2ReviewScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const myId = useAuthStore(s => s.user?.id) ?? '';
  const liveRoomState = useRoomStore(s => s.roomState);
  // 공개식 화면은 이후 대기실·새 게임 상태가 도착해도 이번 판의 참가자 구성을 유지한다
  const [roomSnapshot] = useState(() => useRoomStore.getState().roomState);
  const review = useMode2Store(s => s.review);
  const reviewEntryStartAt = useMode2Store(s => s.reviewEntryStartAt);
  const gifs = useMode2Store(s => s.gifs);
  const chatMessages = useRoomChatStore(s => s.awardMessages);
  const coinReward = useCoinRewardStore(s => s.reward);
  const { sendChat } = useChatSender();
  const { saveGif } = useGifDownload();
  const { rematch, exit, rematching, rematchError } = useAwardSession(code ?? '');
  const { scene, isLive, isFinished, startReplay } = useRevealPlayback(review, reviewEntryStartAt);

  const [guideVisible, setGuideVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  // 실시간 발표가 모두 끝난 순간 한 번 다시 보기 안내를 띄운다
  useEffect(() => {
    if (isFinished) setGuideVisible(true);
  }, [isFinished]);

  const players = useMemo(
    () => [...(roomSnapshot?.players ?? [])].sort((a, b) => a.slot - b.slot),
    [roomSnapshot?.players],
  );
  const characterOf = (userId: string | null | undefined): string =>
    players.find(p => p.id === userId)?.characterId ?? '';

  const isInAwardRoster = liveRoomState?.players.some(p => p.id === myId && p.inAward === true) ?? false;
  // 새 게임이 시작되면 시상식 유저는 명단에서 빠져 awardViewers로 옮겨진다 - 채팅은 계속 가능, 한번 더는 불가
  const isAwardViewer = liveRoomState?.awardViewers?.some(p => p.id === myId) ?? false;
  const canChat = isInAwardRoster || isAwardViewer;
  const canRematch =
    isFinished && isInAwardRoster && (liveRoomState?.status === 'AWARD' || liveRoomState?.status === 'LOBBY');

  const displayedSheetId = scene ? review?.sheets[scene.sheetIndex]?.sheetId : undefined;
  const saveState: RevealSaveState = (() => {
    if (saving) return 'saving';
    if (!isFinished || !displayedSheetId || !gifs[displayedSheetId]) return 'disabled';
    return 'ready';
  })();

  const handleSelect = useCallback(
    (playerId: string): void => {
      const sheetIndex = review?.sheets.findIndex(sheet => sheet.ownerId === playerId) ?? -1;
      if (sheetIndex < 0) return;
      setGuideVisible(false);
      startReplay(sheetIndex);
    },
    [review?.sheets, startReplay],
  );

  const handleSave = async (): Promise<void> => {
    if (!displayedSheetId || saving) return;
    setSaving(true);
    try {
      await saveGif(displayedSheetId);
      useToastStore.getState().show('저장 완료! 갤러리에서 확인하세요', 'success');
    } catch (error) {
      if (error instanceof Error && error.message === 'MEDIA_PERMISSION_DENIED') {
        Alert.alert('사진 접근 권한이 필요해요', '설정에서 사진 접근을 허용하면 GIF를 저장할 수 있어요.', [
          { text: '닫기', style: 'cancel' },
          { text: '설정으로 이동', onPress: () => void Linking.openSettings() },
        ]);
      } else {
        useToastStore.getState().show('저장에 실패했어요. 잠시 후 다시 시도해 주세요', 'error');
      }
    } finally {
      setSaving(false);
    }
  };

  // 채팅 스트림 — 게임 진행 중과 동일하게 우상단에 말풍선으로 표시 (정답 판정 없는 자유 채팅)
  const streamItems = useMemo(
    () =>
      chatMessages.slice(-5).map(m => ({
        id: m.id,
        nickname: m.nickname,
        text: m.text,
        characterId: players.find(p => p.id === m.userId)?.characterId ?? '',
        textColor: getChatTextColor(players.find(p => p.id === m.userId)?.chatColorId),
        isCorrect: false,
        createdAt: m.createdAt,
      })),
    [chatMessages, players],
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* 타이틀 + 한번 더 / 나가기 — 모드 1 시상식과 동일 */}
      <View sx={sxStyles.titleRow}>
        <View sx={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.SM }}>
          <Text style={styles.title} sx={{ color: colors.LIGHT_100 }}>
            정답 공개
          </Text>
          {coinReward && coinReward.gameId === roomSnapshot?.gameId && <CoinRewardChip reward={coinReward} />}
        </View>
        <View sx={{ flexDirection: 'row', gap: spacing.XS }}>
          <Button
            label="한번 더!"
            color="primary"
            height={32}
            onPress={rematch}
            loading={rematching}
            disabled={!canRematch}
          />
          <Button label="나가기" color="light" height={32} onPress={exit} />
        </View>
      </View>

      <RevealCharacterRow
        players={players}
        myId={myId}
        highlightedId={scene?.ownerId ?? null}
        selectable={isFinished}
        onSelect={handleSelect}
        saveState={saveState}
        onSave={() => void handleSave()}
      />

      <Pressable style={styles.stage} onPress={Keyboard.dismiss} accessible={false}>
        {scene ? (
          <>
            <View sx={{ alignItems: 'center', gap: 12, paddingHorizontal: spacing.MD, paddingTop: spacing.SM }}>
              <RevealPainter key={scene.ownerId ?? 'owner'} characterId={characterOf(scene.ownerId)} />
              <PixelSpeechBubble text={scene.ownerText} tail="up" />
            </View>

            <View sx={{ flex: 1, paddingHorizontal: spacing.MD, paddingVertical: spacing.SM }}>
              <CanvasStage>
                <ReferenceCanvas strokes={scene.strokes} />
              </CanvasStage>
            </View>

            <View sx={{ height: GUESSER_AREA_HEIGHT, paddingHorizontal: spacing.MD, justifyContent: 'flex-end' }}>
              {scene.guesser && (
                <RevealGuesser
                  key={scene.guesser.authorId}
                  characterId={characterOf(scene.guesser.authorId)}
                  text={scene.guesser.text}
                  icon={scene.guesser.icon}
                />
              )}
            </View>
          </>
        ) : (
          <View sx={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text sx={{ ...textSizes.B1, color: colors.GRAY }}>정답 공개를 준비하고 있어요...</Text>
          </View>
        )}

        {/* 채팅 말풍선 — 게임 진행 화면과 동일하게 우상단에 겹쳐 표시 */}
        <ChatStream items={streamItems} />
        {guideVisible && !isLive && <ReplayGuideTooltip onClose={() => setGuideVisible(false)} />}
      </Pressable>

      <KeyboardAvoidingView behavior="padding">
        <ChatInputBar
          isDrawer={false}
          onSend={sendChat}
          disabled={!canChat}
          placeholder={canChat ? '채팅을 입력하세요' : '채팅할 수 없는 상태예요'}
        />
      </KeyboardAvoidingView>
      <Dialog
        visible={rematchError !== null}
        onClose={() => {}}
        dismissible={false}
        title={rematchError ?? ''}
        buttons={[{ label: '홈으로', color: 'primary', onPress: exit }]}
      />
    </SafeAreaView>
  );
}

const sxStyles = {
  titleRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: spacing.MD,
    paddingVertical: spacing.SM,
  },
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: gameSurface.FRAME,
  },
  stage: {
    flex: 1,
    position: 'relative',
  },
  title: {
    fontFamily: fontFamily.REGULAR,
    ...textSizes.T1,
  },
});
