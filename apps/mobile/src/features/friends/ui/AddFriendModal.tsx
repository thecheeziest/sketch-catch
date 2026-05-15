import React, { useState } from 'react';
import { View } from 'react-native';
import { PixelModal } from '@/shared/ui/PixelModal';
import { PixelInput } from '@/shared/ui/PixelInput';
import { PixelButton } from '@/shared/ui/PixelButton';
import { useSendFriendRequest } from '@/features/friends/api/useSendFriendRequest';
import { useToastStore } from '@/shared/model/toast';
import { ApiError } from '@/shared/api/client';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function AddFriendModal({ visible, onClose }: Props): React.JSX.Element {
  const [target, setTarget] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);
  const { mutate, isPending } = useSendFriendRequest();

  const handleClose = (): void => {
    setTarget('');
    setError(undefined);
    onClose();
  };

  const handleSubmit = (): void => {
    if (!target.includes('#')) {
      setError('닉네임#코드 형식으로 입력해주세요');
      return;
    }

    mutate(target, {
      onSuccess: () => {
        useToastStore.getState().show('친구 요청을 보냈어요');
        handleClose();
      },
      onError: (err) => {
        if (err instanceof ApiError) {
          if (err.code === 'USER_NOT_FOUND') {
            setError('사용자를 찾을 수 없어요. 닉네임과 코드를 확인해주세요.');
          } else if (err.code === 'ALREADY_FRIENDS') {
            setError('이미 친구인 사용자예요.');
          } else if (err.code === 'REQUEST_ALREADY_SENT') {
            setError('이미 친구 요청을 보낸 상태예요.');
          } else if (err.code === 'SELF_REQUEST') {
            setError('자기 자신에게 요청을 보낼 수 없어요.');
          } else {
            setError('연결에 실패했어요. 잠시 후 다시 시도해주세요.');
          }
        } else {
          setError('연결에 실패했어요. 잠시 후 다시 시도해주세요.');
        }
      },
    });
  };

  return (
    <PixelModal visible={visible} onClose={handleClose} title="친구 추가">
      <PixelInput
        label="닉네임#코드"
        placeholder="닉네임#코드"
        hint="예: 스케치#AB12C"
        value={target}
        onChangeText={(v) => {
          setTarget(v);
          setError(undefined);
        }}
        autoCapitalize="none"
        autoCorrect={false}
        error={error}
      />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <PixelButton label="닫기" variant="secondary" onPress={handleClose} />
        </View>
        <View style={{ flex: 1 }}>
          <PixelButton
            label="요청 보내기"
            variant="primary"
            onPress={handleSubmit}
            disabled={isPending}
            style={isPending ? { opacity: 0.6 } : undefined}
          />
        </View>
      </View>
    </PixelModal>
  );
}
