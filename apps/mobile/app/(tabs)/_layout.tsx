import React from 'react'
import { View, StyleSheet } from 'react-native'
import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useFriendRequests } from '@/features/friends/api/useFriendRequests'
import { colors } from '@/shared/config/theme'

function TabBadge(): React.JSX.Element | null {
  const { data: requests } = useFriendRequests()
  if (!requests?.length) return null
  return <View style={styles.badge} />
}

export default function TabsLayout(): React.JSX.Element {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: colors.background, borderTopColor: colors.border },
        tabBarActiveTintColor: colors.accentPrimary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarLabelStyle: { fontFamily: 'Galmuri11', fontSize: 12 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: '홈',
          tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="friends"
        options={{
          title: '친구',
          tabBarIcon: ({ color, size }) => (
            <View>
              <Ionicons name="people-outline" size={size} color={color} />
              <TabBadge />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="mypage"
        options={{
          title: '마이페이지',
          tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} />,
        }}
      />
    </Tabs>
  )
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -2,
    right: -4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.destructive,
  },
})
