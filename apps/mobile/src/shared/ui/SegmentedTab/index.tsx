import React, { useRef, useEffect } from 'react'
import { Animated, Dimensions, Pressable, View, Text, StyleSheet } from 'react-native'
import { colors, typography, fontFamily } from '@/shared/config/theme'

type Props = {
  tabs: string[]
  activeIndex: number
  onTabPress: (index: number) => void
  badgeIndex?: number
}

export function SegmentedTab({ tabs, activeIndex, onTabPress, badgeIndex }: Props): React.JSX.Element {
  const indicator = useRef(new Animated.Value(activeIndex)).current
  const tabWidth = Dimensions.get('window').width / tabs.length

  useEffect(() => {
    Animated.timing(indicator, {
      toValue: activeIndex,
      duration: 150,
      useNativeDriver: true,
    }).start()
  }, [activeIndex, indicator])

  const translateX = indicator.interpolate({
    inputRange: tabs.map((_, i) => i),
    outputRange: tabs.map((_, i) => i * tabWidth),
  })

  return (
    <View style={styles.container}>
      {tabs.map((tab, index) => {
        const isActive = index === activeIndex
        const showBadge = badgeIndex === index && !isActive

        return (
          <Pressable
            key={tab}
            style={styles.tab}
            onPress={() => onTabPress(index)}
          >
            <View style={styles.tabContent}>
              <Text
                style={[styles.tabText, isActive ? styles.activeText : styles.inactiveText]}
                allowFontScaling={false}
              >
                {tab}
              </Text>
              {showBadge && <View style={styles.badge} />}
            </View>
          </Pressable>
        )
      })}

      {/* 슬라이딩 활성 인디케이터 */}
      <Animated.View
        style={[styles.indicator, { width: tabWidth, transform: [{ translateX }] }]}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  tabContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tabText: {
    fontFamily: fontFamily.regular,
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
  },
  activeText: {
    color: colors.textPrimary,
  },
  inactiveText: {
    color: colors.textSecondary,
  },
  badge: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#C0524A',
  },
  indicator: {
    position: 'absolute',
    bottom: 0,
    height: 2,
    backgroundColor: colors.accentPrimary,
  },
})
