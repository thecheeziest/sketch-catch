import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, typography, fontFamily, spacing } from '@/shared/config/theme';

type Props = {
  seconds: number;
  onCancel: () => void;
};

function formatMMSS(sec: number): string {
  return (
    String(Math.floor(sec / 60)).padStart(2, '0') +
    ':' +
    String(sec % 60).padStart(2, '0')
  );
}

export function MatchingButton({ seconds, onCancel }: Props): React.JSX.Element {
  return (
    <Pressable
      onPress={onCancel}
      style={({ pressed }) => [
        styles.container,
        pressed && { opacity: 0.7 },
      ]}
    >
      <Text style={styles.label} allowFontScaling={false}>
        랜덤 매칭 취소{'  '}{formatMMSS(seconds)}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 48,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.textPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  label: {
    fontFamily: fontFamily.regular,
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    color: colors.destructive,
  },
});
