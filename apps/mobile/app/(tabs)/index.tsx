import { useCancelMatch, useStartMatch } from '@/features/room/api';
import { CodeJoinModal, MatchingStatus } from '@/features/room/ui';
import { icons, spacing } from '@/shared/config';
import { useRoomStore } from '@/shared/model';
import { useMatchingTimer, useMatchingNavigation } from '@/shared/lib';
import { Button, Dialog, ProfileHeader } from '@/shared/ui';
import mainBackground from '@assets/main-background.png';
import { Image, View } from 'dripsy';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ImageBackground } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type PlayerCount = 6 | 8 | 10;

export default function HomeScreen() {
  const router = useRouter();
  const [codeModalVisible, setCodeModalVisible] = useState(false);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [matchingCount, setMatchingCount] = useState<PlayerCount | null>(null);

  const isMatchmaking = useRoomStore((s) => s.isMatchmaking);
  const seconds = useRoomStore((s) => s.matchingSeconds);

  const startMatch = useStartMatch();
  const cancelMatch = useCancelMatch();

  useMatchingTimer();
  useMatchingNavigation();

  const handleSelectAndStart = (n: PlayerCount) => {
    setMatchingCount(n);
    setSheetVisible(false);
    startMatch.mutate(n);
  };

  const handleCancel = () => {
    cancelMatch.mutate(undefined, {
      onSettled: () => {
        useRoomStore.getState().setMatchmaking(false);
      },
    });
  };

  return (
    <ImageBackground source={mainBackground} style={{ flex: 1 }} resizeMode="cover">
      <SafeAreaView style={{ flex: 1 }} edges={['bottom', 'left', 'right']}>
        <ProfileHeader />
        <View sx={sxStyles.content}>
          <Image source={icons.LOGO} sx={{ width: 350 }} resizeMode="contain" />
          <View sx={{ width: '100%', gap: spacing.MD }}>
            {isMatchmaking ? (
              <MatchingStatus count={matchingCount!} seconds={seconds} onCancel={handleCancel} />
            ) : (
              <>
                <Button
                  label="방 만들기"
                  color="primary"
                  onPress={() => router.push('/room/create')}
                />
                <Button label="랜덤 매칭" color="secondary" onPress={() => setSheetVisible(true)} />
                <Button
                  label="코드로 입장"
                  color="light"
                  onPress={() => setCodeModalVisible(true)}
                />
              </>
            )}
          </View>
        </View>

        <CodeJoinModal visible={codeModalVisible} onClose={() => setCodeModalVisible(false)} />

        <Dialog visible={sheetVisible} onClose={() => setSheetVisible(false)} title="인원 선택">
          <View sx={{ flexDirection: 'row', gap: spacing.MD }}>
            {([6, 8, 10] as const).map((n) => (
              <Button
                key={n}
                label={`${n}명`}
                color="primary"
                style={{ flex: 1 }}
                onPress={() => handleSelectAndStart(n)}
              />
            ))}
          </View>
        </Dialog>
      </SafeAreaView>
    </ImageBackground>
  );
}

const sxStyles = {
  content: {
    flex: 1,
    paddingHorizontal: spacing.XL,
    paddingBottom: 56,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    gap: spacing.LG,
  },
};
