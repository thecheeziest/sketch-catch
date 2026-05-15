import React, { useState } from 'react';
import { View } from 'react-native';
import { PixelModal } from '@/components/PixelModal';
import { PixelInput } from '@/components/PixelInput';
import { PixelButton } from '@/components/PixelButton';
import { useUpdateMe } from '@/features/auth/useUpdateMe';
import { useToastStore } from '@/stores/toast';
import { friendCodeInputSchema } from '@sketch-catch/shared';

type Props = {
  visible: boolean;
  onClose: () => void;
  currentFriendCode: string;
};

export function FriendCodeModal({ visible, onClose, currentFriendCode }: Props): React.JSX.Element {
  const [friendCode, setFriendCode] = useState(currentFriendCode);
  const [error, setError] = useState<string | undefined>(undefined);
  const updateMe = useUpdateMe();

  const handleClose = (): void => {
    setFriendCode(currentFriendCode);
    setError(undefined);
    onClose();
  };

  const handleSave = (): void => {
    const result = friendCodeInputSchema.safeParse(friendCode);
    if (!result.success) {
      setError(result.error.errors[0]?.message ?? '친구코드를 확인해주세요');
      return;
    }

    updateMe.mutate(
      { friendCode: result.data },
      {
        onSuccess: () => {
          setError(undefined);
          onClose();
        },
        onError: (err) => {
          if (err.code === 'NICKNAME_CODE_CONFLICT') {
            setError('이미 사용 중인 닉네임+코드 조합이에요. 코드를 바꿔보세요.');
          } else {
            useToastStore.getState().show(err.message);
          }
        },
      }
    );
  };

  return (
    <PixelModal visible={visible} onClose={handleClose} title="친구코드 변경">
      <PixelInput
        value={friendCode}
        onChangeText={(text) => {
          setFriendCode(text);
          setError(undefined);
        }}
        maxLength={5}
        autoCapitalize="characters"
        hint="5자리 영문/숫자 (영문 대소문자 구분 없음)"
        error={error}
      />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <PixelButton
            label="닫기"
            variant="secondary"
            onPress={handleClose}
            disabled={updateMe.isPending}
          />
        </View>
        <View style={{ flex: 1 }}>
          <PixelButton
            label="코드 저장"
            variant="primary"
            onPress={handleSave}
            disabled={updateMe.isPending}
            style={updateMe.isPending ? { opacity: 0.6 } : undefined}
          />
        </View>
      </View>
    </PixelModal>
  );
}
