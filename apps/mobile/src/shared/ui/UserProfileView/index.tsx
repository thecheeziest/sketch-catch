import { Text, View } from 'dripsy';
import { StyleSheet } from 'react-native';
import { colors, spacing, textSizes } from '@/shared/config';
import { CosmeticAvatar } from '../CosmeticAvatar';
import { CosmeticChatText } from '../CosmeticChatText';
import { PixelFrame } from '../PixelFrame';

type Props = {
  nickname: string;
  friendCode: string;
  characterId: string;
  frameId?: string | null;
  backgroundId?: string | null;
  chatColorId?: string | null;
  statusMessage?: string | null;
};

const AVATAR_SIZE = 96;

// 대기실·친구 목록 공용 프로필 본문 — 꾸민 아바타 + 닉네임#코드 + 글자색이 적용된 한마디
export function UserProfileView({
  nickname,
  friendCode,
  characterId,
  frameId,
  backgroundId,
  chatColorId,
  statusMessage,
}: Props) {
  const profileMessage = statusMessage?.trim() ?? '';
  const hasStatusMessage = profileMessage.length > 0;

  return (
    <View sx={{ ...sxStyles.container, paddingBottom: hasStatusMessage ? spacing.SM : 0 }}>
      <CosmeticAvatar
        characterId={characterId}
        frameId={frameId}
        backgroundId={backgroundId}
        size={AVATAR_SIZE}
        defaultBorderColor={colors.SECONDARY_300}
        defaultBackgroundColor={colors.DARK_100}
      />
      <Text sx={{ ...textSizes.T3, color: colors.LIGHT_100 }}>
        {nickname}
        <Text sx={{ color: colors.GRAY }}>#{friendCode}</Text>
      </Text>
      {hasStatusMessage && (
        <View sx={sxStyles.bubble}>
          <PixelFrame borderColor={colors.DARK_100} borderWidth={2} notchSize={4} style={StyleSheet.absoluteFill}>
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.DARK_200 }]} />
          </PixelFrame>
          <View sx={{ padding: spacing.SM }}>
            <CosmeticChatText itemId={chatColorId}>{profileMessage}</CosmeticChatText>
          </View>
        </View>
      )}
    </View>
  );
}

const sxStyles = {
  container: {
    alignItems: 'center' as const,
    gap: spacing.SM,
    paddingTop: spacing.SM + 8, // 특수 프레임 장식이 위로 삐져나올 공간
  },
  bubble: { alignSelf: 'stretch' as const, alignItems: 'center' as const },
};
