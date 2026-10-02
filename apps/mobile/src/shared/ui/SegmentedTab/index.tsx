import { Text, View } from 'dripsy'
import { colors, textSizes } from '@/shared/config';
import { BlurView } from 'expo-blur';
import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, Pressable, StyleSheet } from 'react-native';

type Props = {
  tabs: string[];
  activeIndex: number;
  onTabPress: (index: number) => void;
  /** 탭별 배지 숫자. 0 또는 undefined면 미표시. 100 이상은 '+99' */
  badges?: (number | undefined)[];
};

function formatBadge(count: number): string {
  return count >= 100 ? '+99' : String(count);
}

export function SegmentedTab({ tabs, activeIndex, onTabPress, badges }: Props) {
  const indicator = useRef(new Animated.Value(activeIndex)).current;
  const tabWidth = Dimensions.get('window').width / tabs.length;

  useEffect(() => {
    Animated.timing(indicator, {
      toValue: activeIndex,
      duration: 150,
      useNativeDriver: true,
    }).start();
  }, [activeIndex, indicator]);

  const translateX = indicator.interpolate({
    inputRange: tabs.map((_, i) => i),
    outputRange: tabs.map((_, i) => i * tabWidth),
  });

  return (
    <View style={styles.container}>
      <BlurView intensity={20} tint="light" style={StyleSheet.absoluteFill} />
      {tabs.map((tab, index) => {
        const isActive = index === activeIndex;
        const badgeCount = badges?.[index] ?? 0;

        return (
          <Pressable key={tab} style={styles.tab} onPress={() => onTabPress(index)}>
            <View sx={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text sx={{ color: isActive ? colors.PRIMARY_400 : colors.DARK_100 }}>
                {tab}
              </Text>
              {badgeCount > 0 && (
                <View sx={sxStyles.badge}>
                  <Text sx={{ fontSize: textSizes.B4.fontSize, lineHeight: textSizes.B3.lineHeight, color: colors.WHITE }}>
                    {formatBadge(badgeCount)}
                  </Text>
                </View>
              )}
            </View>
          </Pressable>
        );
      })}

      {/* 슬라이딩 활성 인디케이터 */}
      <Animated.View style={[styles.indicator, { width: tabWidth, transform: [{ translateX }] }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderBottomWidth: 2,
    borderBottomColor: colors.BLACK,
    backgroundColor: colors.LIGHT_500,
  },
  tab: {
    flex: 1,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  indicator: {
    position: 'absolute',
    bottom: -2,
    height: 2,
    backgroundColor: colors.PRIMARY_400,
  },
});

const sxStyles = {
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.WARNING_400,
    paddingHorizontal: 4,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
};
