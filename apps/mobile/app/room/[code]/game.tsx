import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, StyleSheet } from 'react-native';
import { View } from 'dripsy';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CLIENT_EVENT } from '@sketch-catch/shared';
import { colors } from '@/shared/config';
import { useHardwareBack } from '@/shared/lib';
import { useAuthStore, useRoomStore } from '@/shared/model';
import { gameSurface, playerDot, resultOverlay, toolbar } from '@/features/game/config';
import { useGameStore } from '@/features/game/model/useGameStore';
import type { GameResultOverlayData } from '@/features/game/model/resultOverlay';
import { useChatSender } from '@/features/game/api/useChatSender';
import {
  DrawingCanvas,
  GameHeader,
  PlayerGrid,
  ToolbarRow,
  ChatInputBar,
  ChatStream,
  AnswerApprovalButton,
  CustomPromptModal,
} from '@/features/game/ui';
import { ResultOverlay } from '@/features/game/ui/ResultOverlay';

// 라운드 종료 후 다음 라운드(서버 3초 대기)가 이 시간 안에 오지 않으면 서버에 현재 상태를 다시 요청한다
const ROUND_RESYNC_DELAY_MS = 8000;

type InputBarState = {
  disabled: boolean;
  placeholder: string;
  ringColor: string;
  placeholderColor: string;
};

// 결과 오버레이(overlay)와 라운드 종료 상태(roundResult)에 맞춰 채팅 입력창의 테두리·문구를 정한다.
// README-result-overlay.md "부수 상태 변화" 표를 그대로 반영.
function getInputBarState(overlay: GameResultOverlayData | null, roundEnded: boolean, isCorrectEnd: boolean): InputBarState {
  if (roundEnded) {
    if (isCorrectEnd) {
      return {
        disabled: true,
        placeholder: '정답! 다음 라운드 준비중',
        ringColor: playerDot.SOLVED,
        placeholderColor: playerDot.SOLVED,
      };
    }
    return {
      disabled: true,
      placeholder: '라운드 종료',
      ringColor: toolbar.ERASER_RING,
      placeholderColor: resultOverlay.INPUT_ENDED_FG,
    };
  }
  if (overlay?.kind === 'wrong') {
    return {
      disabled: false,
      placeholder: '다시 입력하세요',
      ringColor: resultOverlay.WRONG.ACCENT,
      placeholderColor: resultOverlay.WRONG.CHIP_FG,
    };
  }
  return {
    disabled: false,
    placeholder: '정답을 입력하세요',
    ringColor: toolbar.ERASER_RING,
    placeholderColor: colors.GRAY,
  };
}

