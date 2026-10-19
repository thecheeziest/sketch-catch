import { FeedbackPressable } from '@/shared/ui/FeedbackPressable';
import { useMe } from '@/features/auth/api';
import { useLogout } from '@/features/auth/lib';
import { useUnregisterPushToken } from '@/features/push/api/useUnregisterPushToken';
import { usePushPreferenceStore } from '@/features/push/model/usePushPreferenceStore';
import { DeleteAccountModal } from '@/features/profile/ui';
import { colors, spacing, textSizes } from '@/shared/config';
import { useFeedbackStore } from '@/shared/model/feedback';
import { playFeedback } from '@/shared/lib/feedback';
import { Button, Icon, PlatformBadge } from '@/shared/ui';
import { ScrollView, Text, View } from 'dripsy';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { AppState, Linking, StyleSheet, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SettingsScreen() {
  const router = useRouter();
  const logout = useLogout();
  const { data: user } = useMe();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [notificationsGranted, setNotificationsGranted] = useState(true);
  const soundEnabled = useFeedbackStore(s => s.soundEnabled);
  const soundVolume = useFeedbackStore(s => s.soundVolume);
  const musicEnabled = useFeedbackStore(s => s.musicEnabled);
  const musicVolume = useFeedbackStore(s => s.musicVolume);
  const pushEnabled = usePushPreferenceStore(s => s.enabled);
  const pushHydrated = usePushPreferenceStore(s => s.hydrated);
  const setPushEnabled = usePushPreferenceStore(s => s.setEnabled);
  const unregisterPushToken = useUnregisterPushToken();
  const feedbackHydrated = useFeedbackStore(s => s.hydrated);
  const updatePreferences = useFeedbackStore(s => s.updatePreferences);

  useEffect(() => {
    const syncPermission = () =>
      Notifications.getPermissionsAsync().then(({ status }) => setNotificationsGranted(status === 'granted'));
    syncPermission();
    // iOS 설정 앱에서 돌아왔을 때 허용 상태를 다시 반영한다
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') syncPermission();
    });
    return () => sub.remove();
  }, []);

  const handlePushToggle = async (value: boolean) => {
    playFeedback('select');
    if (!value) {
      setPushEnabled(false);
      unregisterPushToken.mutate();
      return;
    }
    const { status, canAskAgain } = await Notifications.getPermissionsAsync();
    // 이미 거부했다면 시스템 팝업을 다시 띄울 수 없으므로 iOS 설정으로 안내한다
    if (status === 'denied' && !canAskAgain) {
      Linking.openSettings();
      return;
    }
    // 토큰 등록(권한 요청 포함)은 루트 레이아웃의 PushTokenRegistrar가 enabled 변경에 반응해 처리한다
    setPushEnabled(true);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.DARK_200 }}>
      <View sx={sxStyles.header}>
        <FeedbackPressable
          feedback="cancel"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7 }]}
        >
          <Icon name="BACK" size={24} />
        </FeedbackPressable>
        <Text variants={['bold', 'T3']} sx={{ color: colors.LIGHT_100 }}>
          설정
        </Text>
        <View sx={{ width: 40, height: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: spacing.XL }}>
        {!notificationsGranted && (
          <View sx={sxStyles.notificationHint}>
            <Text sx={{ ...textSizes.B3, color: colors.GRAY, flex: 1 }}>
              알림이 꺼져 있어요. 설정에서 알림을 허용해주세요
            </Text>
            <Button label="설정 열기" color="secondary" height={36} onPress={() => Linking.openSettings()} />
          </View>
        )}

        <View sx={{ marginTop: spacing.XL, paddingHorizontal: spacing.XL, gap: spacing.SM }}>
          {user && (
            <>
              <PlatformBadge provider={user.provider} account={`${user.nickname}#${user.friendCode}`} />
              <View sx={sxStyles.divider} />
            </>
          )}
          <View sx={sxStyles.feedbackRow}>
            <Text variants={['B2']} sx={{ color: colors.LIGHT_100 }}>
              푸시 알림
            </Text>
            <Switch
              accessibilityLabel="푸시 알림"
              value={pushEnabled && notificationsGranted}
              disabled={!pushHydrated}
              onValueChange={handlePushToggle}
              trackColor={{ false: colors.DARK_100, true: colors.SECONDARY_300 }}
            />
          </View>
          <View sx={sxStyles.feedbackRow}>
            <Text variants={['B2']} sx={{ color: colors.LIGHT_100 }}>
              배경 음악
            </Text>
            <Switch
              accessibilityLabel="배경 음악"
              value={musicEnabled}
              disabled={!feedbackHydrated}
              onValueChange={value => {
                updatePreferences({ musicEnabled: value });
                playFeedback('select');
              }}
              trackColor={{ false: colors.DARK_100, true: colors.SECONDARY_300 }}
            />
          </View>
          <View sx={sxStyles.feedbackRow}>
            <Text
              variants={['B2']}
              sx={{ color: colors.LIGHT_100 }}
            >{`배경 음악 볼륨 ${Math.round(musicVolume * 100)}%`}</Text>
            <View sx={{ flexDirection: 'row', gap: spacing.SM }}>
              <Button
                label="-"
                accessibilityLabel="배경 음악 볼륨 줄이기"
                height={36}
                color="dark"
                disabled={!feedbackHydrated || !musicEnabled || musicVolume <= 0}
                onPress={() => updatePreferences({ musicVolume: Math.round((musicVolume - 0.1) * 100) / 100 })}
              />
              <Button
                label="+"
                accessibilityLabel="배경 음악 볼륨 높이기"
                height={36}
                color="dark"
                disabled={!feedbackHydrated || !musicEnabled || musicVolume >= 1}
                onPress={() => updatePreferences({ musicVolume: Math.round((musicVolume + 0.1) * 100) / 100 })}
              />
            </View>
          </View>
          <View sx={sxStyles.feedbackRow}>
            <Text variants={['B2']} sx={{ color: colors.LIGHT_100 }}>
              효과음
            </Text>
            <Switch
              accessibilityLabel="효과음"
              value={soundEnabled}
              disabled={!feedbackHydrated}
              onValueChange={value => {
                updatePreferences({ soundEnabled: value });
                playFeedback('select');
              }}
              trackColor={{ false: colors.DARK_100, true: colors.SECONDARY_300 }}
            />
          </View>
          <View sx={sxStyles.feedbackRow}>
            <Text
              variants={['B2']}
              sx={{ color: colors.LIGHT_100 }}
            >{`효과음 볼륨 ${Math.round(soundVolume * 100)}%`}</Text>
            <View sx={{ flexDirection: 'row', gap: spacing.SM }}>
              <Button
                label="-"
                accessibilityLabel="효과음 볼륨 줄이기"
                height={36}
                color="dark"
                disabled={!feedbackHydrated || !soundEnabled || soundVolume <= 0}
                onPress={() => updatePreferences({ soundVolume: Math.round((soundVolume - 0.2) * 10) / 10 })}
              />
              <Button
                label="+"
                accessibilityLabel="효과음 볼륨 높이기"
                height={36}
                color="dark"
                disabled={!feedbackHydrated || !soundEnabled || soundVolume >= 1}
                onPress={() => updatePreferences({ soundVolume: Math.round((soundVolume + 0.2) * 10) / 10 })}
              />
            </View>
          </View>
          <View sx={sxStyles.divider} />
          {user ? (
            <>
              <Button
                label="로그아웃"
                color="primary"
                onPress={async () => {
                  await logout();
                  router.replace('/(auth)/login');
                }}
              />
              <Button label="회원 탈퇴" color="light" onPress={() => setDeleteOpen(true)} />
            </>
          ) : (
            <Button
              label="로그인"
              color="primary"
              onPress={async () => {
                await logout();
                router.replace('/(auth)/login');
              }}
            />
          )}
        </View>
      </ScrollView>
      <DeleteAccountModal visible={deleteOpen} onClose={() => setDeleteOpen(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
});

const sxStyles = {
  feedbackRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: spacing.SM,
    paddingVertical: spacing.SM,
  },
  divider: {
    height: 2,
    marginVertical: spacing.SM,
    backgroundColor: colors.DARK_100,
  },
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: spacing.SM,
    height: 52,
    borderBottomWidth: 3,
    borderBottomColor: colors.BLACK,
  },
  notificationHint: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.SM,
    marginTop: spacing.MD,
    marginHorizontal: spacing.XL,
    paddingHorizontal: spacing.MD,
    paddingVertical: spacing.SM,
    backgroundColor: colors.DARK_300,
  },
};
