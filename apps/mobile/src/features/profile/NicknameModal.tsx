import React, { useState } from 'react';
import { View } from 'react-native';
import { PixelModal } from '@/components/PixelModal';
import { PixelInput } from '@/components/PixelInput';
import { PixelButton } from '@/components/PixelButton';
import { useUpdateMe } from '@/features/auth/useUpdateMe';
import { useToastStore } from '@/stores/toast';
import { nicknameSchema } from '@sketch-catch/shared';

type Props = {
  visible: boolean;
  onClose: () => void;
  currentNickname: string;
};

export function NicknameModal({ visible, onClose, currentNickname }: Props): React.JSX.Element {
  const [nickname, setNickname] = useState(currentNickname);
  const [error, setError] = useState<string | undefined>(undefined);
  const updateMe = useUpdateMe();

  const handleClose = (): void => {
    setNickname(currentNickname);
    setError(undefined);
    onClose();
  };

  const handleSave = (): void => {
    const result = nicknameSchema.safeParse(nickname);
    if (!result.success) {
      setError(result.error.errors[0]?.message ?? '닉네임을 확인해주세요');
      return;
    }

    updateMe.mutate(
      { nickname: result.data },
      {
        onSuccess: () => {
          setError(undefined);
          onClose();
        },
        onError: (err) => {
          if (err.code === 'NICKNAME_CHANGE_COOLDOWN') {
            useToastStore.getState().show('30일 이내 변경 불가');
            onClose();
          } else if (err.code === 'NICKNAME_CODE_CONFLICT') {
            setError('이미 사용 중인 닉네임+코드 조합이에요. 코드를 바꿔보세요.');
          } else {
            useToastStore.getState().show(err.message);
          }
        },
      }
    );
  };

  return (
    <PixelModal visible={visible} onClose={handleClose} title="닉네임 변경">
      <PixelInput
        value={nickname}
        onChangeText={(text) => {
          setNickname(text);
          setError(undefined);
        }}
        maxLength={10}
        showCounter
        hint="2~10자, 띄어쓰기 포함 가능"
        error={error}
        autoCapitalize="none"
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
            label="닉네임 저장"
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
