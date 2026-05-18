import React, { useState, useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { PixelButton } from '@/shared/ui/PixelButton';
import { MatchingButton } from '@/features/room/ui/MatchingButton';
import { useStartMatch } from '@/features/room/api/useStartMatch';
import { useCancelMatch } from '@/features/room/api/useCancelMatch';
import { useRoomStore } from '@/shared/model/room';
import { colors, spacing, typography, fontFamily } from '@/shared/config/theme';

export default function RandomMatchScreen(): React.JSX.Element {
  const router = useRouter();
  const [selected, setSelected] = useState<6 | 8 | 10 | null>(null);

  const isMatchmaking = useRoomStore((s) => s.isMatchmaking);
  const seconds = useRoomStore((s) => s.matchingSeconds);
  const roomState = useRoomStore((s) => s.roomState);

  const startMatch = useStartMatch();
  const cancelMatch = useCancelMatch();

  // 카운트업 타이머 — D-10: 단순 경과 시간 표시, 타임아웃 없음
  useEffect(() => {
    if (!isMatchmaking) return;
    const id = setInterval(() => {
      const cur = useRoomStore.getState().matchingSeconds;
      useRoomStore.getState().setMatchingSeconds(cur + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [isMatchmaking]);

  // 매칭 성공 시 소켓 통지로 roomState 갱신 → 대기실 자동 이동
  useEffect(() => {
    if (roomState?.code) {
      useRoomStore.getState().setMatchmaking(false);
      router.replace(`/room/${roomState.code}`);
    }
  }, [roomState?.code]);

  const handleStart = (): void => {
    if (selected === null) return;
    startMatch.mutate(selected);
  };

  const handleCancel = (): void => {
    cancelMatch.mutate(undefined, {
      onSettled: () => {
        useRoomStore.getState().setMatchmaking(false);
      },
    });
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          disabled={isMatchmaking}
          style={[styles.backButton, isMatchmaking && { opacity: 0.3 }]}
        >
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.title} allowFontScaling={false}>
          랜덤 매칭
        </Text>
        <View style={styles.backButton} />
      </View>

      {/* 콘텐츠 영역 */}
      <View style={styles.content}>
        <Text style={styles.guide} allowFontScaling={false}>
          인원을 선택하세요
        </Text>

        {/* 인원 버튼 */}
        <View style={styles.playerButtons}>
          {([6, 8, 10] as const).map((n) => (
            <PixelButton
              key={n}
              label={`${n}명`}
              variant={selected === n ? 'primary' : 'secondary'}
              onPress={() => setSelected(n)}
              disabled={isMatchmaking}
            />
          ))}
        </View>

        {/* CTA */}
        {isMatchmaking ? (
          <MatchingButton seconds={seconds} onCancel={handleCancel} />
        ) : (
          <PixelButton
            label="매칭 시작"
            variant="primary"
            disabled={selected === null}
            onPress={handleStart}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontFamily: fontFamily.regular,
    fontSize: typography.heading.fontSize,
    lineHeight: typography.heading.lineHeight,
    color: colors.textPrimary,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
    justifyContent: 'center',
  },
  guide: {
    fontFamily: fontFamily.regular,
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  playerButtons: {
    gap: spacing.md,
  },
});
