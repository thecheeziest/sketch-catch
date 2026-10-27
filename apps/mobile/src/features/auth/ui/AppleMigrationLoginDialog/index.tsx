import { useState } from 'react';
import { Text } from 'dripsy';
import { AppInput, Button, Dialog } from '@/shared/ui';
import { colors } from '@/shared/config';
import { isAppleLoginCanceled, useAppleLogin } from '@/features/auth/lib/useAppleLogin';
import { getAppleMigrationErrorMessage } from '@/features/auth/lib/appleMigrationErrors';

type Props = { visible: boolean; onClose: () => void; onSuccess: (needsOnboarding: boolean) => void };

export function AppleMigrationLoginDialog({ visible, onClose, onSuccess }: Props) {
  const [code, setCode] = useState('');
  const login = useAppleLogin();
  const close = () => {
    if (login.isPending) return;
    setCode('');
    login.reset();
    onClose();
  };
  const errorVisible = login.error && !isAppleLoginCanceled(login.error);
  return (
    <Dialog visible={visible} onClose={close} title="기존 Apple 계정 가져오기" dismissible={!login.isPending}>
      <Text sx={{ color: colors.LIGHT_100 }}>기존 앱의 설정에서 발급받은 이전 코드를 붙여넣어 주세요.</Text>
      <AppInput
        label="이전 코드"
        value={code}
        maxLength={32}
        onChangeText={value => setCode(value.replace(/\s/g, '').toLowerCase())}
        placeholder="32자리 이전 코드"
      />
      {errorVisible && (
        <Text variant="B3" sx={{ color: colors.ERROR_400 }}>
          {getAppleMigrationErrorMessage(login.error)}
        </Text>
      )}
      <Button
        label="Apple 로그인으로 계정 연결"
        disabled={!/^[a-f0-9]{32}$/.test(code)}
        loading={login.isPending}
        onPress={() => login.mutate(code, { onSuccess: data => onSuccess(data.needsOnboarding) })}
      />
      <Text variant="B3" sx={{ color: colors.GRAY }}>
        연결 후에는 Apple 로그인만으로 기존 데이터를 사용할 수 있어요.
      </Text>
      <Button label="닫기" color="dark" disabled={login.isPending} onPress={close} />
    </Dialog>
  );
}
