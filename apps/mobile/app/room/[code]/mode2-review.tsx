import { useCallback, useEffect, useState } from 'react';
import { BackHandler, StyleSheet, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image, ScrollView, Text, View } from 'dripsy';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import type { Mode2ReviewSheet, Mode2ReviewState, Mode2StepContent } from '@sketch-catch/shared';
import { CLIENT_EVENT } from '@sketch-catch/shared';
import { useAuthStore, useRoomStore } from '@/shared/model';
import { useMode2Store } from '@/features/mode2/model/useMode2Store';
import { useMode2Sender } from '@/features/mode2/api/useMode2Sender';
import { ReviewProgressHeader } from '@/features/mode2/ui/ReviewProgressHeader';
import { FinalJudgeButton } from '@/features/mode2/ui/FinalJudgeButton';
import { BestSheetVoteList, type VoteSheet } from '@/features/mode2/ui/BestSheetVoteList';
import { SparkleBadge } from '@/features/mode2/ui/SparkleBadge';
import { DrawingCanvas, WordBanner } from '@/features/game/ui';
import { useGameStore } from '@/features/game/model/useGameStore';
import { Button } from '@/shared/ui/Button';
import { Dialog } from '@/shared/ui/Dialog';
import { PixelFrame } from '@/shared/ui/PixelFrame';
import { colors, fontFamily, getCharacterImageSource, spacing, textSizes } from '@/shared/config';

const FINAL_JUDGE_TIMER_SEC = 15;
const BEST_VOTE_TIMER_SEC = 20;

