import { useCancelMatch, useStartMatch } from '@/features/room/api';
import { CodeJoinModal, MatchingStatus } from '@/features/room/ui';
import { icons, spacing } from '@/shared/config';
import { useRoomStore } from '@/shared/model';
import { useMatchingTimer, useMatchingNavigation, useNavGuard } from '@/shared/lib';
import { Button, Dialog, ProfileHeader } from '@/shared/ui';
import mainBackground from '@assets/main-background.png';
import { Image, View } from 'dripsy';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ImageBackground } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ROOM_PLAYER_MIN } from '@sketch-catch/shared';

export default function HomeScreen() {
  const router = useRouter();
  const [codeModalVisible, setCodeModalVisible] = useState(false);
  const [sheetVisible, setSheetVisible] = useState(false);

  const isMatchmaking = useRoomStore((s) => s.isMatchmaking);
  const seconds = useRoomStore((s) => s.matchingSeconds);
  const matchLobby = useRoomStore((s) => s.matchLobby);

  const startMatch = useStartMatch();
  const cancelMatch = useCancelMatch();
  const guardNav = useNavGuard();

  useMatchingTimer();
  useMatchingNavigation();

  const handleSelectAndStart = (mode: 1 | 2) => {
    setSheetVisible(false);
    startMatch.mutate(mode);
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
          <Image source={icons.LOGO_HOME} sx={{ width: '100%', maxWidth: 320, height: 320 / 1.5 }} resizeMode="contain" />
          <View sx={{ width: '100%', gap: spacing.MD }}>
            {isMatchmaking ? (
              <MatchingStatus
                count={matchLobby?.count ?? 0}
                min={matchLobby?.min ?? ROOM_PLAYER_MIN}
                seconds={seconds}
                isCountingDown={matchLobby?.deadline != null}
                onCancel={handleCancel}
              />
            ) : (
              <>
                <Button
                  label="방 만들기"
                  color="primary"
                  onPress={() => guardNav(() => router.push('/room/create'))}
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

        <Dialog visible={sheetVisible} onClose={() => setSheetVisible(false)} title="모드 선택">
          <View sx={{ flexDirection: 'row', gap: spacing.MD }}>
            <Button
              label="맞혀 볼래?"
              color="primary"
              style={{ flex: 1 }}
              onPress={() => handleSelectAndStart(1)}
            />
            <Button
              label="이어 그리자!"
              color="primary"
              style={{ flex: 1 }}
              onPress={() => handleSelectAndStart(2)}
            />
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
