import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuthStore, useRoomStore } from '@/shared/model';
import { useGameStore } from '@/features/game/model/useGameStore';
import { DrawingCanvas, GameHeader, PlayerGrid, ToolbarRow } from '@/features/game/ui';

export default function GameScreen() {
  const router = useRouter();
  const { code } = useLocalSearchParams<{ code: string }>();
  const myId = useAuthStore.getState().user?.id ?? '';
  const roomState = useRoomStore((s) => s.roomState);
  const round = useGameStore((s) => s.round);

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

  const onBack = (): void => {
    router.back();
  };

  const players = roomState?.players ?? [];
  const drawerId = round?.drawerId ?? '';
  const isDrawer = drawerId === myId;
  const roundCount = roomState?.config.roundCount ?? 1;
  const roundIndex = round?.roundIndex ?? 0;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
      {/* 헤더 — 48px */}
      <GameHeader
        roundIndex={roundIndex}
        roundCount={roundCount}
        onBack={onBack}
      />

      {/* 참가자 그리드 — 2행×6열 */}
      <PlayerGrid players={players} myId={myId} drawerId={drawerId} />

      {/* 제시어 배너 플레이스홀더 — Plan 07에서 WordBanner 컴포넌트 추가 */}

      {/* Skia 캔버스 — 남은 공간 전부 */}
      <DrawingCanvas isDrawer={isDrawer} />

      {/* 출제자 전용 도구 */}
      {isDrawer && <ToolbarRow />}

      {/* 채팅 영역 플레이스홀더 — Plan 07에서 ChatRow 추가 */}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1E1C2C', // colors.DARK_200
  },
});
