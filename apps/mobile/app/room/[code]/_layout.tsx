import { useEffect } from 'react';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useRoomStore } from '@/shared/model';
import { useGameStore } from '@/features/game/model/useGameStore';
import { useMode2Store } from '@/features/mode2/model/useMode2Store';

export default function RoomCodeLayout() {
  const { code } = useLocalSearchParams<{ code: string }>();

  // 방 소켓의 수명은 이 레이아웃(방 코드)에 묶인다. 게임 이벤트 리스너도 여기서 1회만 등록해
  // 화면 전환 중 첫 이벤트(round:start·mode2:step)를 놓치거나 리스너가 중복 등록되지 않게 한다.
  useEffect(() => {
    if (!code) return;
    const { connect, disconnect } = useRoomStore.getState();
    connect(code);
    const offGame = useGameStore.getState().registerGameListeners();
    const offMode2 = useMode2Store.getState().registerMode2Listeners();
    return () => {
      offGame();
      offMode2();
      disconnect(code);
    };
  }, [code]);

  return (
    <Stack screenOptions={{ headerShown: false, gestureEnabled: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="game" />
      <Stack.Screen name="mode2" />
      <Stack.Screen name="mode2-review" />
      <Stack.Screen name="mode2-end" />
      <Stack.Screen name="award" />
    </Stack>
  );
}
