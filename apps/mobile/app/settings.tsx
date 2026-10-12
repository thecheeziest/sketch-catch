import { useMe } from '@/features/auth/api';
import { useLogout } from '@/features/auth/lib';
import { DeleteAccountModal } from '@/features/profile/ui';
import { colors, spacing, textSizes } from '@/shared/config';
import { useFeedbackStore } from '@/shared/model/feedback';
import { Button, Icon, PlatformBadge } from '@/shared/ui';
import { ScrollView, Text, View } from 'dripsy';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SettingsScreen() {
  const router = useRouter();
  const logout = useLogout();
  const { data: user } = useMe();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [notificationsGranted, setNotificationsGranted] = useState(true);
  const soundEnabled = useFeedbackStore(s => s.soundEnabled);
  const hapticsEnabled = useFeedbackStore(s => s.hapticsEnabled);
  const soundVolume = useFeedbackStore(s => s.soundVolume);
  const feedbackHydrated = useFeedbackStore(s => s.hydrated);
  const updatePreferences = useFeedbackStore(s => s.updatePreferences);

  useEffect(() => {
    Notifications.getPermissionsAsync().then(({ status }) => {
      setNotificationsGranted(status === 'granted');
    });
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.DARK_200 }}>
      <View sx={sxStyles.header}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7 }]}>
          <Icon name="BACK" size={24} />
        </Pressable>
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
          <View sx={sxStyles.feedbackRow}>
            <Text variants={['B2']} sx={{ color: colors.LIGHT_100 }}>
              효과음
            </Text>
            <Switch
              accessibilityLabel="효과음"
              value={soundEnabled}
              disabled={!feedbackHydrated}
              onValueChange={value => updatePreferences({ soundEnabled: value })}
              trackColor={{ false: colors.DARK_100, true: colors.SECONDARY_300 }}
            />
          </View>
          <View sx={sxStyles.feedbackRow}>
            <Text variants={['B2']} sx={{ color: colors.LIGHT_100 }}>
              햅틱
            </Text>
            <Switch
              accessibilityLabel="햅틱"
              value={hapticsEnabled}
              disabled={!feedbackHydrated}
              onValueChange={value => updatePreferences({ hapticsEnabled: value })}
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
          {user ? (
            <>
              <PlatformBadge provider={user.provider} account={`${user.nickname}#${user.friendCode}`} />
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
