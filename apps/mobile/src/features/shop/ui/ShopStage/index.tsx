import { Text, View } from 'dripsy';
import { StyleSheet } from 'react-native';
import type { ShopCategory } from '@sketch-catch/shared';
import { colors, spacing } from '@/shared/config';
import { CosmeticAvatar } from '@/shared/ui/CosmeticAvatar';
import { CosmeticChatText } from '@/shared/ui/CosmeticChatText';
import { PixelFrame } from '@/shared/ui/PixelFrame';

type Props = {
  nickname: string;
  selection: Record<ShopCategory, string | null>;
  isTrying: boolean;
};

const AVATAR_SIZE = 120;

// 꾸미기 미리보기 무대 — 고른 아이템을 입어 본 모습과 채팅 글자색을 함께 보여준다
export function ShopStage({ nickname, selection, isTrying }: Props) {
  return (
    <View sx={sxStyles.stage}>
      <CosmeticAvatar
        characterId={selection.CHARACTER ?? ''}
        frameId={selection.FRAME}
        backgroundId={selection.BACKGROUND}
        size={AVATAR_SIZE}
        defaultBorderColor={colors.SECONDARY_300}
        defaultBackgroundColor={colors.DARK_100}
      />
      <View sx={{ flex: 1, gap: spacing.SM }}>
        <Text variants={['bold', 'T3']} sx={{ color: colors.LIGHT_100 }} numberOfLines={1}>
          {nickname}
        </Text>
        <View>
          <PixelFrame borderColor={colors.DARK_100} borderWidth={2} notchSize={4} style={StyleSheet.absoluteFill}>
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.DARK_200 }]} />
          </PixelFrame>
          <View sx={{ padding: spacing.SM }}>
            <CosmeticChatText itemId={selection.CHAT_COLOR}>정답 고양이!</CosmeticChatText>
          </View>
        </View>
        {isTrying && (
          <Text sx={{ fontSize: 12, lineHeight: 18, color: colors.WARNING_200 }}>입어보는 중 · 미보유 포함</Text>
        )}
      </View>
    </View>
  );
}

const sxStyles = {
  stage: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.LG,
    marginHorizontal: spacing.MD,
    paddingHorizontal: spacing.LG,
    paddingTop: spacing.LG + 8, // 특수 프레임 장식이 위로 삐져나올 공간
    paddingBottom: spacing.LG,
    backgroundColor: colors.DARK_400,
  },
};
