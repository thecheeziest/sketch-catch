import { Text } from 'dripsy'
import { useRouter } from 'expo-router'
import { Dialog } from '@/shared/ui/Dialog'
import { useDeleteMe } from '@/features/auth/api'
import { isAppleLoginCanceled } from '@/features/auth/lib'
import { getErrorMessage } from '@/shared/lib'
import { useToastStore } from '@/shared/model'
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
      onError: (err) => {
        if (isAppleLoginCanceled(err)) return
        useToastStore.getState().show(getErrorMessage(err, { fallback: '탈퇴하지 못했어요. 다시 시도해주세요.' }), 'error')
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
