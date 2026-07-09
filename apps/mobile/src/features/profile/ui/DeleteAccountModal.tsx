import { Text } from 'dripsy'
import { useRouter } from 'expo-router'
import { Dialog } from '@/shared/ui'
import { useDeleteMe } from '@/features/auth/api'
import { colors } from '@/shared/config'

type Props = {
  visible: boolean
  onClose: () => void
}

export function DeleteAccountModal({ visible, onClose }: Props) {
  const router = useRouter()
  const deleteMe = useDeleteMe()

  const handleDelete = (): void => {
    deleteMe.mutate(undefined, {
      onSuccess: () => {
        onClose()
        router.replace('/(auth)/onboarding/step1')
      },
    })
  }

  return (
    <Dialog
      visible={visible}
      onClose={onClose}
      title="정말 탈퇴하시겠어요?"
      buttons={[
        { label: '계속 이용하기', color: 'light', onPress: onClose, disabled: deleteMe.isPending },
        { label: '탈퇴하기', color: 'dark', onPress: handleDelete, disabled: deleteMe.isPending },
      ]}
    >
      <Text variant="B4" sx={{ color: colors.GRAY }}>
        탈퇴하면 모든 데이터가 삭제됩니다. 이 작업은 되돌릴 수 없어요.
      </Text>
    </Dialog>
  )
}
