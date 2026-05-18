import { useFriendRequests } from '@/features/friends/api/useFriendRequests';
import { colors } from '@/shared/config/theme';
import { useRoomStore } from '@/shared/model/room';
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function useRequestBadge(): number | string | undefined {
  const { data: requests } = useFriendRequests();
  const count = requests?.length ?? 0;
  if (count === 0) return undefined;
  return count <= 99 ? count : '+99';
}

export default function TabsLayout(): React.JSX.Element {
  const requestBadge = useRequestBadge();
  const { bottom } = useSafeAreaInsets();
  const isMatchmaking = useRoomStore((s) => s.isMatchmaking);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          height: 56 + bottom,
          paddingTop: 8,
          paddingBottom: bottom,
        },
        tabBarActiveTintColor: colors.accentPrimary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarLabelStyle: { fontFamily: 'Galmuri11', fontSize: 12 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: '홈',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="friends"
        options={{
          title: '친구',
          tabBarBadge: requestBadge,
          tabBarBadgeStyle: { fontFamily: 'Galmuri11', fontSize: 10 },
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people-outline" size={size} color={color} />
          ),
        }}
        listeners={{
          tabPress: (e) => {
            if (isMatchmaking) e.preventDefault();
          },
        }}
      />
    </Tabs>
  );
}
