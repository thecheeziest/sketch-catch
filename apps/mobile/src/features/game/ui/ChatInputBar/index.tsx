import { useState } from 'react';
import { View } from 'dripsy';
import { Pressable, StyleSheet, TextInput } from 'react-native';
import { colors, fontFamily, spacing, textSizes } from '@/shared/config';

type Props = {
  isDrawer: boolean;
  onSend: (text: string) => void;
};

export function ChatInputBar({ isDrawer, onSend }: Props) {
  const [text, setText] = useState('');

  const canSend = text.trim().length > 0;

  const handleSend = (): void => {
    if (!canSend || isDrawer) return;
    onSend(text.trim());
    setText('');
  };

  return (
    <View sx={{ height: 44, backgroundColor: colors.DARK_100, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.SM }}>
      <TextInput
        style={styles.input}
        value={text}
        onChangeText={setText}
        maxLength={30}
        editable={!isDrawer}
        placeholder={isDrawer ? '출제 중에는 채팅 불가' : '정답을 입력하세요'}
        placeholderTextColor={colors.GRAY}
        onSubmitEditing={handleSend}
        returnKeyType="send"
      />
      <Pressable
        onPress={handleSend}
        disabled={!canSend || isDrawer}
        style={[styles.sendButton, (!canSend || isDrawer) && styles.sendButtonDisabled]}
        accessibilityLabel="전송"
      >
        <TextInput
          editable={false}
          style={[styles.sendIcon, (!canSend || isDrawer) && styles.sendIconDisabled]}
          value="→"
        />
      </Pressable>
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
