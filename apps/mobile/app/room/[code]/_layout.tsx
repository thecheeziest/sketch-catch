import { useEffect } from 'react';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useRoomStore, useToastStore } from '@/shared/model';
import { useGameStore } from '@/features/game/model/useGameStore';
import { useRoomChatStore } from '@/features/room/model/useRoomChatStore';
import { useRoomBackgroundGuard } from '@/features/room/lib';
import { useMode2Store } from '@/features/mode2/model/useMode2Store';
import { useCoinRewardStore } from '@/features/shop';

export default function RoomCodeLayout() {
  const { code } = useLocalSearchParams<{ code: string }>();
  useRoomBackgroundGuard(code);

  // 방 소켓의 수명은 이 레이아웃(방 코드)에 묶인다. 게임 이벤트 리스너도 여기서 1회만 등록해
  // 화면 전환 중 첫 이벤트(round:start·mode2:step)를 놓치거나 리스너가 중복 등록되지 않게 한다.
  useEffect(() => {
    if (!code) return;
    const { connect, disconnect } = useRoomStore.getState();
    connect(code);
    const offGame = useGameStore.getState().registerGameListeners();
    const offMode2 = useMode2Store.getState().registerMode2Listeners();
    const offRoomChat = useRoomChatStore.getState().registerRoomChatListeners();
    const offCoinReward = useCoinRewardStore.getState().registerCoinRewardListeners();
    // 시상식에 남은 방장에게 대기실 인원의 재촉이 도착하면 상단 토스트로 알린다
    const socket = useRoomStore.getState().socket;
    const handleNudged = (): void =>
      useToastStore.getState().show('친구들이 대기실에서 기다리고 있어요!', 'info', 'top');
    socket?.on('room:nudged', handleNudged);
    return () => {
      socket?.off('room:nudged', handleNudged);
      offGame();
      offMode2();
      offRoomChat();
      offCoinReward();
      disconnect(code);
    };
  }, [code]);

  return (
    <Stack screenOptions={{ headerShown: false, gestureEnabled: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="game" />
      <Stack.Screen name="mode2" />
      <Stack.Screen name="mode2-review" />
      <Stack.Screen name="award" />
    </Stack>
  );
}
