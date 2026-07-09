import { useMe } from '@/features/auth/api';
import { useLogout } from '@/features/auth/lib';
import { DeleteAccountModal } from '@/features/profile/ui';
import { colors, spacing } from '@/shared/config';
import { Button, Icon } from '@/shared/ui';
import { Text, View } from 'dripsy';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SettingsScreen() {
  const router = useRouter();
  const logout = useLogout();
  const { data: user } = useMe();
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.DARK_200 }}>
      <View sx={sxStyles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7 }]}
        >
          <Icon name="BACK" size={24} />
        </Pressable>
        <Text variants={['bold', 'T3']} sx={{ color: colors.LIGHT_100 }}>
          설정
        </Text>
        <View sx={{ width: 40, height: 40 }} />
      </View>
      <View sx={{ marginTop: spacing.XL, paddingHorizontal: spacing.XL, gap: spacing.SM }}>
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
      <DeleteAccountModal visible={deleteOpen} onClose={() => setDeleteOpen(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
});

const sxStyles = {
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: spacing.SM,
    height: 52,
    borderBottomWidth: 3,
    borderBottomColor: colors.BLACK,
  },
};
