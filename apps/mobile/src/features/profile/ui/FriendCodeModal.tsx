import { Dialog } from '@/shared/ui/Dialog';
import { AppInput } from '@/shared/ui/Input';
import { useUpdateMe } from '@/features/auth/api';
import { useModalForm, handleApiError } from '@/shared/lib';
import { friendCodeInputSchema } from '@sketch-catch/shared';

type Props = {
  visible: boolean;
  onClose: () => void;
  currentFriendCode: string;
};

export function FriendCodeModal({ visible, onClose, currentFriendCode }: Props) {
  const { value: friendCode, setValue: setFriendCode, error, setError, handleClose } = useModalForm(currentFriendCode, onClose);
  const updateMe = useUpdateMe();

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
        onError: (err) => handleApiError(err, { setError, fallbackType: 'toast' }),
      }
    );
  };

  return (
    <Dialog
      visible={visible}
      onClose={handleClose}
      title="친구코드 변경"
      buttons={[
        { label: '닫기', color: 'light', onPress: handleClose, disabled: updateMe.isPending },
        { label: '코드 저장', color: 'primary', onPress: handleSave, disabled: updateMe.isPending },
      ]}
    >
      <AppInput
        value={friendCode}
        onChangeText={(text) => {
          setFriendCode(text);
          setError(undefined);
        }}
        maxLength={5}
        autoCapitalize="characters"
        hint="3~5자리 영문/숫자 (영문 대소문자 구분 없음)"
        error={error}
      />
    </Dialog>
  );
}
