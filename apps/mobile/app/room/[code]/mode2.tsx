import { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CLIENT_EVENT } from '@sketch-catch/shared';
import { Text, View } from 'dripsy';
import { useHardwareBack } from '@/shared/lib';
import { useAuthStore, useRoomStore } from '@/shared/model';
import { colors, spacing, textSizes } from '@/shared/config';
import { PixelInput } from '@/shared/ui/PixelInput';
import { DrawingCanvas, ToolbarRow, WordBanner } from '@/features/game/ui';
import {
  ReferenceCanvas,
  SheetRotationHeader,
  SubmitStepButton,
  useMode2Sender,
  useMode2Store,
} from '@/features/mode2';

const MAX_TEXT_LENGTH = 40;

export default function Mode2Screen() {
  const router = useRouter();
  const { code } = useLocalSearchParams<{ code: string }>();
  const myId = useAuthStore.getState().user?.id ?? '';
  const socket = useRoomStore(s => s.socket);
  const roomState = useRoomStore(s => s.roomState);
  const step = useMode2Store(s => s.step);
  const myStrokesLength = useMode2Store(s => s.myStrokes.length);
  const { submitPrompt, submitDraw, submitAnswer } = useMode2Sender();

  const [text, setText] = useState('');
  const [submitted, setSubmitted] = useState(false);

  // 모드2 이벤트 리스너·스토어 초기화는 room/[code]/_layout과 gameId 변경 시점에 처리된다
  useEffect(() => {
    if (roomState?.status === 'MODE2_REVIEW') {
      router.replace(`/room/${code}/mode2-review` as never);
    } else if (roomState?.status === 'AWARD') {
      // 참가자 이탈 등으로 게임이 강제종료된 경우
      router.replace(`/room/${code}/award` as never);
    }
  }, [roomState?.status, code, router]);

  // 단계 전환 시 로컬 입력/제출 상태 초기화 — myStrokes도 비워 이전 DRAW 단계의 stroke가
  // 제출되는 것을 막는다 (DrawingCanvas는 key로 remount되지만 store는 유지되므로)
  useEffect(() => {
    setText('');
    setSubmitted(false);
    useMode2Store.getState().setMyStrokes([]);
  }, [step?.stepIndex]);

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

  if (!step) {
    return <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}></SafeAreaView>;
  }

  const isAssignee = step.assigneeId === myId;
  const showWaiting = !isAssignee || submitted;

  const handleSubmit = (): void => {
    if (step.phase === 'PROMPT') {
      submitPrompt(step.sheetId, text);
    } else if (step.phase === 'DRAW') {
      submitDraw(step.sheetId, useMode2Store.getState().myStrokes);
    } else {
      submitAnswer(step.sheetId, text);
    }
    setText('');
    setSubmitted(true);
  };

  const isTextPhase = step.phase === 'PROMPT' || step.phase === 'ANSWER';
  const submitDisabled = (() => {
    if (isTextPhase) return text.trim().length === 0;
    if (step.phase === 'DRAW') return myStrokesLength === 0;
    return false;
  })();

  const renderContent = () => {
    if (showWaiting) {
      return (
        <View sx={styles2.waiting}>
          <Text sx={{ ...textSizes.B1, color: colors.GRAY, textAlign: 'center' }}>다른 플레이어를 기다리는 중...</Text>
        </View>
      );
    }

    if (step.phase === 'PROMPT') {
      return (
        <View sx={styles2.content}>
          <Text sx={{ ...textSizes.B1, color: colors.LIGHT_100, marginBottom: spacing.MD }}>
            제시어를 직접 입력해 주세요
          </Text>
          <PixelInput
            value={text}
            onChangeText={setText}
            maxLength={MAX_TEXT_LENGTH}
            showCounter
            placeholder="그림으로 그려질 문장을 적어주세요"
          />
        </View>
      );
    }

    if (step.phase === 'DRAW') {
      return (
        <View sx={styles2.drawArea}>
          {step.previousContent?.kind === 'TEXT' && <WordBanner word={step.previousContent.text} />}
          <View sx={{ flex: 1 }}>
            <DrawingCanvas
              isDrawer
              key={`draw-${step.stepIndex}`}
              onStrokesChange={useMode2Store.getState().setMyStrokes}
            />
          </View>
          <ToolbarRow />
        </View>
      );
    }

    // ANSWER
    return (
      <View sx={styles2.drawArea}>
        <ReferenceCanvas strokes={step.previousContent?.kind === 'DRAW' ? step.previousContent.strokes : []} />
        <View sx={styles2.content}>
          <PixelInput
            value={text}
            onChangeText={setText}
            maxLength={MAX_TEXT_LENGTH}
            showCounter
            placeholder="정답을 적어주세요"
          />
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
      <SheetRotationHeader
        stepIndex={step.stepIndex}
        totalSteps={step.totalSteps}
        phase={step.phase}
        durationSec={step.durationSec}
        onBack={handleExitAttempt}
      />

      <View sx={{ flex: 1 }}>{renderContent()}</View>

      {!showWaiting && <SubmitStepButton phase={step.phase} disabled={submitDisabled} onSubmit={handleSubmit} />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.DARK_200,
  },
});

const styles2 = {
  waiting: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: spacing.MD,
  },
  content: {
    flex: 1,
    padding: spacing.MD,
  },
  drawArea: {
    flex: 1,
  },
};
