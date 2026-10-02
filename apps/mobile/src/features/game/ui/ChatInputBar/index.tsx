import { useState } from 'react';
import { View } from 'dripsy';
import { Pressable, StyleSheet, TextInput } from 'react-native';
import { colors, fontFamily, spacing, textSizes } from '@/shared/config';
import { PixelFrame } from '@/shared/ui/PixelFrame';
import { toolbar } from '@/features/game/config';

type Props = {
  isDrawer: boolean;
  onSend: (text: string) => void;
  placeholder?: string;
  /** 라운드 종료 구간(정답/게임오버) — 입력 비활성화 */
  disabled?: boolean;
  /** 결과 오버레이와 함께 바뀌는 입력창 테두리 색 (오답: 핑크, 종료: 비활성 톤) */
  ringColor?: string;
  placeholderColor?: string;
};

export function ChatInputBar({
  isDrawer,
  onSend,
  placeholder = '정답을 입력하세요',
  disabled = false,
  ringColor = toolbar.ERASER_RING,
  placeholderColor = colors.GRAY,
}: Props) {
  const [text, setText] = useState('');

  if (isDrawer) return null;

  const canSend = !disabled && text.trim().length > 0;

  const handleSend = (): void => {
    if (!canSend) return;
    onSend(text.trim());
    setText('');
  };

  return (
    <View sx={{ height: 44, position: 'relative' }}>
      <PixelFrame borderColor={ringColor} borderWidth={3} notchSize={0} style={StyleSheet.absoluteFill}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.DARK_100 }]} />
      </PixelFrame>
      <View sx={{ flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.SM }}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          maxLength={30}
          placeholder={placeholder}
          placeholderTextColor={placeholderColor}
          editable={!disabled}
          onSubmitEditing={handleSend}
          returnKeyType="send"
        />
        <Pressable
          onPress={handleSend}
          disabled={!canSend}
          style={[styles.sendButton, !canSend && styles.sendButtonDisabled]}
          accessibilityLabel="전송"
        >
          <TextInput
            editable={false}
            style={[styles.sendIcon, !canSend && styles.sendIconDisabled]}
            value="→"
          />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    flex: 1,
    fontFamily: fontFamily.REGULAR,
    ...textSizes.B3,
    color: colors.LIGHT_100,
    paddingVertical: 0,
  },
  sendButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.XS,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendIcon: {
    fontFamily: fontFamily.REGULAR,
    ...textSizes.B1,
    color: colors.PRIMARY_400,
  },
  sendIconDisabled: {
    color: colors.GRAY,
  },
});
