import { Text, View } from 'dripsy';
import { Button, Dialog } from '@/shared/ui';
import { colors, spacing } from '@/shared/config';
import { isAppleLoginCanceled } from '@/features/auth/lib/useAppleLogin';
import { getAppleMigrationErrorMessage } from '@/features/auth/lib/appleMigrationErrors';
import { useAppleMigrationCode } from '@/features/auth/lib/useAppleMigrationCode';

type Props = { visible: boolean; onClose: () => void };

export function AppleMigrationCodeDialog({ visible, onClose }: Props) {
  const { issue, copyCode } = useAppleMigrationCode();
  const close = () => {
    if (issue.isPending) return;
    issue.reset();
    onClose();
  };
  const errorVisible = issue.error && !isAppleLoginCanceled(issue.error);
  return (
    <Dialog visible={visible} onClose={close} title="Apple 계정 이전" dismissible={!issue.isPending}>
      <Text sx={{ color: colors.LIGHT_100 }}>
        새 스케치캐치 앱에서도 내 코인·꾸미기·친구를 그대로 사용할 수 있어요.
      </Text>
      <Text variant="B3" sx={{ color: colors.GRAY }}>
        기존 Apple 계정을 확인한 뒤 코드를 발급받아 주세요. 새 앱의 로그인 화면에서 ‘기존 Apple 계정 가져오기’를
        선택하면 돼요.
      </Text>
      {issue.data && (
        <View sx={{ gap: spacing.SM }}>
          <Text selectable sx={{ color: colors.SECONDARY_100, fontSize: 13 }}>
            {issue.data.code}
          </Text>
          <Text variant="B3" sx={{ color: colors.GRAY }}>
            15분 동안 한 번만 사용할 수 있어요. 본인 기기에서만 사용해주세요.
          </Text>
          <Button label="코드 복사" color="secondary" onPress={copyCode} />
        </View>
      )}
      {errorVisible && (
        <Text variant="B3" sx={{ color: colors.ERROR_400 }}>
          {getAppleMigrationErrorMessage(issue.error)}
        </Text>
      )}
      <Button label="Apple 확인 후 코드 발급" loading={issue.isPending} onPress={() => issue.mutate()} />
      <Button label="닫기" color="dark" disabled={issue.isPending} onPress={close} />
    </Dialog>
  );
}
