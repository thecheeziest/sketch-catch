import { Image, Text, View } from 'dripsy';
import { Linking, Platform, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, icons, spacing, textSizes } from '@/shared/config';
import { useAppUpdateStore, useToastStore } from '@/shared/model';
import { Button } from '@/shared/ui';

// 링크가 없을 때(출시 전 등) 어디서 업데이트하는지 안내
const UPDATE_SOURCE = Platform.OS === 'ios' ? 'TestFlight 또는 App Store' : 'Play 스토어';

// 최소 빌드 미달 시 앱 전체를 대신하는 화면 — 다른 화면으로 이동할 수단을 두지 않는다
export function ForceUpdateScreen() {
  const updateUrl = useAppUpdateStore(s => s.updateUrl);
  const { width: screenWidth } = useWindowDimensions();
  const logoWidth = (screenWidth - spacing.XL * 2) * 0.55;

  const handleUpdate = async (): Promise<void> => {
    if (!updateUrl) return;
    try {
      await Linking.openURL(updateUrl);
    } catch (err) {
      console.log('[appUpdate] open update url failed', err);
      useToastStore.getState().show(`${UPDATE_SOURCE}에서 직접 업데이트해 주세요.`);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.DARK_200, paddingHorizontal: spacing.XL }}>
      <View sx={sxStyles.content}>
        <Image source={icons.LOGO_SPLASH} sx={{ width: logoWidth, height: logoWidth / 3 }} resizeMode="contain" />
        <Text sx={{ ...textSizes.T2, color: colors.LIGHT_100, textAlign: 'center' }}>새 버전이 나왔어요</Text>
        <Text sx={{ ...textSizes.B2, color: colors.LIGHT_100, textAlign: 'center' }}>
          {`최신 버전으로 업데이트해야 게임에 참여할 수 있어요.\n${UPDATE_SOURCE}에서 업데이트해 주세요.`}
        </Text>
      </View>
      {updateUrl && (
        <View sx={{ paddingBottom: spacing.XL }}>
          <Button label="업데이트하기" color="primary" onPress={handleUpdate} />
        </View>
      )}
    </SafeAreaView>
  );
}

const sxStyles = {
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.MD,
  },
} as const;
