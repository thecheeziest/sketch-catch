import { useCallback, useEffect, useState } from 'react';
import { Alert, Keyboard, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CLIENT_EVENT, type Mode2Phase, type Stroke } from '@sketch-catch/shared';
import { View } from 'dripsy';
import { useHardwareBack } from '@/shared/lib';
import { useTimerFeedback } from '@/shared/lib/useTimerFeedback';
import { useAuthStore, useRoomStore } from '@/shared/model';
import { Button } from '@/shared/ui/Button';
import { PixelLoadingSpinner } from '@/shared/ui/PixelLoadingSpinner';
import { gameSurface, gameText } from '@/features/game/config';
import { useGameKeyboardLayout } from '@/features/game/lib/useGameKeyboardLayout';
import {
  CanvasStage,
  ChatInputBar,
  CustomPromptModal,
  DrawingCanvas,
  GameHeader,
  ResultOverlay,
  ToolbarRow,
} from '@/features/game/ui';
import { PromptWaitingOverlay } from '@/features/game/ui/PromptWaitingOverlay';
import { ReferenceCanvas, useDraftSync, useMode2Sender, useMode2Store } from '@/features/mode2';

const MAX_TEXT_LENGTH = 40;
const SUBMIT_BUTTON_WIDTH = 64;
// 마감이 지났는데도 다음 단계가 오지 않으면(네트워크 유실 등) 재입장으로 현재 단계를 다시 받는다
const STEP_RESYNC_DELAY_MS = 4000;

const WAITING_TEXT: Record<Mode2Phase, { title: string; message: string }> = {
  PROMPT: { title: '제시어 입력 중..', message: '친구들이 제시어를 입력하고 있어요' },
  DRAW: { title: '그리기를 기다리는 중..', message: '친구들이 아직 그리고 있어요' },
  ANSWER: { title: '정답 입력을 기다리는 중..', message: '친구들이 아직 정답을 고민하고 있어요' },
};

function useSecondsLeft(deadline: number | undefined, durationSec: number): number {
  const [secondsLeft, setSecondsLeft] = useState(durationSec);
  useEffect(() => {
    if (deadline === undefined) return;
    const tick = (): void =>
      setSecondsLeft(Math.min(durationSec, Math.max(0, Math.ceil((deadline - Date.now()) / 1000))));
    tick();
    const timer = setInterval(tick, 250);
    return () => clearInterval(timer);
  }, [deadline, durationSec]);
  return secondsLeft;
}

