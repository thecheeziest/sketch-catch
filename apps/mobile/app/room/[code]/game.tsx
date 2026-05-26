import { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { ChatMessage } from '@sketch-catch/shared';
import { useAuthStore, useRoomStore } from '@/shared/model';
import { useGameStore } from '@/features/game/model/useGameStore';
import { useChatSender } from '@/features/game/api/useChatSender';
import {
  DrawingCanvas,
  GameHeader,
  PlayerGrid,
  ToolbarRow,
  ChatInputBar,
  WordBanner,
  AnswerApprovalButton,
  ScoreFeedback,
  RoundResultOverlay,
} from '@/features/game/ui';

export default function GameScreen() {
  const router = useRouter();
  const { code } = useLocalSearchParams<{ code: string }>();
  const myId = useAuthStore.getState().user?.id ?? '';
  const roomState = useRoomStore((s) => s.roomState);
  const round = useGameStore((s) => s.round);
  const promptForDrawer = useGameStore((s) => s.promptForDrawer);
  const chatMessages = useGameStore((s) => s.chatMessages);
  const correct = useGameStore((s) => s.correct);
  const roundResult = useGameStore((s) => s.roundResult);

  const { sendChat, acceptAnswer } = useChatSender();

  // 말풍선: userId별 최신 채팅 메시지
  const [activeBubbles, setActiveBubbles] = useState<Record<string, ChatMessage | null>>({});
  // 출제자 플레이어 선택 상태
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  // 점수 피드백 표시
  const [scoreFeedback, setScoreFeedback] = useState<{ score: number; visible: boolean }>({
    score: 0,
    visible: false,
  });

  // 게임 이벤트 리스너 1회 등록
  useEffect(() => {
    useGameStore.getState().registerGameListeners();
  }, []);

  // AWARD 상태로 전환 시 시상식 화면으로 이동 (Plan 08)
  useEffect(() => {
    if (roomState?.status === 'AWARD') {
      router.replace(`/room/${code}/award` as never);
    }
  }, [roomState?.status, code, router]);

  // chat:message → 발신자 PlayerCell 위 말풍선 업데이트
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

  // chat:correct → 점수 피드백
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

  const handleBubbleExpire = useCallback((userId: string) => {
    setActiveBubbles((prev) => ({ ...prev, [userId]: null }));
  }, []);

  const handleApprove = (userId: string): void => {
    // 해당 유저의 마지막 채팅 messageId로 answer:accept 전송
    const lastMsg = [...chatMessages].reverse().find((m) => m.userId === userId);
    if (lastMsg) {
      acceptAnswer(lastMsg.id);
    }
    setSelectedUserId(null);
  };

  const handleDismissRoundResult = (): void => {
    useGameStore.setState({ roundResult: null });
  };

  const onBack = (): void => {
    router.back();
  };

  const players = roomState?.players ?? [];
  const drawerId = round?.drawerId ?? '';
  const isDrawer = drawerId === myId;
  const roundCount = roomState?.config.roundCount ?? 1;
  const roundIndex = round?.roundIndex ?? 0;
  const scoreboard = roomState?.scoreboard ?? {};

  // 선택된 플레이어의 마지막 채팅 텍스트
  const selectedPlayerLastChat = selectedUserId != null
    ? ([...chatMessages].reverse().find((m) => m.userId === selectedUserId)?.text ?? '')
    : '';
  const selectedNickname = players.find((p) => p.id === selectedUserId)?.nickname ?? '';

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
      {/* 헤더 — 48px */}
      <GameHeader
        roundIndex={roundIndex}
        roundCount={roundCount}
        onBack={onBack}
      />

      {/* 참가자 그리드 — 2행×6열 */}
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

      {/* 출제자 전용: 제시어 배너 + 정답 인정 버튼 */}
      {isDrawer && promptForDrawer != null && (
        <WordBanner word={promptForDrawer} />
      )}
      {isDrawer && (
        <AnswerApprovalButton
          selectedUserId={selectedUserId}
          selectedNickname={selectedNickname}
          lastChatText={selectedPlayerLastChat}
          onApprove={handleApprove}
        />
      )}

      {/* Skia 캔버스 — 남은 공간 전부 */}
      <DrawingCanvas isDrawer={isDrawer} />

      {/* 점수 피드백 — 캔버스 위 absolute */}
      <ScoreFeedback score={scoreFeedback.score} visible={scoreFeedback.visible} />

      {/* 출제자 전용 도구 */}
      {isDrawer && <ToolbarRow />}

      {/* 채팅 입력창 — KeyboardAvoidingView로 소프트 키보드 위 배치 */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ChatInputBar isDrawer={isDrawer} onSend={sendChat} />
      </KeyboardAvoidingView>

      {/* 라운드 결과 오버레이 */}
      {roundResult != null && (
        <RoundResultOverlay
          result={roundResult}
          players={players}
          scoreboard={scoreboard}
          prompt={promptForDrawer ?? undefined}
          onDismiss={handleDismissRoundResult}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1E1C2C', // colors.DARK_200
  },
});