export default function GameScreen() {
  // 게임 이벤트 리스너·스토어 초기화는 room/[code]/_layout과 gameId 변경 시점에 처리된다 —
  // 여기서 reset하면 화면 전환 중 먼저 도착한 첫 라운드를 지워 화면이 멈춘다.
  const router = useRouter();
  const { code } = useLocalSearchParams<{ code: string }>();
  const myId = useAuthStore.getState().user?.id ?? '';
  const socket = useRoomStore((s) => s.socket);
  const roomState = useRoomStore((s) => s.roomState);
  const round = useGameStore((s) => s.round);
  const promptForDrawer = useGameStore((s) => s.promptForDrawer);
  const promptHint = useGameStore((s) => s.promptHint);
  const chatMessages = useGameStore((s) => s.chatMessages);
  const correct = useGameStore((s) => s.correct);
  const wrongAnswer = useGameStore((s) => s.wrongAnswer);
  const roundResult = useGameStore((s) => s.roundResult);
  const needsCustomPrompt = useGameStore((s) => s.needsCustomPrompt);
  const isCustomRound = useGameStore((s) => s.isCustomRound);

  const { sendChat, acceptAnswer, submitCustomPrompt } = useChatSender();

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [overlay, setOverlay] = useState<GameResultOverlayData | null>(null);

  const players = roomState?.players ?? [];
  const drawerId = round?.drawerId ?? '';

  useEffect(() => {
    if (roomState?.status === 'AWARD') {
      router.replace(`/room/${code}/award` as never);
    }
  }, [roomState?.status, code, router]);

  // 라운드 시작 시각(클라이언트 기준) — 정답 결과 오버레이의 solveSeconds 계산용
  const roundStartRef = useRef<number>(Date.now());
  const prevRoundIndexRef = useRef<number | null>(null);
  useEffect(() => {
    if (round?.roundIndex !== prevRoundIndexRef.current) {
      prevRoundIndexRef.current = round?.roundIndex ?? null;
      roundStartRef.current = Date.now();
    }
  }, [round?.roundIndex]);

  const overlaySeqRef = useRef(0);

  // 오답 결과 오버레이 — 오답 판정은 제출자 본인에게만 전달되므로 항상 나 자신의 추측
  const prevWrongAnswerRef = useRef<typeof wrongAnswer>(null);
  useEffect(() => {
    if (wrongAnswer === null || wrongAnswer === prevWrongAnswerRef.current) return;
    prevWrongAnswerRef.current = wrongAnswer;
    const msg = chatMessages.find((m) => m.id === wrongAnswer.messageId);
    if (msg === undefined) return;
    overlaySeqRef.current += 1;
    setOverlay({
      kind: 'wrong',
      id: `wrong-${overlaySeqRef.current}`,
      guesserName: msg.nickname,
      guess: msg.text,
      characterId: players.find((p) => p.id === msg.userId)?.characterId ?? '',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wrongAnswer]);

  // 정답 / 게임오버 결과 오버레이 — 라운드 종료(game:round:end) 시점에 판정
  const prevRoundResultRef = useRef<typeof roundResult>(null);
  useEffect(() => {
    if (roundResult === null || roundResult === prevRoundResultRef.current) return;
    prevRoundResultRef.current = roundResult;
    overlaySeqRef.current += 1;

    if (roundResult.correctUserId != null) {
      const winner = players.find((p) => p.id === roundResult.correctUserId);
      const solveSeconds = Math.max(1, Math.round((Date.now() - roundStartRef.current) / 1000));
      setOverlay({
        kind: 'correct',
        id: `correct-${overlaySeqRef.current}`,
        winnerName: winner?.nickname ?? '',
        answer: roundResult.answer,
        score: roundResult.scoreDelta[roundResult.correctUserId] ?? 0,
        solveSeconds,
        characterId: winner?.characterId ?? '',
      });
    } else {
      const drawer = players.find((p) => p.id === drawerId);
      setOverlay({
        kind: 'gameover',
        id: `gameover-${overlaySeqRef.current}`,
        answer: roundResult.answer,
        characterId: drawer?.characterId ?? '',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundResult]);

  const handleDismissOverlay = useCallback((): void => setOverlay(null), []);

  const handleApprove = (messageId: string): void => {
    acceptAnswer(messageId);
    setSelectedUserId(null);
  };

  const handleCustomPromptSubmit = (text: string): void => {
    submitCustomPrompt(text);
    useGameStore.setState({ needsCustomPrompt: false });
  };

  const handleExitAttempt = useCallback((): void => {
    Alert.alert(
      '게임 나가기',
      '게임을 나가시겠어요?\n재참여가 불가하며 패배 처리됩니다.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '나가기',
          style: 'destructive',
          onPress: () => {
            socket?.emit(CLIENT_EVENT.ROOM_LEAVE);
            router.replace('/(tabs)' as never);
          },
        },
      ],
    );
  }, [socket, router]);

  // Android 하드웨어 뒤로가기 — 나가기 확인 (iOS 스와이프는 레이아웃에서 차단)
  useHardwareBack(handleExitAttempt);

  // 라운드가 끝났는데 다음 라운드가 오지 않으면(네트워크 유실 등) 재입장으로 서버 상태를 다시 받는다 —
  // 정답 후 채팅 입력이 잠긴 채 멈추던 문제의 클라이언트 측 안전장치
  useEffect(() => {
    if (roundResult === null || !socket || !code) return;
    const timer = setTimeout(() => {
      socket.emit(CLIENT_EVENT.ROOM_JOIN, { code });
    }, ROUND_RESYNC_DELAY_MS);
    return () => clearTimeout(timer);
  }, [roundResult, socket, code]);

  const isDrawer = drawerId === myId;
  const totalTurns = roomState?.turnSchedule?.length ?? roomState?.config.roundCount ?? 1;
  const roundIndex = round?.roundIndex ?? 0;

  const selectedNickname = players.find((p) => p.id === selectedUserId)?.nickname ?? '';

  // 수동 '정답 인정'(+ 캐릭터 선택 테두리)은 커스텀 제시어 라운드의 출제자에게만
  const canManualApprove = isDrawer && isCustomRound;
  const maxPlayers = roomState?.config.playerCountMax ?? 12;
  const solvedUserId = correct?.userId ?? null;
  const guessedUserIds = useMemo(() => new Set(chatMessages.map((m) => m.userId)), [chatMessages]);
  const streamItems = useMemo(
    () =>
      chatMessages.slice(-5).map((m) => ({
        id: m.id,
        nickname: m.nickname,
        text: m.text,
        characterId: players.find((p) => p.id === m.userId)?.characterId ?? '',
        isCorrect: m.id === correct?.messageId,
        createdAt: m.createdAt,
        score: m.id === correct?.messageId ? roundResult?.scoreDelta[m.userId] : undefined,
      })),
    [chatMessages, players, correct?.messageId, roundResult],
  );

  const roundEnded = roundResult != null;
  const isCorrectEnd = roundResult?.correctUserId != null;
  const inputBarState = getInputBarState(overlay, roundEnded, isCorrectEnd);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>

      <GameHeader
        roundIndex={roundIndex}
        totalTurns={totalTurns}
        isDrawer={isDrawer}
        word={promptForDrawer}
        promptHint={promptHint}
        durationSec={round?.durationSec ?? 0}
        playerCount={players.length}
        maxPlayers={maxPlayers}
        revealedWord={isCorrectEnd ? roundResult?.answer ?? null : null}
        legendAction={
          canManualApprove ? (
            <AnswerApprovalButton
              selectedUserId={selectedUserId}
              selectedNickname={selectedNickname}
              chatMessages={chatMessages}
              onApprove={handleApprove}
              onDeselect={() => setSelectedUserId(null)}
            />
          ) : undefined
        }
        onBack={handleExitAttempt}
      />

      <PlayerGrid
        players={players}
        myId={myId}
        drawerId={drawerId}
        solvedUserId={solvedUserId}
        guessedUserIds={guessedUserIds}
        isDrawerView={canManualApprove}
        selectedUserId={selectedUserId}
        onSelectPlayer={setSelectedUserId}
      />

      {/* 캔버스 + 추측 스트림 + 결과 오버레이 (모두 캔버스 영역에 겹쳐 쌓인다) */}
      <View sx={{ flex: 1, position: 'relative' }}>
        {/* key를 roundIndex로 고정해 턴 전환 시 캔버스 초기화 */}
        <DrawingCanvas isDrawer={isDrawer} key={`canvas-${roundIndex}`} />
        <ChatStream items={streamItems} />
        {overlay != null && <ResultOverlay key={overlay.id} data={overlay} onDismiss={handleDismissOverlay} />}
      </View>

      {isDrawer && <ToolbarRow />}

      {!isDrawer && (
        <KeyboardAvoidingView behavior="padding">
          <ChatInputBar
            isDrawer={false}
            onSend={sendChat}
            placeholder={inputBarState.placeholder}
            disabled={inputBarState.disabled}
            ringColor={inputBarState.ringColor}
            placeholderColor={inputBarState.placeholderColor}
          />
        </KeyboardAvoidingView>
      )}

      <CustomPromptModal
        visible={isDrawer && needsCustomPrompt}
        onSubmit={handleCustomPromptSubmit}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: gameSurface.FRAME,
  },
});