export default function Mode2Screen() {
  const router = useRouter();
  const { code } = useLocalSearchParams<{ code: string }>();
  const myId = useAuthStore.getState().user?.id ?? '';
  const socket = useRoomStore(s => s.socket);
  const roomState = useRoomStore(s => s.roomState);
  const gameId = useMode2Store(s => s.gameId);
  const step = useMode2Store(s => s.step);
  const stepTiming = useMode2Store(s => s.stepTiming);
  const myStrokesLength = useMode2Store(s => s.myStrokes.length);
  const { submitPrompt, submitDraw, submitAnswer } = useMode2Sender();
  const keyboardLayout = useGameKeyboardLayout();

  const stepKey = `${gameId}:${step?.stepIndex ?? -1}`;
  const syncDraft = useDraftSync(step?.sheetId, stepKey);
  const [submitted, setSubmitted] = useState(false);
  const [myPrompt, setMyPrompt] = useState<string | null>(null);
  const [cueVisible, setCueVisible] = useState(false);
  const timeLeft = useSecondsLeft(stepTiming?.deadline, step?.durationSec ?? 0);

  // 모드2 이벤트 리스너·스토어 초기화는 room/[code]/_layout과 gameId 변경 시점에 처리된다
  useEffect(() => {
    if (roomState?.status === 'MODE2_REVIEW') {
      router.replace(`/room/${code}/mode2-review` as never);
    } else if (roomState?.status === 'AWARD') {
      // 공개식을 놓친 채 끝난 경우는 공개식 화면(다시 보기)으로, 참가자 이탈 강제종료는 시상식으로
      const target = useMode2Store.getState().review ? 'mode2-review' : 'award';
      router.replace(`/room/${code}/${target}` as never);
    }
  }, [roomState?.status, code, router]);

  // 단계 전환 시 로컬 입력/제출 상태 초기화 — myStrokes도 비워 이전 DRAW 단계의 stroke가
  // 제출되는 것을 막는다 (DrawingCanvas는 key로 remount되지만 store는 유지되므로)
  useEffect(() => {
    setSubmitted(false);
    useMode2Store.getState().setMyStrokes([]);
    if (step?.stepIndex === 0) setMyPrompt(null);
    const cueMs = (stepTiming?.cueUntil ?? 0) - Date.now();
    setCueVisible(step?.phase === 'DRAW' && cueMs > 200);
    // stepTiming은 같은 단계 재전송(재입장)에도 바뀌므로 단계 번호 기준으로만 초기화한다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepKey]);

  const isExpired = step != null && timeLeft === 0 && !cueVisible;
  useEffect(() => {
    if (!isExpired || !socket || !code) return;
    const timer = setTimeout(() => socket.emit(CLIENT_EVENT.ROOM_JOIN, { code }), STEP_RESYNC_DELAY_MS);
    return () => clearTimeout(timer);
  }, [isExpired, socket, code, stepKey]);

  useTimerFeedback(timeLeft, `${gameId}:mode2:${step?.stepIndex}`, step != null && !submitted && !cueVisible);

  const handleExitAttempt = useCallback((): void => {
    Alert.alert('게임에서 나가기', '게임을 나가면 현재 진행 중인 시트가 비어있는 상태로 처리됩니다. 계속할까요?', [
      { text: '계속 플레이', style: 'cancel' },
      {
        text: '나가기',
        style: 'destructive',
        onPress: () => {
          socket?.emit(CLIENT_EVENT.ROOM_LEAVE);
          router.replace('/(tabs)/' as never);
        },
      },
    ]);
  }, [socket, router]);

  // Android 하드웨어 뒤로가기 — 나가기 확인 (iOS 스와이프는 레이아웃에서 차단)
  useHardwareBack(handleExitAttempt);

  const handleStrokesChange = useCallback(
    (strokes: Stroke[]): void => {
      useMode2Store.getState().setMyStrokes(strokes);
      syncDraft({ strokes });
    },
    [syncDraft],
  );

  const handleTextChange = useCallback((text: string): void => syncDraft({ text }), [syncDraft]);
  const handleCueDismiss = useCallback((): void => setCueVisible(false), []);

  if (!step) {
    return (
      <SafeAreaView style={[styles.container, styles.center]} edges={['top', 'bottom', 'left', 'right']}>
        <PixelLoadingSpinner size={40} accessibilityLabel="다음 단계를 불러오는 중" />
      </SafeAreaView>
    );
  }

  const showWaiting = submitted || isExpired;
  const previousText = step.previousContent?.kind === 'TEXT' ? step.previousContent.text : '';
  const previousStrokes = step.previousContent?.kind === 'DRAW' ? step.previousContent.strokes : [];
  const drawWord = previousText || '???';
  const canDraw = step.phase === 'DRAW' && !showWaiting && !cueVisible;
  const isAnswerInput = step.phase === 'ANSWER';

  const handleTextSubmit = (text: string): boolean => {
    if (showWaiting) return false;
    const sent = step.phase === 'PROMPT' ? submitPrompt(step.sheetId, text) : submitAnswer(step.sheetId, text);
    if (!sent) return false;
    Keyboard.dismiss();
    setSubmitted(true);
    if (step.phase === 'PROMPT') setMyPrompt(text.trim());
    return true;
  };

  const handleSubmitDrawing = (): void => {
    if (!canDraw) return;
    if (submitDraw(step.sheetId, useMode2Store.getState().myStrokes)) setSubmitted(true);
  };

  // 제시어 바: 그리기는 그릴 단어, 제시어 단계는 내가 낸 제시어, 정답 단계는 비공개(빈칸)
  const word = (() => {
    if (step.phase === 'DRAW') return drawWord;
    if (step.phase === 'PROMPT') return myPrompt;
    return null;
  })();

  const submitAction =
    step.phase === 'DRAW' ? (
      <Button
        label={submitted ? '완료' : '제출'}
        color="primary"
        height={28}
        style={{ width: SUBMIT_BUTTON_WIDTH }}
        disabled={!canDraw || myStrokesLength === 0}
        onPress={handleSubmitDrawing}
      />
    ) : undefined;

  const waitingText = WAITING_TEXT[step.phase];

  return (
    <SafeAreaView
      style={styles.container}
      edges={['top', 'bottom', 'left', 'right']}
      onLayout={e => keyboardLayout.onViewportLayout(e.nativeEvent.layout.height)}
    >
      <View
        style={{
          // 정답 입력 중 키보드가 가리는 만큼 레이아웃 높이를 줄여 입력창이 키보드 바로 위에 오게 한다
          height: keyboardLayout.contentHeight - (isAnswerInput ? keyboardLayout.keyboardOffset : 0),
        }}
      >
        <GameHeader
          roundIndex={Math.floor(step.stepIndex / 2)}
          totalTurns={Math.max(1, step.totalSteps / 2)}
          timeLeft={timeLeft}
          word={word}
          wordColor={step.phase === 'DRAW' ? gameText.WORD : gameText.PRIMARY}
          collapsed={isAnswerInput && keyboardLayout.keyboardVisible}
          playerCount={roomState?.players.filter(p => !p.left).length ?? 0}
          maxPlayers={roomState?.config.playerCountMax ?? 12}
          wordAction={submitAction}
          wordActionWidth={submitAction ? SUBMIT_BUTTON_WIDTH + 8 : 0}
          onBack={handleExitAttempt}
        />

        <View sx={{ flex: 1, position: 'relative' }}>
          <CanvasStage>
            {step.phase === 'DRAW' ? (
              <DrawingCanvas
                isDrawer
                drawingEnabled={canDraw}
                key={`draw-${stepKey}`}
                onStrokesChange={handleStrokesChange}
              />
            ) : (
              <ReferenceCanvas
                key={`reference-${stepKey}`}
                strokes={isAnswerInput ? previousStrokes : []}
                emptyLabel={isAnswerInput ? '제출된 그림이 없어요' : undefined}
              />
            )}
            {/* 제출 후에는 수정할 수 없음을 보여 주도록 스케치북을 흐리게 덮고 터치를 막는다 */}
            {step.phase === 'DRAW' && showWaiting && <View style={styles.lockedSketchbook} />}
          </CanvasStage>
          {showWaiting && <PromptWaitingOverlay title={waitingText.title} message={waitingText.message} />}
          {cueVisible && stepTiming && (
            <ResultOverlay
              key={`cue-${stepKey}`}
              data={{
                kind: 'cue',
                id: `cue-${stepKey}`,
                word: drawWord,
                message: '그려 주세요!',
                characterId: roomState?.players.find(p => p.id === myId)?.characterId ?? '',
                durationMs: Math.max(0, stepTiming.cueUntil - Date.now()),
              }}
              onDismiss={handleCueDismiss}
            />
          )}
        </View>

        {step.phase === 'DRAW' && (
          <View pointerEvents={canDraw ? 'auto' : 'none'} style={!canDraw && styles.disabledToolbar}>
            <ToolbarRow realtime={false} />
          </View>
        )}

        {isAnswerInput && (
          <ChatInputBar
            isDrawer={false}
            resetKey={stepKey}
            onSend={handleTextSubmit}
            onChangeText={handleTextChange}
            maxLength={MAX_TEXT_LENGTH}
            disabled={showWaiting}
            placeholder={submitted ? '제출 완료! 수정할 수 없어요' : '이 그림은 뭘까요?'}
          />
        )}
      </View>

      <CustomPromptModal
        visible={step.phase === 'PROMPT' && !showWaiting}
        title="무엇을 그릴까요?"
        guide="친구들이 이어 그릴 제시어를 입력해 주세요"
        expiredMessage="시간 초과! 입력하던 제시어로 넘어가요."
        placeholder="예: 우주를 나는 고양이"
        maxLength={MAX_TEXT_LENGTH}
        endsAt={stepTiming?.deadline}
        onChangeText={handleTextChange}
        onSubmit={handleTextSubmit}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: gameSurface.FRAME,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockedSketchbook: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
  },
  disabledToolbar: {
    opacity: 0.4,
  },
});
