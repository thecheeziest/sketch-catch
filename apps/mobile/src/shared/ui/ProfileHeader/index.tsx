import { Image, Text, View } from 'dripsy'
import { useMe } from '@/features/auth/api';
import { CharacterModal, FriendCodeModal, NicknameModal } from '@/features/profile/ui';
import { colors, getCharacterImageSource, spacing } from '@/shared/config';
import { copyToClipboard } from '@/shared/lib';
import { useAuthStore } from '@/shared/model';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { ReactNode, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../Icon';

type Props = {
  rightSlot?: ReactNode;
};

export function ProfileHeader({ rightSlot }: Props) {
  const { top } = useSafeAreaInsets();
  const router = useRouter();
  const { data: user } = useMe();
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const [characterOpen, setCharacterOpen] = useState(false);
  const [nicknameOpen, setNicknameOpen] = useState(false);
  const [friendCodeOpen, setFriendCodeOpen] = useState(false);

  const containerStyle = [styles.container, { paddingTop: top + spacing.XS }];

  if (!user) {
    return (
      <BlurView intensity={20} tint="light" experimentalBlurMethod="dimezisBlurView" style={containerStyle}>
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(10, 10, 16, 0.82)' }]} />
        <Pressable
          onPress={async () => {
            await clearAuth();
            router.replace('/(auth)/login');
          }}
          style={({ pressed }) => [{ flex: 1 }, pressed && { opacity: 0.7 }]}
          hitSlop={4}
        >
          <Text sx={{ color: colors.SECONDARY_200 }}>로그인 후 이용해 주세요!</Text>
        </Pressable>
        <View sx={{ flexDirection: 'row', alignItems: 'center', gap: spacing.XS }}>
          {rightSlot}
          <Pressable
            onPress={() => router.push('/settings')}
            style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7 }]}
          >
            <Icon name="SETTINGS" size={22} />
          </Pressable>
        </View>
      </BlurView>
    );
  }

  const characterSource = getCharacterImageSource(user.characterId);

  const handleCopy = (): Promise<void> => copyToClipboard(`${user.nickname}#${user.friendCode}`, '복사됐어요');

  return (
    <>
      <BlurView intensity={20} tint="light" experimentalBlurMethod="dimezisBlurView" style={containerStyle}>
        <View
          style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(10, 10, 16, 0.82)' }]}
        />
        <View sx={sxStyles.left}>
          <Pressable
            onPress={() => setCharacterOpen(true)}
            style={({ pressed }) => [styles.characterBtn, pressed && { opacity: 0.7 }]}
            hitSlop={4}
          >
            {characterSource && (
              <Image source={characterSource} sx={{ width: 45, height: 45 }} resizeMode="contain" />
            )}
          </Pressable>
          <View sx={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Pressable
              onPress={() => setNicknameOpen(true)}
              onLongPress={handleCopy}
              delayLongPress={500}
              hitSlop={4}
            >
              <Text variants={['bold', 'T1']} sx={{ color: colors.LIGHT_100 }}>
                {user.nickname}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setFriendCodeOpen(true)}
              onLongPress={handleCopy}
              delayLongPress={500}
              hitSlop={4}
            >
              <Text sx={{ color: colors.SECONDARY_200 }}>
                #{user.friendCode}
              </Text>
            </Pressable>
          </View>
        </View>
        <View sx={{ flexDirection: 'row', alignItems: 'center', gap: spacing.XS }}>
          {rightSlot}
          <Pressable
            onPress={() => router.push('/settings')}
            style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7 }]}
          >
            <Icon name="SETTINGS" size={22} />
          </Pressable>
        </View>
      </BlurView>

      <CharacterModal
        visible={characterOpen}
        onClose={() => setCharacterOpen(false)}
        currentCharacterId={user.characterId}
      />
      <NicknameModal
        visible={nicknameOpen}
        onClose={() => setNicknameOpen(false)}
        currentNickname={user.nickname}
      />
      <FriendCodeModal
        visible={friendCodeOpen}
        onClose={() => setFriendCodeOpen(false)}
        currentFriendCode={user.friendCode}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.MD,
    paddingVertical: spacing.SM,
    borderBottomWidth: 3,
    borderColor: colors.BLACK,
  },
  characterBtn: {
    width: 45,
    height: 45,
    backgroundColor: colors.WHITE,
    borderWidth: 3,
    borderColor: colors.PRIMARY_400,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

const sxStyles = {
  left: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.MD,
  },
};
