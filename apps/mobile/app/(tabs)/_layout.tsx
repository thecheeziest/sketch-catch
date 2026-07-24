import { useFriendRequests } from '@/features/friends/api';
import { colors, fontFamily, textSizes } from '@/shared/config';
import { useRoomStore } from '@/shared/model';
import { Icon } from '@/shared/ui';
import { View } from 'dripsy';
import { BlurView } from 'expo-blur';
import { Tabs } from 'expo-router';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function useRequestBadge(): number | string | undefined {
  const { data: requests } = useFriendRequests();
  const count = requests?.length ?? 0;
  if (count === 0) return undefined;
  return count <= 99 ? count : '+99';
}

export default function TabsLayout() {
  const requestBadge = useRequestBadge();
  const { bottom } = useSafeAreaInsets();
  const isMatchmaking = useRoomStore((s) => s.isMatchmaking);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: 'transparent',
          borderTopWidth: 1,
          borderTopColor: 'rgba(255, 255, 255, 0.18)',
          height: 64 + bottom,
          paddingTop: 8,
          paddingBottom: bottom,
        },
        tabBarBackground: () => (
          <BlurView intensity={45} tint="dark" experimentalBlurMethod="dimezisBlurView" style={StyleSheet.absoluteFillObject}>
            <View
              style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(10, 10, 16, 0.38)' }]}
            />
          </BlurView>
        ),
        tabBarActiveTintColor: colors.PRIMARY_400,
        tabBarInactiveTintColor: colors.LIGHT_100,
        tabBarLabelStyle: { fontFamily: fontFamily.REGULAR, fontSize: textSizes.B3.fontSize },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: '홈',
          tabBarIcon: ({ size, color }) => <Icon name="HOME" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="friends"
        options={{
          title: '친구',
          tabBarBadge: requestBadge,
          tabBarBadgeStyle: { fontFamily: fontFamily.REGULAR, fontSize: textSizes.B4.fontSize },
          tabBarIcon: ({ size, color }) => <Icon name="FRIENDS" size={size} color={color} />,
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
