import { Image, Text, View } from 'dripsy'
import { getCharacterImageSource, colors, spacing } from '@/shared/config';
import { copyToClipboard } from '@/shared/lib';
import { Pressable } from 'react-native';
import { Icon } from '@/shared/ui/Icon';

type Props = {
  nickname: string;
  friendCode: string;
  characterId: string;
};

export function ProfileCard({ nickname, friendCode, characterId }: Props) {
  const handleCopy = (): Promise<void> => copyToClipboard(`${nickname}#${friendCode}`);

  const characterSource = getCharacterImageSource(characterId);

  return (
    <View sx={sxStyles.card}>
      <View sx={{ width: 80, height: 80, alignItems: 'center', justifyContent: 'center' }}>
        {characterSource && (
          <Image source={characterSource} sx={{ width: 72, height: 72 }} resizeMode="contain" />
        )}
      </View>
      <View sx={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.SM }}>
        <View sx={{ flexDirection: 'row' }}>
          <Text variants={['bold', 'T2']} sx={{ color: colors.LIGHT_100 }}>
            {nickname}
          </Text>
          <Text variants={['bold', 'T2']} sx={{ color: colors.GRAY }}>
            #{friendCode}
          </Text>
        </View>
        <Pressable
          onPress={handleCopy}
          style={({ pressed }) => (pressed ? { opacity: 0.5 } : null)}
          hitSlop={8}
        >
          <Icon name="COPY" size={20} />
        </Pressable>
      </View>
    </View>
  );
}

const sxStyles = {
  card: {
    backgroundColor: colors.DARK_100,
    borderWidth: 2,
    borderColor: colors.SECONDARY_300,
    padding: spacing.LG,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.MD,
  },
};
