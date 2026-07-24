import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { useRoomStore } from '@/shared/model';

export default function RoomCodeLayout() {
  useEffect(() => {
    const { connect, disconnect } = useRoomStore.getState();
    connect();
    return () => disconnect();
  }, []);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="game" options={{ gestureEnabled: false }} />
      <Stack.Screen name="mode2" options={{ gestureEnabled: false }} />
      <Stack.Screen name="mode2-review" options={{ gestureEnabled: false }} />
      <Stack.Screen name="mode2-end" />
      <Stack.Screen name="award" />
    </Stack>
  );
}
