import { Dialog, AppInput } from '@/shared/ui';
import { useUpdateMe } from '@/features/auth/api';
import { useModalForm, handleApiError } from '@/shared/lib';
import { nicknameSchema } from '@sketch-catch/shared';

type Props = {
  visible: boolean;
  onClose: () => void;
  currentNickname: string;
};

export function NicknameModal({ visible, onClose, currentNickname }: Props) {
  const { value: nickname, setValue: setNickname, error, setError, handleClose } = useModalForm(currentNickname, onClose);
  const updateMe = useUpdateMe();

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
        onError: (err) => handleApiError(err, { setError, onClose, fallbackType: 'toast' }),
      }
    );
  };

  return (
    <Dialog
      visible={visible}
      onClose={handleClose}
      title="닉네임 변경"
      buttons={[
        { label: '닫기', color: 'light', onPress: handleClose, disabled: updateMe.isPending },
        { label: '닉네임 저장', color: 'primary', onPress: handleSave, disabled: updateMe.isPending },
      ]}
    >
      <AppInput
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
    </Dialog>
  );
}
