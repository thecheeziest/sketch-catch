import { useState, useEffect } from 'react';
import { PROMPT_DURATION_SEC } from '@sketch-catch/shared';
import { Text, View } from 'dripsy';
import { colors, spacing, textSizes } from '@/shared/config';
import { Dialog } from '@/shared/ui/Dialog';
import { AppInput } from '@/shared/ui/Input';

const COUNTDOWN_SEC = PROMPT_DURATION_SEC;

type Props = {
  visible: boolean;
  maxLength?: number;
  title?: string;
  endsAt?: number | null;
  /** 남은 시간 뒤에 붙는 안내 문구 */
  guide?: string;
  expiredMessage?: string;
  placeholder?: string;
  onSubmit: (text: string) => boolean;
  /** 입력 중인 값 — 모드 2는 시간 초과 자동 제출용 초안으로 동기화한다 */
  onChangeText?: (text: string) => void;
};

export function CustomPromptModal({
  visible,
  endsAt,
  onSubmit,
  maxLength = 20,
  title = '제시어를 직접 입력해 주세요',
  guide = '친구들이 맞힐 제시어를 입력해 주세요',
  expiredMessage = '시간 초과! 다음 출제자로 넘어갑니다.',
  placeholder = '예: 빨간 사과',
  onChangeText,
}: Props) {
  const [text, setText] = useState('');
  const [remaining, setRemaining] = useState(COUNTDOWN_SEC);
  useEffect(() => {
    if (!visible) {
      setText('');
      setRemaining(COUNTDOWN_SEC);
      return;
    }
    const deadline = endsAt ?? Date.now() + COUNTDOWN_SEC * 1000;
    const tick = (): void => setRemaining(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    tick();
    const timer = setInterval(tick, 250);
    return () => clearInterval(timer);
  }, [visible, endsAt]);

  const handleConfirm = (): void => {
    if (!text.trim() || remaining === 0) return;
    if (onSubmit(text.trim())) setText('');
  };

  const isExpired = remaining === 0;

  const handleChangeText = (value: string): void => {
    setText(value);
    onChangeText?.(value);
  };

  return (
    <Dialog
      visible={visible}
      onClose={() => {}}
      dismissible={false}
      title={title}
      buttons={
        isExpired
          ? []
          : [
              {
                label: '확인',
                color: 'primary',
                onPress: handleConfirm,
                disabled: !text.trim(),
              },
            ]
      }
    >
      <Text sx={{ ...textSizes.B2, color: isExpired ? colors.ERROR_400 : colors.LIGHT_300 }}>
        {isExpired ? expiredMessage : `${remaining}초 안에 ${guide}`}
      </Text>
      {!isExpired && (
        <View sx={{ marginTop: spacing.XS }}>
          <AppInput
            placeholder={placeholder}
            value={text}
            onChangeText={handleChangeText}
            maxLength={maxLength}
            showCounter
            color="SECONDARY"
          />
        </View>
      )}
    </Dialog>
  );
}
