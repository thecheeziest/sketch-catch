import { useFriendRequests } from '@/features/friends/api';
import { colors, fontFamily, spacing, textSizes } from '@/shared/config';
import { useRoomStore } from '@/shared/model';
import { Icon } from '@/shared/ui';
import { BlurMask, Canvas, Circle, RadialGradient } from '@shopify/react-native-skia';
import { Text, View } from 'dripsy';
import { BlurView } from 'expo-blur';
import { Tabs } from 'expo-router';
import { ComponentRef, Ref } from 'react';
import { Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const glowColors = ['rgba(255, 51, 136, 0.22)', 'rgba(255, 51, 136, 0.08)', 'rgba(255, 51, 136, 0)'];

function useRequestBadge(): number | string | undefined {
  const { data: requests } = useFriendRequests();
  const count = requests?.length ?? 0;
  if (count === 0) return undefined;
  return count <= 99 ? count : '+99';
}

export default function TabsLayout() {
  const requestBadge = useRequestBadge();
  const { bottom } = useSafeAreaInsets();
  const { width, fontScale } = useWindowDimensions();
  const isMatchmaking = useRoomStore(s => s.isMatchmaking);
  const bottomOffset = bottom + 12;
  const tabBarWidth = Math.min(240, width - spacing.MD * 2);
  const tabHeight = 28 + Math.ceil(textSizes.B3.lineHeight * fontScale) + spacing.XS * 2;

  return (
    <Tabs
      safeAreaInsets={{ bottom: 0 }}
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          position: 'absolute',
          start: (width - tabBarWidth) / 2,
          end: (width - tabBarWidth) / 2,
          width: tabBarWidth,
          bottom: bottomOffset,
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          elevation: 16,
          height: tabHeight + 12,
          paddingHorizontal: spacing.SM,
          paddingBottom: 6,
          paddingTop: 6,
          borderRadius: 34,
          shadowColor: colors.BLACK,
          shadowOffset: { width: 0, height: 12 },
          shadowOpacity: 0.34,
          shadowRadius: 24,
        },
        tabBarBackground: () => (
          <View style={styles.tabBarPill}>
            <BlurView intensity={78} tint="dark" style={StyleSheet.absoluteFill}>
              <View style={styles.tabBarTint} />
              <View style={styles.tabBarTopEdge} />
            </BlurView>
          </View>
        ),
        tabBarActiveTintColor: colors.PRIMARY_300,
        tabBarInactiveTintColor: colors.LIGHT_100,
        tabBarItemStyle: { flex: 1, height: tabHeight },
        tabBarShowLabel: true,
        tabBarIconStyle: styles.tabIcon,
        tabBarLabelPosition: 'below-icon',
        tabBarLabel: ({ color, children }) => (
          <Text numberOfLines={1} style={[styles.tabLabel, { color }]}>
            {children}
          </Text>
        ),
        tabBarButton: ({ children, style, ref, ...props }) => (
          <Pressable {...props} ref={ref as Ref<ComponentRef<typeof Pressable>>} style={[style, styles.tabButton]}>
            {props['aria-selected'] && (
              <Canvas pointerEvents="none" style={[styles.tabGlow, { height: tabHeight + 24 }]}>
                {[
                  { y: 30, radius: 32 },
                  { y: tabHeight - 2, radius: 24 },
                ].map(({ y, radius }) => (
                  <Circle key={y} cx={36} cy={y} r={radius}>
                    <RadialGradient c={{ x: 36, y }} r={radius} colors={glowColors} positions={[0, 0.45, 1]} />
                    <BlurMask blur={16} style="normal" />
                  </Circle>
                ))}
              </Canvas>
            )}
            {children}
          </Pressable>
        ),
        tabBarActiveBackgroundColor: 'transparent',
        tabBarInactiveBackgroundColor: 'transparent',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: '홈',
          tabBarIcon: ({ size, color }) => <Icon name="HOME" size={size} color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="friends"
        options={{
          title: '친구',
          tabBarBadge: requestBadge,
          tabBarBadgeStyle: { fontFamily: fontFamily.REGULAR, fontSize: textSizes.B4.fontSize },
          tabBarIcon: ({ size, color }) => <Icon name="FRIENDS" size={size} color={color as string} />,
        }}
        listeners={{
          tabPress: e => {
            if (isMatchmaking) e.preventDefault();
          },
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBarPill: {
    ...StyleSheet.absoluteFill,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 34,
    borderWidth: 1,
    overflow: 'hidden',
  },
  tabBarTint: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(18, 13, 32, 0.56)',
  },
  tabBarTopEdge: {
    backgroundColor: 'rgba(255, 255, 255, 0.24)',
    height: 1,
    left: 20,
    position: 'absolute',
    right: 20,
    top: 1,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.MD,
    paddingVertical: 4,
  },
  tabIcon: {
    flex: 0,
    width: 31,
    height: 28,
  },
  tabGlow: {
    position: 'absolute',
    alignSelf: 'center',
    top: -12,
    width: 72,
  },
  tabLabel: {
    fontFamily: fontFamily.REGULAR,
    fontSize: textSizes.B3.fontSize,
    lineHeight: textSizes.B3.lineHeight,
    textAlign: 'center',
    marginTop: 0,
  },
});
