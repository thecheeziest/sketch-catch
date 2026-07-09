import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { useRoomStore } from '@/shared/model';

export default function RoomCodeLayout() {
  useEffect(() => {
    const { connect, disconnect } = useRoomStore.getState();
    connect();
    return () => disconnect();
  }, []);

  return <Stack screenOptions={{ headerShown: false }} />;
}