export default function Mode2ReviewScreen() {
  const router = useRouter();
  const { code } = useLocalSearchParams<{ code: string }>();
  const myId = useAuthStore.getState().user?.id ?? '';
  const socket = useRoomStore((s) => s.socket);
  const roomState = useRoomStore((s) => s.roomState);
  const review = useMode2Store((s) => s.review);
  const { judgeFinal, voteBest } = useMode2Sender();
  const { height: windowHeight } = useWindowDimensions();

  const [selectedVoteId, setSelectedVoteId] = useState<string | null>(null);
  const [hasJudged, setHasJudged] = useState(false);
  const [exitDialogVisible, setExitDialogVisible] = useState(false);

  // 소켓 연결 후 방 재입장 + 화면 독립 진입 대비 mode2:review 안전장치 구독
  // (reset 없이 review만 구독 — mode2.tsx의 registerMode2Listeners를 다시 호출하지 않는다)
  useEffect(() => {
    if (!socket || !code) return;
    const handleConnect = (): void => {
      socket.emit(CLIENT_EVENT.ROOM_JOIN, { code });
    };
    const handleReview = (payload: Mode2ReviewState): void => {
      useMode2Store.setState({ review: payload });
    };
    socket.on('connect', handleConnect);
    socket.on('mode2:review', handleReview);
    if (socket.connected) handleConnect();
    return () => {
      socket.off('connect', handleConnect);
      socket.off('mode2:review', handleReview);
    };
  }, [socket, code]);

  // 게임 종료(리뷰+투표 종료) → 종료 화면 라우팅
  useEffect(() => {
    if (roomState?.status === 'AWARD') {
      router.replace(`/room/${code}/mode2-end` as never);
    }
  }, [roomState?.status, code, router]);

  const handleExitAttempt = useCallback((): void => {
    setExitDialogVisible(true);
  }, []);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      handleExitAttempt();
      return true;
    });
    return () => subscription.remove();
  }, [handleExitAttempt]);

  const handleConfirmExit = (): void => {
    socket?.emit(CLIENT_EVENT.ROOM_LEAVE);
    setExitDialogVisible(false);
    router.replace('/(tabs)' as never);
  };

  const players = roomState?.players ?? [];
  const currentSheet: Mode2ReviewSheet | undefined = review?.sheets[review.currentSheetIndex];

  // 판정 시트/단계가 바뀌면 로컬 판정 완료 표시 초기화
  useEffect(() => {
    setHasJudged(false);
  }, [review?.currentSheetIndex, review?.subPhase]);

  // BEST_VOTE 진입 시마다 선택값 초기화
  useEffect(() => {
    if (review?.subPhase === 'BEST_VOTE') {
      setSelectedVoteId(null);
    }
  }, [review?.subPhase]);

  // FINAL_JUDGE: 마지막 단계 콘텐츠 / SLIDESHOW: currentFrameIndex 단계 콘텐츠
  const displayContent: Mode2StepContent | null = (() => {
    if (!review || !currentSheet) return null;
    if (review.subPhase === 'FINAL_JUDGE') {
      const last = currentSheet.steps[currentSheet.steps.length - 1];
      return last?.content ?? null;
    }
    if (review.subPhase === 'SLIDESHOW') {
      const idx = review.currentFrameIndex ?? 0;
      return currentSheet.steps[idx]?.content ?? null;
    }
    return null;
  })();

  // DrawingCanvas(isDrawer=false)는 useGameStore.remoteStrokes를 읽는다 — 정적 리뷰 프레임을 그 형식으로 동기화
  useEffect(() => {
    if (displayContent?.kind === 'DRAW') {
      useGameStore.setState({
        remoteStrokes: displayContent.strokes.map((s) => ({
          strokeId: s.id,
          authorId: s.authorId,
          color: s.color,
          width: s.width,
          points: s.points,
          ended: true,
        })),
      });
    } else {
      useGameStore.setState({ remoteStrokes: [] });
    }
  }, [displayContent]);

  const referenceHeight = Math.round(windowHeight * 0.4);

  const renderReferenceContent = (content: Mode2StepContent | null) => {
    if (!content) return null;
    if (content.kind === 'DRAW') {
      return (
        <View style={{ height: referenceHeight }}>
          <DrawingCanvas isDrawer={false} />
        </View>
      );
    }
    return <WordBanner word={content.text} />;
  };

  const isOwner = currentSheet?.ownerId === myId;

  const headerText = (() => {
    if (!review) return '';
    if (review.subPhase === 'BEST_VOTE') return '가장 웃긴 시트에 투표하세요!';
    if (review.subPhase === 'BEST_REVEAL') return '오늘의 베스트 발표';
    return `시트 ${review.currentSheetIndex + 1}/${review.sheets.length} 다시보기`;
  })();

  const headerTimer = (() => {
    if (!review) return undefined;
    if (review.subPhase === 'FINAL_JUDGE') return FINAL_JUDGE_TIMER_SEC;
    if (review.subPhase === 'BEST_VOTE') return BEST_VOTE_TIMER_SEC;
    return undefined;
  })();

  const voteSheets: VoteSheet[] = (review?.sheets ?? []).map((s) => {
    const owner = players.find((p) => p.id === s.ownerId);
    return {
      sheetId: s.sheetId,
      ownerId: s.ownerId,
      nickname: owner?.nickname ?? s.ownerId,
      characterId: owner?.characterId ?? 'cat',
    };
  });

  const bestSheets = (review?.bestSheetIds ?? [])
    .map((id) => review?.sheets.find((s) => s.sheetId === id))
    .filter((s): s is Mode2ReviewSheet => s != null)
    .map((s) => {
      const owner = players.find((p) => p.id === s.ownerId);
      return {
        sheetId: s.sheetId,
        nickname: owner?.nickname ?? s.ownerId,
        characterId: owner?.characterId ?? 'cat',
      };
    });

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Stack.Screen options={{ gestureEnabled: false }} />

      <ReviewProgressHeader key={`${review?.subPhase}-${review?.currentSheetIndex}`} text={headerText} timerSec={headerTimer} />

      {review?.subPhase === 'FINAL_JUDGE' && currentSheet && (
        <View sx={{ flex: 1, paddingHorizontal: spacing.MD, paddingTop: spacing.LG, gap: spacing.MD }}>
          {renderReferenceContent(displayContent)}
          {isOwner && !hasJudged && (
            <Text sx={{ ...textSizes.T3, color: colors.LIGHT_100, textAlign: 'center' }}>
              당신이 적은 문장이 이렇게 바뀌었어요!
            </Text>
          )}
          <View sx={{ flex: 1 }} />
          {isOwner && hasJudged ? (
            <View sx={{ paddingVertical: spacing.LG, alignItems: 'center' }}>
              <Text sx={{ ...textSizes.B1, color: colors.GRAY, textAlign: 'center' }}>
                판정 완료, 다시보기를 준비하고 있어요
              </Text>
            </View>
          ) : (
            <FinalJudgeButton
              isOwner={isOwner}
              onJudge={(ok) => {
                judgeFinal(currentSheet.sheetId, ok);
                setHasJudged(true);
              }}
            />
          )}
        </View>
      )}

      {review?.subPhase === 'SLIDESHOW' && currentSheet && (
        <View sx={{ flex: 1, paddingHorizontal: spacing.MD, paddingTop: spacing.LG }}>
          {renderReferenceContent(displayContent)}
          <View sx={{ flexDirection: 'row', justifyContent: 'center', gap: spacing.XS, paddingVertical: spacing.MD }}>
            {currentSheet.steps.map((step, i) => (
              <View
                key={step.stepIndex}
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: i === (review.currentFrameIndex ?? 0) ? colors.PRIMARY_400 : colors.DARK_100,
                }}
              />
            ))}
          </View>
        </View>
      )}

      {review?.subPhase === 'BEST_VOTE' && (
        <View sx={{ flex: 1 }}>
          <BestSheetVoteList sheets={voteSheets} myId={myId} selectedId={selectedVoteId} onSelect={setSelectedVoteId} />
          <View sx={{ padding: spacing.MD }}>
            <Button
              label="투표하기"
              color="primary"
              height={48}
              disabled={!selectedVoteId}
              onPress={() => {
                if (selectedVoteId) voteBest(selectedVoteId);
              }}
            />
          </View>
        </View>
      )}

      {review?.subPhase === 'BEST_REVEAL' && (
        <View sx={{ flex: 1, alignItems: 'center', paddingTop: spacing.XL }}>
          <Text sx={{ ...textSizes.T1, fontFamily: fontFamily.BOLD, color: colors.LIGHT_100, marginBottom: spacing.LG }}>
            오늘의 베스트 🏆
          </Text>
          <ScrollView horizontal contentContainerStyle={{ gap: spacing.MD, paddingHorizontal: spacing.MD }}>
            {bestSheets.map((sheet) => {
              const source = getCharacterImageSource(sheet.characterId);
              return (
                <SparkleBadge key={sheet.sheetId}>
                  <View sx={{ width: 96, height: 96 }}>
                    <PixelFrame borderColor={colors.PRIMARY_400} style={StyleSheet.absoluteFillObject}>
                      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: colors.DARK_100 }]} />
                    </PixelFrame>
                    <View sx={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                      {source !== null ? (
                        <Image source={source} sx={{ width: 48, height: 48 }} resizeMode="contain" />
                      ) : (
                        <View sx={{ width: 48, height: 48, backgroundColor: colors.SECONDARY_400 }} />
                      )}
                    </View>
                    <View sx={{ paddingBottom: spacing.XS, paddingHorizontal: spacing.XS }}>
                      <Text sx={{ ...textSizes.B3, color: colors.LIGHT_100, textAlign: 'center' }} numberOfLines={1}>
                        {sheet.nickname}
                      </Text>
                    </View>
                  </View>
                </SparkleBadge>
              );
            })}
          </ScrollView>
        </View>
      )}

      <Dialog
        visible={exitDialogVisible}
        onClose={() => setExitDialogVisible(false)}
        title="게임에서 나가기"
        buttons={[
          { label: '계속 플레이', color: 'primary', onPress: () => setExitDialogVisible(false) },
          { label: '나가기', color: 'dark', onPress: handleConfirmExit },
        ]}
      >
        <Text sx={{ ...textSizes.B2, color: colors.LIGHT_100 }}>
          게임을 나가면 현재 진행 중인 시트가 비어있는 상태로 처리됩니다. 계속할까요?
        </Text>
      </Dialog>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.DARK_200,
  },
});
