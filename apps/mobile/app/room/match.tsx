import { useState } from 'react';
import { Text, View } from 'dripsy';
import { Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Button, Icon } from '@/shared/ui';
import { MatchingStatus } from '@/features/room/ui';
import { useStartMatch, useCancelMatch } from '@/features/room/api';
import { useRoomStore } from '@/shared/model';
import { useMatchingTimer, useMatchingNavigation } from '@/shared/lib';
import { colors, spacing } from '@/shared/config';

export default function RandomMatchScreen() {
  const router = useRouter();
  const [selected, setSelected] = useState<6 | 8 | 10 | null>(null);

  const isMatchmaking = useRoomStore((s) => s.isMatchmaking);
  const seconds = useRoomStore((s) => s.matchingSeconds);

  const startMatch = useStartMatch();
  const cancelMatch = useCancelMatch();

  useMatchingTimer();
  useMatchingNavigation();

  const handleStart = (): void => {
    if (selected === null) return;
    startMatch.mutate(selected);
  };

  const handleCancel = (): void => {
    cancelMatch.mutate(undefined, { onSettled: () => { useRoomStore.getState().setMatchmaking(false); } });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.DARK_200 }} edges={['top', 'bottom']}>
      <View sx={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.MD, paddingVertical: spacing.SM }}>
        <Pressable onPress={() => router.back()} disabled={isMatchmaking} style={[styles.backButton, isMatchmaking && { opacity: 0.3 }]}>
          <Icon name="BACK" size={24} />
        </Pressable>
        <Text variant="T2" sx={{ flex: 1, textAlign: 'center', color: colors.LIGHT_100 }}>랜덤 매칭</Text>
        <View sx={{ width: 40, height: 40 }} />
      </View>
      <View sx={{ flex: 1, paddingHorizontal: spacing.XL, gap: spacing.MD, justifyContent: 'center' }}>
        <Text sx={{ color: colors.GRAY, textAlign: 'center', marginBottom: spacing.SM }}>인원을 선택하세요</Text>
        <View sx={{ gap: spacing.MD }}>
          {([6, 8, 10] as const).map((n) => (
            <Button
              key={n}
              label={`${n}명`}
              color={selected === n ? 'primary' : 'light'}
              onPress={() => setSelected(n)}
              disabled={isMatchmaking}
            />
          ))}
        </View>
        {isMatchmaking ? (
          <MatchingStatus count={selected!} seconds={seconds} onCancel={handleCancel} />
        ) : (
          <Button label="매칭 시작" color="primary" disabled={selected === null} onPress={handleStart} />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
});
