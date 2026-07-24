import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, BackHandler, KeyboardAvoidingView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import type { ChatMessage, RoundEnd } from '@sketch-catch/shared';
import { CLIENT_EVENT } from '@sketch-catch/shared';
import { useAuthStore, useRoomStore } from '@/shared/model';
import { useGameStore } from '@/features/game/model/useGameStore';
import { useChatSender } from '@/features/game/api/useChatSender';
import {
  DrawingCanvas,
  GameHeader,
  PlayerGrid,
  ToolbarRow,
  ChatInputBar,
  AnswerApprovalButton,
  ScoreFeedback,
  TurnEndOverlay,
  CustomPromptModal,
} from '@/features/game/ui';
import { PixelFireworks } from '@/features/game/ui/PixelFireworks';
import { WrongAnswerFeedback } from '@/features/game/ui/WrongAnswerFeedback';

export default function GameScreen() {
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
  const currentPrompt = useGameStore((s) => s.currentPrompt);
  const needsCustomPrompt = useGameStore((s) => s.needsCustomPrompt);

  const { sendChat, acceptAnswer, submitCustomPrompt } = useChatSender();

  const [activeBubbles, setActiveBubbles] = useState<Record<string, ChatMessage | null>>({});
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [scoreFeedback, setScoreFeedback] = useState<{ score: number; visible: boolean }>({
    score: 0,
    visible: false,
  });
  const [turnEndInfo, setTurnEndInfo] = useState<{ result: RoundEnd; prompt: string | null } | null>(null);
  const [wrongFeedbackVisible, setWrongFeedbackVisible] = useState(false);

  useEffect(() => {
    if (!socket || !code) return;

    useGameStore.getState().reset();

    const handleConnect = (): void => {
      socket.emit(CLIENT_EVENT.ROOM_JOIN, { code });
    };
    socket.on('connect', handleConnect);
    if (socket.connected) handleConnect();

    useGameStore.getState().registerGameListeners();

    return () => {
      socket.off('connect', handleConnect);
    };
  }, [socket, code]);

  useEffect(() => {
    if (roomState?.status === 'AWARD') {
      router.replace(`/room/${code}/award` as never);
    }
  }, [roomState?.status, code, router]);

  const prevChatLengthRef = useRef(0);
  useEffect(() => {
    if (chatMessages.length > prevChatLengthRef.current) {
      const newMessages = chatMessages.slice(prevChatLengthRef.current);
      prevChatLengthRef.current = chatMessages.length;

      setActiveBubbles((prev) => {
        const next = { ...prev };
        for (const msg of newMessages) {
          next[msg.userId] = msg;
        }
        return next;
      });
    }
  }, [chatMessages]);

  const prevCorrectRef = useRef<typeof correct>(null);
  useEffect(() => {
    if (correct !== null && correct !== prevCorrectRef.current) {
      prevCorrectRef.current = correct;
      const delta = roundResult?.scoreDelta[correct.userId] ?? 0;
      if (delta > 0) {
        setScoreFeedback({ score: delta, visible: true });
        setTimeout(() => setScoreFeedback((s) => ({ ...s, visible: false })), 900);
      }
    }
  }, [correct, roundResult]);

  const prevWrongAnswerRef = useRef<typeof wrongAnswer>(null);
  useEffect(() => {
    if (wrongAnswer !== null && wrongAnswer !== prevWrongAnswerRef.current) {
      prevWrongAnswerRef.current = wrongAnswer;
      setWrongFeedbackVisible(true);
      setTimeout(() => setWrongFeedbackVisible(false), 800);
    }
  }, [wrongAnswer]);

  const handleBubbleExpire = useCallback((userId: string) => {
    setActiveBubbles((prev) => ({ ...prev, [userId]: null }));
  }, []);

  const handleApprove = (messageId: string): void => {
    acceptAnswer(messageId);
    setSelectedUserId(null);
  };

  const handleCustomPromptSubmit = (text: string): void => {
    submitCustomPrompt(text);
    useGameStore.setState({ needsCustomPrompt: false });
  };

  // roundResult가 새로 도착하면 그 시점의 prompt를 캡처 (다음 라운드 시작 시 currentPrompt가 덮어씌워지기 전에)
  useEffect(() => {
    if (roundResult != null) {
      setTurnEndInfo({ result: roundResult, prompt: currentPrompt });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundResult]);

  const handleDismissRoundResult = (): void => {
    useGameStore.setState({ roundResult: null });
    setTurnEndInfo(null);
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

  // Android 하드웨어 뒤로가기 차단
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      handleExitAttempt();
      return true;
    });
    return () => subscription.remove();
  }, [handleExitAttempt]);

  const players = roomState?.players ?? [];
  const drawerId = round?.drawerId ?? '';
  const isDrawer = drawerId === myId;
  const totalTurns = roomState?.turnSchedule?.length ?? roomState?.config.roundCount ?? 1;
  const roundIndex = round?.roundIndex ?? 0;

  const selectedNickname = players.find((p) => p.id === selectedUserId)?.nickname ?? '';

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
      {/* iOS 스와이프 뒤로가기 비활성화 */}
      <Stack.Screen options={{ gestureEnabled: false }} />

      <GameHeader
        roundIndex={roundIndex}
        totalTurns={totalTurns}
        isDrawer={isDrawer}
        word={promptForDrawer}
        promptHint={promptHint}
        durationSec={round?.durationSec ?? 0}
        onBack={handleExitAttempt}
      />

      <PlayerGrid
        players={players}
        myId={myId}
        drawerId={drawerId}
        isDrawerView={isDrawer}
        selectedUserId={selectedUserId}
        onSelectPlayer={setSelectedUserId}
        activeBubbles={activeBubbles}
        correctUserId={correct?.userId ?? null}
        onBubbleExpire={handleBubbleExpire}
      />

      {isDrawer && (
        <AnswerApprovalButton
          selectedUserId={selectedUserId}
          selectedNickname={selectedNickname}
          chatMessages={chatMessages}
          onApprove={handleApprove}
          onDeselect={() => setSelectedUserId(null)}
        />
      )}

      {/* key를 roundIndex로 고정해 턴 전환 시 캔버스 초기화 */}
      <DrawingCanvas isDrawer={isDrawer} key={`canvas-${roundIndex}`} />

      {scoreFeedback.visible && <PixelFireworks />}
      <ScoreFeedback score={scoreFeedback.score} visible={scoreFeedback.visible} />
      <WrongAnswerFeedback visible={wrongFeedbackVisible} />

      {isDrawer && <ToolbarRow />}

      {!isDrawer && (
        <KeyboardAvoidingView behavior="padding">
          <ChatInputBar isDrawer={false} onSend={sendChat} />
        </KeyboardAvoidingView>
      )}

      {turnEndInfo != null && (
        <TurnEndOverlay
          result={turnEndInfo.result}
          players={players}
          prompt={turnEndInfo.prompt}
          onDismiss={handleDismissRoundResult}
        />
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
    backgroundColor: '#1E1C2C',
  },
});
