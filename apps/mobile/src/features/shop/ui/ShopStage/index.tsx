import { Text, TextInput, View } from 'dripsy';
import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { STATUS_MESSAGE_MAX, type ShopCategory } from '@sketch-catch/shared';
import { colors, fontFamily, getChatItem, spacing } from '@/shared/config';
import { CosmeticAvatar } from '@/shared/ui/CosmeticAvatar';
import { CosmeticChatText } from '@/shared/ui/CosmeticChatText';
import { PixelFrame } from '@/shared/ui/PixelFrame';

type Props = {
  nickname: string;
  selection: Record<ShopCategory, string | null>;
  isTrying: boolean;
  statusMessage: string;
  // 내 옷장에서만 한마디를 고칠 수 있다. 캐치샵에서는 저장된 한마디로 글자색만 미리 본다
  onChangeStatusMessage?: (text: string) => void;
};

const AVATAR_SIZE = 120;
const STATUS_PLACEHOLDER = '나를 표현할 한마디는?';
const SHOP_SAMPLE_TEXT = '정답 고양이!';

// 꾸미기 미리보기 무대 — 고른 아이템을 입어 본 모습과 한마디의 글자색을 함께 보여준다
export function ShopStage({ nickname, selection, isTrying, statusMessage, onChangeStatusMessage }: Props) {
  const [editing, setEditing] = useState(false);
  const editable = onChangeStatusMessage !== undefined;
  const chatColor = getChatItem(selection.CHAT_COLOR)?.color ?? colors.LIGHT_100;

  const messageView = (() => {
    if (editable && editing) {
      return (
        <TextInput
          autoFocus
          value={statusMessage}
          onChangeText={onChangeStatusMessage}
          onBlur={() => setEditing(false)}
          maxLength={STATUS_MESSAGE_MAX}
          placeholder={STATUS_PLACEHOLDER}
          placeholderTextColor={colors.GRAY}
          returnKeyType="done"
          blurOnSubmit
          accessibilityLabel="한마디 입력"
          sx={{ fontFamily: fontFamily.REGULAR, fontSize: 13, lineHeight: 20, padding: 3, color: chatColor }}
        />
      );
    }
    if (statusMessage !== '') return <CosmeticChatText itemId={selection.CHAT_COLOR}>{statusMessage}</CosmeticChatText>;
    if (editable) {
      return <Text sx={{ fontFamily: fontFamily.REGULAR, fontSize: 13, lineHeight: 20, padding: 3, color: colors.GRAY }}>{STATUS_PLACEHOLDER}</Text>;
    }
    return <CosmeticChatText itemId={selection.CHAT_COLOR}>{SHOP_SAMPLE_TEXT}</CosmeticChatText>;
  })();

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
        <Pressable
          disabled={!editable}
          onPress={() => setEditing(true)}
          accessibilityRole={editable ? 'button' : undefined}
          accessibilityLabel={editable ? '한마디 수정' : undefined}
        >
          <PixelFrame borderColor={colors.DARK_100} borderWidth={2} notchSize={4} style={StyleSheet.absoluteFill}>
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.DARK_200 }]} />
          </PixelFrame>
          <View sx={{ padding: spacing.SM }}>{messageView}</View>
        </Pressable>
        {editable && editing && (
          <Text sx={{ fontSize: 12, lineHeight: 18, color: colors.LIGHT_500, textAlign: 'right' }}>
            {statusMessage.length} / {STATUS_MESSAGE_MAX}
          </Text>
        )}
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
