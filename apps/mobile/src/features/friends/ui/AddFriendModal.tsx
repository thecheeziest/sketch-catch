import { Dialog, AppInput } from '@/shared/ui';
import { useSendFriendRequest } from '@/features/friends/api';
import { useToastStore } from '@/shared/model';
import { useModalForm, handleApiError } from '@/shared/lib';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function AddFriendModal({ visible, onClose }: Props) {
  const { value: target, setValue: setTarget, error, setError, handleClose } = useModalForm('', onClose);
  const { mutate, isPending } = useSendFriendRequest();

  const handleSubmit = (): void => {
    const hashIdx = target.lastIndexOf('#');
    if (hashIdx === -1) {
      setError('닉네임#해시태그 형식으로 입력해주세요');
      return;
    }
    const code = target.slice(hashIdx + 1);
    if (!/^[A-Za-z0-9]{3,5}$/.test(code)) {
      setError('해시태그는 영문·숫자 3~5자리여야 해요 (예: AB12C)');
      return;
    }

    const normalizedTarget = target.slice(0, hashIdx + 1) + code.toUpperCase();
    mutate(normalizedTarget, {
      onSuccess: () => {
        useToastStore.getState().show('친구 요청을 보냈어요');
        handleClose();
      },
      onError: (err) => handleApiError(err, { setError, fallbackMessage: '연결에 실패했어요. 잠시 후 다시 시도해주세요.' }),
    });
  };

  return (
    <Dialog
      visible={visible}
      onClose={handleClose}
      title="친구 추가"
      buttons={[
        { label: '닫기', color: 'light', onPress: handleClose },
        { label: '요청 보내기', color: 'primary', onPress: handleSubmit, loading: isPending },
      ]}
    >
      <AppInput
        label="닉네임#해시태그"
        placeholder="닉네임#해시태그"
        hint="예: 스케치#AB12C"
        value={target}
        onChangeText={(v) => {
          setTarget(v);
          setError(undefined);
        }}
        autoCapitalize="none"
        error={error}
      />
    </Dialog>
  );
}
